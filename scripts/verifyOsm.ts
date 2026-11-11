// Automatically re-identifies EVERY legacy city record as an OSM object, and
// accepts an identity only when independent signals agree (see osmMatch.ts).
// Anything not proven is marked "unverified" → the alias builder keeps it as its
// own place (never merged, never redirected). Input is a snapshot of the live
// table (scripts/citySnapshot.ts); this file itself never talks to DynamoDB.
//
//   npm run script scripts/verifyOsm.ts            # fetch (cached) + decide
//   OFFLINE=1 npm run script scripts/verifyOsm.ts  # decide from cache only
//   (reads ./citySnapshot.json; SNAPSHOT=path to override)
//
// Writes ./cityVerification.json. Usually run through scripts/cityPipeline.ts. Every Nominatim response is cached in
// ./cityNominatimCache.jsonl (append-only), so reruns are free and repeatable.
// Nominatim policy: ≤ 1 req/s, identifying User-Agent.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs";

import type { Snapshot } from "./citySnapshot";
import {
  AddressLine,
  Cand,
  LegacyMatch,
  PinMatch,
  dedupe,
  isPlaceLevel,
  matchContainment,
  matchLegacy,
  matchPin,
  matchSameCity,
  normName,
  PROOF_M,
  rollupTarget,
  sameFullName,
  shortKey,
} from "./osmMatch";

const OUT = "./cityVerification.json";
const CACHE = "./cityNominatimCache.jsonl";
const UA = "meet.hn-osm-verify/1.0 (hi@meet.hn)";
const BASE = "https://nominatim.openstreetmap.org";
const DELAY_MS = 1100;
const OFFLINE = !!process.env.OFFLINE;
const REVERSE_ZOOMS = [3, 5, 8, 10, 12, 14, 16, 17, 18];

type Row = {
  originalId: string;
  scheme: "latlon" | "legacy" | "osm";
  name?: string;
  fullName?: string;
  country?: string;
  countryCode?: string;
  realUsers: number;
  storedCoords: [number, number] | null;
};

export const OSM_ID = /^[NWR]\d+$/;
const parseCoords = (id: string): [number, number] | null => {
  const m = id.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
};
export function rowsFromSnapshot(s: Snapshot): Row[] {
  const usersBy = new Map<string, number>();
  for (const u of s.users) usersBy.set(u.cityId, (usersBy.get(u.cityId) ?? 0) + 1);
  return s.cities.map((c) => {
    const coords = parseCoords(c.id);
    // Legacy ids are `cc-Name`; recover a lost name from the id.
    const name = c.name ?? (!coords && c.id.includes("-") ? c.id.split("-").slice(1).join(" ").trim() || undefined : undefined);
    return {
      originalId: c.id,
      scheme: OSM_ID.test(c.id) ? "osm" : coords ? "latlon" : "legacy",
      name, fullName: c.fullName, country: c.country, countryCode: c.countryCode,
      realUsers: usersBy.get(c.id) ?? 0, storedCoords: coords,
    };
  });
}

// ---------- cached, rate-limited Nominatim ----------
const cache = new Map<string, any>();
if (existsSync(CACHE))
  for (const line of readFileSync(CACHE, "utf8").split("\n"))
    if (line) {
      const { url, data } = JSON.parse(line);
      cache.set(url, data);
    }
let last = 0;
let fetched = 0;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string): Promise<any> {
  if (cache.has(url)) return cache.get(url);
  if (OFFLINE) throw new Error(`OFFLINE cache miss: ${url}`);
  for (let attempt = 0; ; attempt++) {
    const gap = Date.now() - last;
    if (gap < DELAY_MS) await wait(DELAY_MS - gap);
    last = Date.now();
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      const data = trimResponse(await res.json());
      cache.set(url, data);
      appendFileSync(CACHE, JSON.stringify({ url, data }) + "\n");
      fetched++;
      return data;
    }
    if (res.status === 404) {
      cache.set(url, null);
      appendFileSync(CACHE, JSON.stringify({ url, data: null }) + "\n");
      return null;
    }
    if (attempt >= 4) throw new Error(`HTTP ${res.status} ${url}`);
    await wait(5000 * 2 ** attempt);
  }
}

const KEEP_NAMES = [
  "name", "name:en", "int_name", "official_name", "official_name:en",
  "alt_name", "alt_name:en", "short_name", "short_name:en", "old_name", "old_name:en",
];
function trimResult(r: any) {
  if (!r || r.osm_id == null || typeof r.osm_type !== "string") return null;
  const nd: Record<string, string> = {};
  for (const k of KEEP_NAMES) if (r.namedetails?.[k]) nd[k] = r.namedetails[k];
  return {
    osm_type: r.osm_type, osm_id: r.osm_id, lat: r.lat, lon: r.lon, name: r.name ?? null,
    namedetails: nd, category: r.category, type: r.type, addresstype: r.addresstype,
    cc: r.address?.country_code ?? null, display_name: r.display_name, importance: r.importance ?? null,
    ...(Array.isArray(r.boundingbox) ? { boundingbox: r.boundingbox.map(Number) } : {}),
  };
}
function trimResponse(d: any) {
  if (Array.isArray(d)) return d.map(trimResult).filter(Boolean);
  if (d && Array.isArray(d.address) && d.centroid) {
    // /details
    return {
      osm_type: d.osm_type, osm_id: d.osm_id, category: d.category, type: d.type,
      rank_address: d.rank_address, country_code: d.country_code,
      address: d.address.map((l: any) => ({
        osm_type: l.osm_type ?? null, osm_id: l.osm_id ?? null, class: l.class, type: l.type,
        rank_address: l.rank_address, isaddress: !!l.isaddress, localname: l.localname,
      })),
    };
  }
  return trimResult(d); // /reverse
}

const toCand = (r: any): Cand => {
  const names = [r.name, ...Object.values(r.namedetails ?? {})].filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  return {
    key: shortKey(r.osm_type, r.osm_id), osmType: r.osm_type, osmId: r.osm_id,
    lat: Number(r.lat), lon: Number(r.lon), name: r.name, names: [...new Set(names)],
    category: r.category, type: r.type, addresstype: r.addresstype, cc: r.cc,
    displayName: r.display_name, importance: r.importance,
  };
};

const COMMON = "format=jsonv2&addressdetails=1&namedetails=1&accept-language=en-US";
const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();
async function search(params: Record<string, string>): Promise<Cand[]> {
  return ((await get(`${BASE}/search?${qs({ ...params, limit: "40" })}&${COMMON}`)) ?? []).map(toCand);
}
async function reverseLadder(lat: number, lon: number): Promise<Cand[]> {
  const out: Cand[] = [];
  for (const z of REVERSE_ZOOMS) {
    const r = await get(`${BASE}/reverse?lat=${lat}&lon=${lon}&zoom=${z}&${COMMON}`);
    if (r && !Array.isArray(r) && r.osm_id != null) out.push(toCand(r));
  }
  return dedupe(out);
}
async function details(c: { osmType: string; osmId: number }): Promise<AddressLine[] | null> {
  const d = await get(`${BASE}/details?osmtype=${c.osmType.charAt(0).toUpperCase()}&osmid=${c.osmId}&addressdetails=1&format=json`);
  if (!d?.address) return null;
  return d.address.map((l: any) => ({
    key: l.osm_type && l.osm_id ? shortKey(l.osm_type, l.osm_id) : null,
    category: l.class, type: l.type, rankAddress: l.rank_address, isAddress: l.isaddress, name: l.localname,
  }));
}
// Batched /lookup (≤ 50 ids per request) for coordinates + bounding boxes.
// bbox is [south, north, west, east], as Nominatim returns it.
export type Geo = { lat: number; lon: number; bbox: number[] | null; placeType: string | null };
export async function lookupGeo(keys: string[]): Promise<Map<string, Geo>> {
  const out = new Map<string, Geo>();
  const sorted = [...new Set(keys)].sort();
  for (let i = 0; i < sorted.length; i += 50) {
    const batch = sorted.slice(i, i + 50);
    const res: any[] = (await get(`${BASE}/lookup?osm_ids=${batch.join(",")}&format=jsonv2`)) ?? [];
    for (const r of res)
      out.set(shortKey(r.osm_type, r.osm_id), { lat: Number(r.lat), lon: Number(r.lon), bbox: r.boundingbox ?? null, placeType: r.addresstype ?? null });
  }
  return out;
}
export async function lookup(key: string): Promise<Cand | null> {
  const r = await get(`${BASE}/lookup?osm_ids=${key}&${COMMON}`);
  return r?.[0] ? toCand(r[0]) : null;
}

// ---------- decide ----------
type Meta = Pick<Cand, "key" | "osmType" | "osmId" | "name" | "displayName" | "cc" | "lat" | "lon" | "category" | "type" | "addresstype">;
const meta = (c: Cand): Meta => ({
  key: c.key, osmType: c.osmType, osmId: c.osmId, name: c.name, displayName: c.displayName,
  cc: c.cc, lat: c.lat, lon: c.lon, category: c.category, type: c.type, addresstype: c.addresstype,
});

export type Verdict = {
  originalId: string;
  scheme: Row["scheme"];
  name: string | null;
  countryCode: string | null;
  realUsers: number;
  status: "exact" | "samecity" | "rollup" | "consensus" | "native" | "unverified";
  reason: string;
  exact?: Meta; // the object the user actually picked
  canonical?: Meta; // where the record goes (= exact, or its containing place)
  evidence: Record<string, unknown>;
};

async function decidePin(r: Row): Promise<Verdict> {
  const base = {
    originalId: r.originalId, scheme: r.scheme, name: r.name ?? null,
    countryCode: r.countryCode?.toLowerCase() ?? null, realUsers: r.realUsers,
  };
  const pin = r.storedCoords!;
  const rec = { name: r.name, cc: r.countryCode, pin, fullName: r.fullName };
  const tried: string[] = [];
  let cands: Cand[] = [];
  let m: PinMatch = { status: "none", reason: "no candidates", nearestSameNameM: null };

  // Signals are gathered cheapest-first; each step only runs if the previous
  // ones didn't yield a match. Rules are the same whatever the source.
  let truncated = false; // a search hit its result limit: rivals may be missing
  const steps: [string, () => Promise<Cand[]>][] = [];
  const searched = async (p: Record<string, string>) => {
    const res = await search(p);
    if (res.length >= 40) truncated = true;
    return res;
  };
  if (r.name && r.countryCode) steps.push(["q+countrycodes", () => searched({ q: r.name!, countrycodes: r.countryCode!.toLowerCase() })]);
  if (r.name) steps.push(["q", () => searched({ q: r.name! })]);
  let reversed: Cand[] = [];
  steps.push(["reverse ladder", async () => (reversed = await reverseLadder(pin[0], pin[1]))]);
  for (const [label, run] of steps) {
    cands = dedupe([...cands, ...(await run())]);
    tried.push(label);
    m = matchPin(rec, cands);
    if (m.status !== "none") break;
  }
  // Truncated search: also add what reverse geocoding finds at the pin, so a
  // same-name rival sharing the centre can't hide beyond the result limit.
  if (m.status === "exact" && truncated && !tried.includes("reverse ladder")) {
    reversed = await reverseLadder(pin[0], pin[1]);
    tried.push("reverse ladder (truncated search)");
    cands = dedupe([...cands, ...reversed]);
    m = matchPin(rec, cands);
  }
  let method = "coordinate" as "coordinate" | "coordinate+reverse" | "containment" | "same-city";
  // NOTE: a "renamed" rule (accept the single place on the exact coordinate
  // whatever its name) was tried and rejected: Nominatim reuses one centre
  // point across nested objects, so it mapped "New York" → Brooklyn and
  // "Kuala Lumpur" → Cheras. A name mismatch always stays unverified.
  let containmentAmbiguous = false;
  if (m.status === "none") {
    const c = matchContainment(rec, reversed, cands);
    if (c.status !== "none") {
      m = c;
      method = "containment";
      containmentAmbiguous = c.status === "ambiguous";
    }
  }
  // Same city under another name (London ⇢ Greater London, New York ⇢ City of
  // New York): when no object matched the pin, or containment was ambiguous only
  // because a city's nested boundaries share its name (Brussels municipality +
  // Brussels-Capital Region). It needs exactly one CITY-level area of that name
  // containing the pin, so a region or a same-name neighbour never qualifies.
  if ((m.status === "none" || containmentAmbiguous) && reversed.length) {
    const c = matchSameCity(rec, reversed);
    if (c.status === "exact") {
      m = c;
      method = "same-city";
    }
  }

  if (m.status !== "exact")
    return { ...base, status: "unverified", reason: m.reason, evidence: { tried, ...m } };

  const exact = m.cand;
  // The reverse ladder at the pin: which objects Nominatim's spatial index puts
  // AT this point. Needed to corroborate 10–100m matches and to roll up.
  const atPin = async () => (reversed.length ? reversed : (reversed = await reverseLadder(pin[0], pin[1])));
  if (method === "coordinate" && m.distM > PROOF_M) {
    const keys = new Set((await atPin()).map((c) => c.key));
    if (!keys.has(exact.key) && !sameFullName(r.fullName, exact))
      return {
        ...base, status: "unverified",
        reason: `match ${m.distM.toFixed(0)}m from pin (> ${PROOF_M}m), not returned by reverse geocoding the pin, and no matching stored fullName`,
        exact: meta(exact), evidence: { tried, method, distM: Math.round(m.distM) },
      };
    method = "coordinate+reverse";
  }
  const evidence: Record<string, unknown> = {
    tried, method,
    ...(method !== "containment" ? { distM: Math.round(m.distM * 10) / 10 } : { centreDistM: Math.round(m.distM) }),
    runnerUpM: m.runnerUpM === null ? null : Math.round(m.runnerUpM),
    signals: [
      r.name ? "name" : null, r.countryCode ? "country" : null,
      method === "containment" ? "pin inside its polygon (only same-name area containing it)" : `coordinate ${m.distM.toFixed(1)}m from pin`,
      method === "coordinate+reverse" && reversed.some((c) => c.key === exact.key) ? "reverse geocoding the pin returns it" : null,
      sameFullName(r.fullName, exact) ? "stored fullName equals its display name" : null,
      m.runnerUpM === null ? "no other same-name object found" : `next same-name object ${Math.round(m.runnerUpM)}m away`,
    ].filter(Boolean),
  };
  if (method === "same-city")
    return {
      ...base, status: "samecity",
      reason: `pin is inside the only ${exact.addresstype} named like "${r.name}": "${exact.name}"`,
      exact: meta(exact), canonical: meta(exact), evidence: { tried, method, centreDistM: Math.round(m.distM) },
    };
  if (isPlaceLevel(exact.category, exact.type))
    return { ...base, status: "exact", reason: method !== "containment" ? "pin, name and country agree" : "only same-name area containing the pin; no rival nearby", exact: meta(exact), canonical: meta(exact), evidence };

  // The user picked a building / street / landuse / dwelling: roll up to the
  // smallest place Nominatim lists in that object's own address.
  const lines = await details(exact);
  const containing = new Set((await atPin()).map((c) => c.key));
  const target = lines && rollupTarget(exact.key, lines, containing);
  const parent = target?.key ? await lookup(target.key) : null;
  if (!target || !parent)
    return { ...base, status: "unverified", reason: `picked a ${exact.category}/${exact.type}; no containing area is both in its address and at the pin`, exact: meta(exact), evidence };
  return {
    ...base, status: "rollup",
    reason: `picked a ${exact.category}/${exact.type}; rolled up to its containing ${parent.addresstype}`,
    exact: meta(exact), canonical: meta(parent),
    evidence: { ...evidence, rollupRankAddress: target.rankAddress },
  };
}

async function decideLegacy(r: Row, verifiedSameName: string[]): Promise<Verdict> {
  const base = {
    originalId: r.originalId, scheme: r.scheme, name: r.name ?? null,
    countryCode: r.countryCode?.toLowerCase() ?? null, realUsers: r.realUsers,
  };
  // The legacy id itself is `cc-Name`, so it states the country even when the
  // record's countryCode attribute is missing.
  const cc = (r.countryCode ?? r.originalId.match(/^([a-z]{2})-/i)?.[1])?.toLowerCase();
  base.countryCode = cc ?? null;
  if (!r.name || !cc)
    return { ...base, status: "unverified", reason: "legacy record lacks name or country", evidence: {} };
  const structured = await search({ city: r.name, ...(r.country ? { country: r.country } : { countrycodes: cc }) });
  const freeText = await search({ q: r.name, countrycodes: cc });
  const m: LegacyMatch = matchLegacy({ name: r.name, cc, fullName: r.fullName }, structured, freeText, verifiedSameName);
  if (m.status !== "consensus") return { ...base, status: "unverified", reason: m.reason, evidence: {} };
  return { ...base, status: "consensus", reason: "all independent signals name the same place", exact: meta(m.cand), canonical: meta(m.cand), evidence: { signals: m.signals } };
}

export async function verifyAll(snapshot: Snapshot, only?: string[]): Promise<Record<string, Verdict>> {
  const rows = rowsFromSnapshot(snapshot).filter((r) => !only || only.includes(r.originalId));
  const out: Record<string, Verdict> = {};
  // Cities created after the cutover already carry an OSM id: nothing to resolve.
  for (const r of rows.filter((r) => r.scheme === "osm"))
    out[r.originalId] = {
      originalId: r.originalId, scheme: "osm", name: r.name ?? null, countryCode: r.countryCode?.toLowerCase() ?? null,
      realUsers: r.realUsers, status: "native", reason: "id is already an OSM id", evidence: {},
    };
  const pinRows = rows.filter((r) => r.scheme === "latlon");
  const legacyRows = rows.filter((r) => r.scheme === "legacy");
  console.log(`${rows.length} records: ${pinRows.length} with a pin, ${legacyRows.length} legacy. cache: ${cache.size} responses.`);

  let i = 0;
  for (const r of pinRows) {
    out[r.originalId] = await decidePin(r);
    if (++i % 50 === 0) console.log(`  pin ${i}/${pinRows.length} (fetched ${fetched})`);
  }
  // Legacy records are cross-checked against pin-verified records of the same name.
  const sameKey = (name?: string | null, cc?: string | null) => `${normName(name ?? "")}|${(cc ?? "").toLowerCase()}`;
  const verifiedBy = new Map<string, Set<string>>();
  for (const v of Object.values(out))
    if (v.status === "exact" && v.exact) {
      const k = sameKey(v.name, v.countryCode);
      (verifiedBy.get(k) ?? verifiedBy.set(k, new Set()).get(k)!).add(v.exact.key);
    }
  for (const r of legacyRows) {
    const cc = (r.countryCode ?? r.originalId.match(/^([a-z]{2})-/i)?.[1])?.toLowerCase();
    out[r.originalId] = await decideLegacy(r, [...(verifiedBy.get(sameKey(r.name, cc)) ?? [])]);
  }
  return out;
}

export function reportVerification(out: Record<string, Verdict>) {
  const vs = Object.values(out);
  const by = (s: Verdict["status"]) => vs.filter((v) => v.status === s);
  const users = (xs: Verdict[]) => xs.reduce((s, v) => s + v.realUsers, 0);
  console.log(`\nfetched ${fetched} new responses`);
  for (const s of ["exact", "samecity", "rollup", "consensus", "native", "unverified"] as const)
    console.log(`${s.padEnd(11)} ${String(by(s).length).padStart(4)} records  ${String(users(by(s))).padStart(4)} users`);
  // Calibration: how far are accepted matches from their pins, and how close is
  // the nearest competing same-name object? A clean gap justifies MATCH_M/SEP_M.
  const dists = vs.map((v) => v.evidence.distM as number | undefined).filter((d): d is number => d !== undefined).sort((a, b) => a - b);
  const q = (p: number) => dists[Math.min(dists.length - 1, Math.floor(p * dists.length))];
  console.log(`match distance m: p50=${q(0.5)} p90=${q(0.9)} p99=${q(0.99)} max=${dists.at(-1)}  (>10m: ${dists.filter((d) => d > 10).length})`);
  const runner = vs.map((v) => v.evidence.runnerUpM as number | null | undefined).filter((d): d is number => typeof d === "number").sort((a, b) => a - b);
  console.log(`nearest competing same-name object m: min=${runner[0]} p01=${runner[Math.floor(0.01 * runner.length)]}`);
  const nearMiss = vs.filter((v) => v.status === "unverified" && typeof v.evidence.nearestSameNameM === "number").map((v) => Math.round(v.evidence.nearestSameNameM as number)).sort((a, b) => a - b);
  console.log(`unverified: nearest same-name object m: ${nearMiss.slice(0, 15).join(", ")}${nearMiss.length > 15 ? " …" : ""}`);
}

if (typeof require !== "undefined" && require.main === module) {
  (async () => {
    const snapshot: Snapshot = JSON.parse(readFileSync(process.env.SNAPSHOT ?? "./citySnapshot.json", "utf8"));
    const only = process.env.ONLY?.split(";");
    const out = await verifyAll(snapshot, only);
    if (!only) writeFileSync(OUT, JSON.stringify(out, null, 2));
    else console.log(JSON.stringify(out, null, 2));
    reportVerification(out);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
