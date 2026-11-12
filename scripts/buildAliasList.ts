// Builds the alias list AND the migration plan from a live snapshot, the
// automated verification, and the committed human merge decisions. Pure: no
// DynamoDB, no network (canonical metadata lookups are injected).
//
//   npm run script scripts/buildAliasList.ts
//     reads  ./citySnapshot.json, ./cityVerification.json, ./cityMergeDecisions.json
//     writes ./cityAliases.json (committed) and ./cityMigrationPlan.json (local)
//   Usually run through scripts/cityPipeline.ts, which does all steps from live data.
//
// Where each record goes (first rule that applies):
//   1. a committed human merge covering it        → that merge's canonical
//   2. automatically verified (exact/samecity/consensus) → that OSM object
//      (rollup verdicts: the object the user PICKED, never its containing
//      area — only true duplicates merge; nearness is shown, not merged)
//   3. already an OSM id (created after cutover)   → itself
//   4. anything else (unverified)                  → ITSELF: kept as its own
//      place, never merged, never redirected (the safe default)
// Then, with the SAME rules a sign-up uses (app/_lib/resolvePlace.ts), any
// two resulting pages that are provably one place merge: same Wikidata, or
// identical label, or same city name + state (e.g. the Manchester city node and
// its boundary relation, which verify to two different OSM objects). Without
// this, two existing pages were never compared, only records against OSM.
// Records sharing a target are the same place (true duplicates) and collapse.
// We only ever alias historical record ids, never osm id → osm id (ADR 0001 §4).

import { readFileSync, writeFileSync } from "fs";

import { Place } from "../app/_lib/nominatim";
import { resolvePlace, Rule } from "../app/_lib/resolvePlace";
import type { Snapshot } from "./citySnapshot";
import type { Verdict } from "./verifyOsm";

export type Decisions = {
  merges: { label: string; members: string[]; canonical?: string; canonicalRecord?: string }[];
  separate: { label: string; members: string[] }[];
};

export type CanonicalPlace = {
  id: string;
  isOsm: boolean;
  name: string | null;
  fullName: string | null;
  countryCode: string | null;
  lat: number | null;
  lon: number | null;
  bbox: [number, number, number, number] | null; // [south, north, west, east]
  placeType: string | null; // Nominatim addresstype
  state?: string | null; // address.state (sign-up resolution: same state required)
  wikidata?: string | null; // Wikidata QID (sign-up resolution: strongest match)
  users: number;
  fromRecords: string[];
};

export type Plan = {
  snapshotTakenAt: string;
  canonicals: Record<string, CanonicalPlace>;
  aliases: Record<string, string>; // historical record id → canonical id
  unverified: Record<string, string>; // record id → why it is kept as its own place
  userMoves: { username: string; from: string; to: string }[];
  cityRecordsToRetire: string[]; // aliased record ids (remove only after their users moved)
  orphanUsers: { username: string; cityId: string }[]; // cityId with no city record: left untouched
  humanMerges: { label: string; canonical: string; members: { id: string; automated: string }[] }[];
  // Pages merged because sign-up would join them (provable rules only).
  // "candidates": every OSM object that fit an ambiguous record lands on one page.
  provenMerges: { canonical: string; members: { id: string; rule: Rule | "candidates" }[] }[];
  violations: string[]; // any → the plan must not be applied
  warnings: string[];
};

const OSM_ID = /^[NWR]\d+$/;
const VERIFIED = new Set(["exact", "samecity", "typedera", "rollup", "consensus"]);
// The identity a verdict proves. A rollup proves which object was picked; its
// containing area is a different place, so we don't move anyone there.
export const verifiedKey = (v: Verdict | undefined) =>
  !v || !VERIFIED.has(v.status) ? null : v.status === "rollup" ? (v.exact?.key ?? null) : (v.canonical?.key ?? null);
const parseCoords = (id: string): [number, number] | null => {
  const m = id.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};

type Meta = { name: string | null; fullName: string | null; countryCode: string | null; lat: number | null; lon: number | null };
export type GeoLookup = (keys: string[]) => Promise<
  Map<string, { lat: number; lon: number; bbox: number[] | null; placeType: string | null; state?: string | null; wikidata?: string | null }>
>;
const TYPE_RANK: Record<string, number> = { R: 0, W: 1, N: 2 };
// OSM keys an unverified verdict was torn between (pin or legacy search).
const candidateKeys = (v: Verdict | undefined): string[] =>
  ((v?.evidence?.cands as { key: string }[] | undefined) ?? []).map((c) => c.key).filter((k) => OSM_ID.test(k));

export async function buildPlan(
  snapshot: Snapshot,
  verdicts: Record<string, Verdict>,
  decisions: Decisions,
  lookupMeta: (osmKey: string) => Promise<Meta | null> = async () => null,
  lookupGeo?: GeoLookup, // without it, provable page merges are skipped (warning)
): Promise<Plan> {
  const cities = new Map(snapshot.cities.map((c) => [c.id, c]));
  const violations: string[] = [];
  const warnings: string[] = [];

  // What the automated rules alone say for each record.
  const automated = new Map<string, string>();
  for (const c of snapshot.cities) {
    const v = verdicts[c.id];
    if (!v) violations.push(`no verdict for city ${c.id} (verification out of date?)`);
    automated.set(c.id, verifiedKey(v) ?? c.id);
  }

  // Human merges override, member by member.
  const target = new Map(automated);
  const humanMerges: Plan["humanMerges"] = [];
  for (const m of decisions.merges) {
    const present = m.members.filter((id) => cities.has(id));
    if (!present.length) continue;
    const canonical = m.canonical ?? (m.canonicalRecord ? automated.get(m.canonicalRecord) : undefined);
    if (!canonical || (!OSM_ID.test(canonical) && !cities.has(canonical))) {
      warnings.push(`merge "${m.label}": canonical record ${m.canonicalRecord ?? "?"} is not verified, so the merge is not applied (members follow the automated rules)`);
      continue;
    }
    for (const id of present) target.set(id, canonical);
    humanMerges.push({ label: m.label, canonical, members: present.map((id) => ({ id, automated: automated.get(id)! })) });
  }

  // Assemble canonical places from live user rows (stored counters are ignored).
  const usersBy = new Map<string, number>();
  for (const u of snapshot.users) usersBy.set(u.cityId, (usersBy.get(u.cityId) ?? 0) + 1);
  const metaFromVerdict = new Map<string, Meta>();
  for (const v of Object.values(verdicts))
    for (const m of [v.canonical, v.exact])
      if (m && !metaFromVerdict.has(m.key))
        metaFromVerdict.set(m.key, { name: m.name, fullName: m.displayName, countryCode: m.cc, lat: m.lat, lon: m.lon });

  const metaCache = new Map<string, Meta | null>();
  const metaOf = async (cid: string): Promise<Meta | null> => {
    if (metaCache.has(cid)) return metaCache.get(cid)!;
    const own = cities.get(cid);
    const coords = own ? parseCoords(own.id) : null;
    // A page already keyed by its OSM id carries its own name and label
    // (written from OSM at creation): no per-page lookup needed.
    const stored = own?.name && own.fullName && own.countryCode
      ? { name: own.name, fullName: own.fullName, countryCode: own.countryCode, lat: own.lat ?? null, lon: own.lon ?? null }
      : null;
    const meta: Meta | null = OSM_ID.test(cid)
      ? (metaFromVerdict.get(cid) ?? stored ?? (await lookupMeta(cid)) ??
          (own ? { name: own.name ?? null, fullName: own.fullName ?? null, countryCode: own.countryCode ?? null, lat: null, lon: null } : null))
      : own
        ? { name: own.name ?? null, fullName: own.fullName ?? null, countryCode: own.countryCode ?? null, lat: coords?.[0] ?? null, lon: coords?.[1] ?? null }
        : null;
    metaCache.set(cid, meta);
    return meta;
  };

  // ---------- provable page merges (the sign-up rules, page against page) ----------
  const provenMerges: Plan["provenMerges"] = [];
  const provenTo = new Map<string, string>(); // merged page id → surviving page id
  if (!lookupGeo) warnings.push("no geo lookup: provable page merges (sign-up rules) skipped");
  else {
    const targets = [...new Set(target.values())].sort();
    const geo = await lookupGeo(targets.filter((id) => OSM_ID.test(id)));
    const usersOfTarget = new Map<string, number>();
    for (const c of snapshot.cities) {
      const t = target.get(c.id)!;
      usersOfTarget.set(t, (usersOfTarget.get(t) ?? 0) + (usersBy.get(c.id) ?? 0));
    }
    const places: Place[] = [];
    for (const id of targets) {
      const m = await metaOf(id);
      const g = geo.get(id);
      const lat = g?.lat ?? m?.lat;
      const lon = g?.lon ?? m?.lon;
      if (!m || lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      places.push({
        id, name: m.name ?? "", fullName: m.fullName ?? "", countryCode: m.countryCode ?? undefined, lat, lon,
        bbox: g?.bbox && g.bbox.length === 4 ? (g.bbox.map(Number) as Place["bbox"]) : null,
        placeType: g?.placeType ?? null, state: g?.state ?? null, wikidata: g?.wikidata ?? null,
      });
    }
    const parent = new Map(places.map((p) => [p.id, p.id]));
    const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
    const ruleOf = new Map<string, Rule>();
    for (const p of places) {
      const r = resolvePlace(p, { page: () => undefined, redirect: () => undefined, pages: places.filter((q) => q.id !== p.id) });
      if (r.kind !== "match") continue;
      parent.set(find(p.id), find(r.pageId));
      ruleOf.set(p.id, ruleOf.get(p.id) ?? r.rule);
      ruleOf.set(r.pageId, ruleOf.get(r.pageId) ?? r.rule);
    }
    const groups = new Map<string, string[]>();
    for (const p of places) groups.set(find(p.id), [...(groups.get(find(p.id)) ?? []), p.id]);
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      const kept = decisions.separate.find((d) => d.members.filter((m) => ids.includes(target.get(m) ?? "")).length > 1);
      if (kept) {
        warnings.push(`provable merge of ${ids.join(", ")} not applied: "${kept.label}" must stay separate`);
        continue;
      }
      // Survivor: most people (fewest moves), then an OSM id, then relation > way > node.
      const [winner, ...rest] = [...ids].sort(
        (a, b) => (usersOfTarget.get(b) ?? 0) - (usersOfTarget.get(a) ?? 0) ||
          Number(OSM_ID.test(b)) - Number(OSM_ID.test(a)) ||
          (TYPE_RANK[a.charAt(0)] ?? 3) - (TYPE_RANK[b.charAt(0)] ?? 3) || a.localeCompare(b),
      );
      if (!winner) continue;
      for (const id of rest) provenTo.set(id, winner);
      provenMerges.push({ canonical: winner, members: rest.map((id) => ({ id, rule: ruleOf.get(id)! })) });
    }

    // A record left unverified only because SEVERAL OSM objects fit it (Paris:
    // its pin is shared by the commune and the city district) is proven when
    // every candidate lands on the same page under the sign-up rules.
    const winners = new Set(provenMerges.map((m) => m.canonical));
    const ambiguous = snapshot.cities.filter((c) => {
      const v = verdicts[c.id];
      return v?.status === "unverified" && target.get(c.id) === c.id && !provenTo.has(c.id) && !winners.has(c.id) &&
        candidateKeys(v).length >= 2;
    });
    if (ambiguous.length) {
      const keys = [...new Set(ambiguous.flatMap((c) => candidateKeys(verdicts[c.id])))];
      const cgeo = await lookupGeo(keys);
      for (const c of ambiguous) {
        const others = places.filter((p) => p.id !== c.id);
        const lands: (string | null)[] = [];
        for (const k of candidateKeys(verdicts[c.id])) {
          const m = await metaOf(k);
          const g = cgeo.get(k) ?? geo.get(k);
          if (!m || !g) { lands.push(null); continue; }
          const cand: Place = {
            id: k, name: m.name ?? "", fullName: m.fullName ?? "", countryCode: m.countryCode ?? undefined,
            lat: g.lat, lon: g.lon, bbox: g.bbox && g.bbox.length === 4 ? (g.bbox.map(Number) as Place["bbox"]) : null,
            placeType: g.placeType ?? null, state: g.state ?? null, wikidata: g.wikidata ?? null,
          };
          const r = resolvePlace(cand, { page: (id) => others.find((p) => p.id === id), redirect: () => undefined, pages: others });
          lands.push("pageId" in r ? (provenTo.get(r.pageId) ?? r.pageId) : null);
        }
        const [page] = new Set(lands);
        if (!page || lands.some((l) => l !== page) || page === c.id) continue;
        if (decisions.separate.some((d) => d.members.includes(c.id) && d.members.some((m) => target.get(m) === page))) continue;
        provenTo.set(c.id, page);
        const group = provenMerges.find((m) => m.canonical === page);
        if (group) group.members.push({ id: c.id, rule: "candidates" });
        else provenMerges.push({ canonical: page, members: [{ id: c.id, rule: "candidates" }] });
      }
    }
    for (const [id, t] of target) if (provenTo.has(t)) target.set(id, provenTo.get(t)!);
    for (const m of humanMerges) m.canonical = provenTo.get(m.canonical) ?? m.canonical;
  }

  const canonicals: Record<string, CanonicalPlace> = {};
  const aliases: Record<string, string> = {};
  const unverified: Record<string, string> = {};
  for (const c of snapshot.cities) {
    const cid = target.get(c.id)!;
    if (!canonicals[cid]) {
      const meta = await metaOf(cid);
      if (!meta) violations.push(`no metadata for canonical ${cid}`);
      canonicals[cid] = {
        id: cid, isOsm: OSM_ID.test(cid), name: meta?.name ?? null, fullName: meta?.fullName ?? null,
        countryCode: meta?.countryCode ?? null, lat: meta?.lat ?? null, lon: meta?.lon ?? null, bbox: null, placeType: null, users: 0, fromRecords: [],
      };
    }
    canonicals[cid].users += usersBy.get(c.id) ?? 0;
    canonicals[cid].fromRecords.push(c.id);
    if (c.id !== cid) aliases[c.id] = cid;
    else if (!OSM_ID.test(c.id)) unverified[c.id] = verdicts[c.id]?.reason ?? "no verdict";
  }

  const userMoves: Plan["userMoves"] = [];
  const orphanUsers: Plan["orphanUsers"] = [];
  for (const u of snapshot.users) {
    if (!cities.has(u.cityId)) orphanUsers.push({ username: u.username, cityId: u.cityId });
    else if (target.get(u.cityId) !== u.cityId) userMoves.push({ username: u.username, from: u.cityId, to: target.get(u.cityId)! });
  }

  // ---------- invariants ----------
  for (const [from, to] of Object.entries(aliases)) {
    if (!canonicals[to]) violations.push(`alias ${from} → ${to}: target is not a canonical`);
    if (aliases[to]) violations.push(`alias chain ${from} → ${to} → ${aliases[to]}`);
    if (OSM_ID.test(from)) violations.push(`alias from an OSM id ${from} (forbidden by ADR §4)`);
    if (unverified[from]) violations.push(`unverified record ${from} is aliased`);
  }
  for (const s of decisions.separate) {
    const ts = s.members.filter((id) => cities.has(id)).map((id) => target.get(id));
    if (new Set(ts).size !== ts.length) violations.push(`"${s.label}" must stay separate but members share a canonical`);
  }
  // Two records with DIFFERENT automated identities may only meet through a
  // committed human merge — never by accident.
  const humanMember = new Set(humanMerges.flatMap((m) => m.members.map((x) => x.id)));
  for (const p of Object.values(canonicals)) {
    const auto = new Set(
      p.fromRecords.filter((id) => !humanMember.has(id)).map((id) => provenTo.get(automated.get(id)!) ?? automated.get(id)),
    );
    if (auto.size > 1) violations.push(`canonical ${p.id} merges records with different automated identities: ${[...auto].join(", ")}`);
  }
  const placed = Object.values(canonicals).reduce((s, p) => s + p.users, 0);
  if (placed + orphanUsers.length !== snapshot.users.length)
    violations.push(`user count not conserved: ${placed} placed + ${orphanUsers.length} orphans ≠ ${snapshot.users.length}`);

  return {
    snapshotTakenAt: snapshot.takenAt, canonicals, aliases, unverified, userMoves,
    cityRecordsToRetire: Object.keys(aliases), orphanUsers, humanMerges, provenMerges, violations, warnings,
  };
}

// Fills coordinates + bounding boxes of OSM places from a batched lookup (the
// "nearby" section needs both). Own places keep their pin and have no bbox.
export async function addGeo(
  plan: Plan,
  lookupGeo: (keys: string[]) => Promise<
    Map<string, { lat: number; lon: number; bbox: number[] | null; placeType: string | null; state?: string | null; wikidata?: string | null }>
  >,
) {
  const geo = await lookupGeo(Object.values(plan.canonicals).filter((p) => p.isOsm).map((p) => p.id));
  for (const p of Object.values(plan.canonicals)) {
    const g = geo.get(p.id);
    if (!g) continue;
    p.lat = g.lat;
    p.lon = g.lon;
    p.bbox = g.bbox && g.bbox.length === 4 ? (g.bbox.map(Number) as CanonicalPlace["bbox"]) : null;
    p.placeType = g.placeType;
    p.state = g.state ?? null;
    p.wikidata = g.wikidata ?? null;
  }
  const missing = Object.values(plan.canonicals).filter((p) => p.users > 0 && p.lat === null).map((p) => p.id);
  if (missing.length) plan.warnings.push(`no coordinates for ${missing.length} places with users (not shown in nearby): ${missing.join(", ")}`);
}

export function writePlan(plan: Plan) {
  // Committed artifact: no usernames in it.
  writeFileSync(
    "./cityAliases.json",
    JSON.stringify({ generatedAt: plan.snapshotTakenAt, canonicals: plan.canonicals, aliases: plan.aliases, unverified: plan.unverified }, null, 2),
  );
  writeFileSync("./cityMigrationPlan.json", JSON.stringify(plan, null, 2));
}

export function reportPlan(plan: Plan, snapshot: Snapshot) {
  const places = Object.values(plan.canonicals);
  const dupGroups = places.filter((p) => p.fromRecords.length > 1);
  console.log(`snapshot ${plan.snapshotTakenAt}: ${snapshot.cities.length} city records, ${snapshot.users.length} users`);
  console.log(`canonical places:     ${places.length}  (${places.filter((p) => p.isOsm).length} OSM, ${places.filter((p) => !p.isOsm).length} kept as own place)`);
  console.log(`  with ≥1 user:       ${places.filter((p) => p.users > 0).length}`);
  console.log(`duplicate groups:     ${dupGroups.length} (collapsing ${dupGroups.reduce((s, p) => s + p.fromRecords.length, 0)} records)`);
  console.log(`alias redirects:      ${Object.keys(plan.aliases).length}`);
  console.log(`unverified (own place): ${Object.keys(plan.unverified).length}`);
  console.log(`users to re-point:    ${plan.userMoves.length}`);
  console.log(`orphan users:         ${plan.orphanUsers.length} ${plan.orphanUsers.map((u) => u.cityId).join(", ")}`);
  for (const m of plan.humanMerges)
    console.log(`human merge ${m.label} → ${m.canonical}: ${m.members.map((x) => `${x.id}⇒${x.automated}`).join("  ")}`);
  for (const m of plan.provenMerges)
    console.log(`proven merge → ${m.canonical} (${plan.canonicals[m.canonical]?.name}): ${m.members.map((x) => `${x.id} by ${x.rule}`).join("  ")}`);
  for (const w of plan.warnings) console.log(`warning: ${w}`);
  console.log(plan.violations.length ? `\nVIOLATIONS:\n  ${plan.violations.join("\n  ")}` : `\ninvariants: all hold`);
}

if (typeof require !== "undefined" && require.main === module) {
  (async () => {
    const snapshot: Snapshot = JSON.parse(readFileSync(process.env.SNAPSHOT ?? "./citySnapshot.json", "utf8"));
    const verdicts = JSON.parse(readFileSync("./cityVerification.json", "utf8"));
    const decisions: Decisions = JSON.parse(readFileSync("./cityMergeDecisions.json", "utf8"));
    const { lookup, lookupGeo } = require("./verifyOsm");
    const plan = await buildPlan(snapshot, verdicts, decisions, async (key) => {
      const c = await lookup(key);
      return c && { name: c.name, fullName: c.displayName, countryCode: c.cc, lat: c.lat, lon: c.lon };
    }, lookupGeo);
    await addGeo(plan, lookupGeo);
    reportPlan(plan, snapshot);
    if (plan.violations.length) process.exit(1);
    writePlan(plan);
    console.log("→ ./cityAliases.json, ./cityMigrationPlan.json");
  })();
}
