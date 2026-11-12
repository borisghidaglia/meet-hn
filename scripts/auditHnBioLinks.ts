// Finds every meet.hn link in users' HN "about" (cached by fetchHnAbouts.ts),
// checks which resolve on production today and which would after the city
// migration, and maps every dead one to a page. Writes the mapping (no
// usernames) to ./cityLegacyLinks.json, which migrateCityIdentity.ts turns into
// REDIRECT items.
//
//   npm run script scripts/auditHnBioLinks.ts -- --table=<live table> --dry-run=<migrations/dry-run-*.json>
//
// Read-only: one Scan of the table, plus local files.

import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { readFileSync, writeFileSync } from "fs";

import { distanceKm, REGION_TYPES } from "../app/_lib/nearby";
import { normName, sameCityName } from "../app/_lib/placeNames";
import { docClient } from "./common";
import { readHnCache } from "./fetchHnAbouts";

type Item = Record<string, any> & { entityType: string; entityId: string };
export type Format = "query ?city=" | "city/cc-Name" | "city/lat,lon" | "city/osm" | "home" | "other page";
// `tail`: the words after a link up to the end of its line. The old ids held
// spaces (us-Fort Collins); written in a bio, the link stops at the first one.
export type Link = { raw: string; format: Format; id?: string; slug?: string; tail?: string[] };

// ---------- extraction ----------

const decodeEntities = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
const LINK = /(?:https?:\/\/)?(?:www\.)?meet\.hn(?![\w-])((?:[/?#][^\s"<>]*)?)/gi;

export function extractLinks(aboutHtml: string): Link[] {
  // hrefs carry the full URL (HN truncates long link text); the text covers unlinked mentions.
  const html = aboutHtml.replace(/<p>/g, "\n");
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => decodeEntities(m[1] ?? ""));
  const text = decodeEntities(html.replace(/<a [^>]*>[^<]*<\/a>/g, " ").replace(/<[^>]+>/g, " "));
  const seen = new Map<string, Link>();
  for (const src of [...hrefs, text])
    for (const m of src.matchAll(LINK)) {
      const path = (m[1] ?? "").replace(/[.,;:!?)\]}*'"]+$/, "");
      const l: Link = { ...classify(path), raw: `meet.hn${path}` };
      const rest = src.slice(m.index! + m[0].length).split("\n")[0] ?? "";
      if (l.format === "city/cc-Name" && !l.slug && /^ \S/.test(rest))
        l.tail = rest.trim().split(/\s+/).slice(0, 5).map((w) => w.replace(/[.,;:!?)\]}*]+$/, ""));
      const key = `${l.format}|${l.id ?? path}`;
      if (!seen.has(key)) seen.set(key, l);
    }
  return [...seen.values()];
}

export function classify(path: string): Omit<Link, "raw"> {
  const q = path.match(/^\/?\?(?:.*&)?city=([^&#]+)/);
  if (q) return { format: "query ?city=", id: safeDecode(q[1]!.replace(/\+/g, " ")) };
  const c = path.match(/^\/city\/([^/?#]+)(?:\/([^?#]*))?/);
  if (c) {
    const id = safeDecode(c[1]!);
    const slug = c[2] ? safeDecode(c[2]) : undefined;
    if (/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(id)) return { format: "city/lat,lon", id, slug };
    if (/^[NWR]\d+$/.test(id)) return { format: "city/osm", id, slug };
    return { format: "city/cc-Name", id, slug };
  }
  return path.replace(/[/#]/g, "") === "" ? { format: "home" } : { format: "other page" };
}

// ---------- mapping a dead id to a live page ----------

type LiveCity = { id: string; name: string; cc: string; lat?: number; lon?: number };
const coords = (id: string) => {
  const m = id.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  return m ? { lat: Number(m[1]), lon: Number(m[2]) } : undefined;
};
const loose = (s: string) => normName(s.replace(/[-_+]/g, " "));
const nameFits = (linkName: string, c: LiveCity) => !!c.name && (
  loose(linkName) === loose(c.name) || sameCityName(linkName.replace(/[-_+]/g, " "), c.name));

export type Mapping =
  | { to: string; how: string; owners: number; ownersAgree: boolean; fullId?: string }
  | { to: null; why: string; owners: number; candidates: string[] };

// `finalOf` follows the migration (record id → page after migration).
// `ownerPages` = pages (after migration) where the bio owners live now.
// Old ids used "uk" for Great Britain once in a while (ISO is "gb").
const CC_ALIAS: Record<string, string> = { uk: "gb" };

// `isRegionPage`: the page after migration is a state/province/county/country.
export function mapDeadId(link: Link, cities: LiveCity[], finalOf: (id: string) => string, ownerPages: string[], isRegionPage: (id: string) => boolean = () => false): Mapping {
  const owners = ownerPages.length;
  let cands: LiveCity[] = [];
  let basis = "";
  let fullId: string | undefined;
  if (link.format === "city/lat,lon") {
    const p = coords(link.id!)!;
    const named = link.slug && !/^\d+$/.test(link.slug) ? link.slug.split("/")[0] : undefined;
    // Same pin at another precision (36.7960087,-4.5473784 vs …,-4.547378378829243) first.
    const samePin = cities.filter((c) => c.lat !== undefined && distanceKm(p, c as any) <= 0.01);
    const near = cities.filter((c) => c.lat !== undefined && distanceKm(p, c as any) <= (named ? 25 : 2));
    cands = samePin.length ? samePin : named ? near.filter((c) => nameFits(named, c)) : near;
    basis = samePin.length ? "same pin (≤ 10 m)" : named ? "same name within 25 km" : "within 2 km";
  } else if (link.id) {
    // Longest reading first: "us-Fort" + "Collins …" → "us-Fort Collins".
    const hasCc = /^[a-z]{2}-./i.test(link.id);
    const tail = link.tail ?? [];
    for (let n = tail.length; n >= 0 && !cands.length; n--) {
      const id = [link.id, ...tail.slice(0, n)].join(" ");
      const name = hasCc ? id.slice(3) : id;
      const cc = id.slice(0, 2).toLowerCase();
      cands = cities.filter((c) => (!hasCc || c.cc === (CC_ALIAS[cc] ?? cc)) && nameFits(name, c));
      basis = hasCc ? "same name and country" : "same name (no country in link)";
      if (cands.length && n > 0) { basis += `, name continues after the link ("${id}")`; fullId = id; }
    }
  }
  const pages = [...new Set(cands.map((c) => finalOf(c.id)))];
  const agree = (to: string) => owners > 0 && ownerPages.every((o) => o === to);
  const [only] = pages;
  if (only && pages.length === 1) return { to: only, how: basis, owners, ownersAgree: agree(only), fullId };
  if (pages.length > 1) {
    const byOwner = pages.filter((p) => ownerPages.includes(p));
    // Old ids took the city name first, the province only when there was none
    // ("ar-Buenos-Aires"): the one city among regions wins, before any owner.
    const places = pages.filter((p) => !isRegionPage(p));
    const [city] = places;
    if (city && places.length === 1)
      return { to: city, how: `${basis}, the one city among ${pages.length} (others are regions)`, owners, ownersAgree: agree(city), fullId };
    const [mine] = byOwner;
    if (mine && byOwner.length === 1) return { to: mine, how: `${basis}, owner's page among ${pages.length}`, owners, ownersAgree: agree(mine), fullId };
    return { to: null, why: `${pages.length} pages fit (${basis}), owners don't settle it`, owners, candidates: pages };
  }
  return { to: null, why: link.id ? "no page fits the name/place" : "no id", owners, candidates: [...new Set(ownerPages)] };
}

// ---------- main ----------

async function scanAll(table: string): Promise<Item[]> {
  const items: Item[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;
  do {
    const r = await docClient.send(new ScanCommand({ TableName: table, ExclusiveStartKey }));
    items.push(...((r.Items ?? []) as Item[]));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function main() {
  const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  const table = arg("table");
  const dryRunPath = arg("dry-run");
  if (!table || !dryRunPath) throw new Error("usage: --table=<name> --dry-run=<migrations/dry-run-*.json>");

  const items = await scanAll(table);
  const dry = JSON.parse(readFileSync(dryRunPath, "utf8"));
  if (dry.table !== table) throw new Error(`dry run is for ${dry.table}`);

  const liveCity = new Map(items.filter((i) => i.entityType === "CITY").map((c) => [c.entityId, c]));
  const users = new Map(items.filter((i) => i.entityType === "USER").map((u) => [u.entityId, u]));
  // After migration: live CITY ids minus deletes, plus creates; redirects from the plan and the table.
  const redirectTo = new Map<string, string>(items.filter((i) => i.entityType === "REDIRECT").map((r) => [r.entityId, r.to]));
  // Redirects this audit produced (a dry run that already read cityLegacyLinks.json)
  // are left out: they are what we recompute, not something the plan provides.
  for (const r of dry.ops.redirectPuts)
    if (r.item.reason !== "hn-bio-legacy-link") redirectTo.set(r.item.entityId, r.item.to);
  const pagesAfter = new Set([...liveCity.keys()]);
  for (const d of dry.ops.cityDeletes) pagesAfter.delete(d.before.entityId);
  for (const c of dry.ops.cityPuts) pagesAfter.add(c.item.entityId);
  const finalOf = (id: string) => (pagesAfter.has(id) ? id : (redirectTo.get(id) ?? id));
  const resolvesAfter = (id: string) => pagesAfter.has(id) || pagesAfter.has(redirectTo.get(id) ?? "");
  const userCityAfter = new Map<string, string>([...users.values()].map((u) => [u.entityId, u.cityId && finalOf(u.cityId)]));
  for (const m of dry.ops.userMoves) userCityAfter.set(m.username, m.to);

  const placeTypeAfter = new Map<string, string | undefined>([...liveCity.values()].map((c) => [c.entityId, c.placeType]));
  for (const c of dry.ops.cityPuts) placeTypeAfter.set(c.item.entityId, c.item.placeType);
  const isRegionPage = (id: string) => REGION_TYPES.has(placeTypeAfter.get(id) ?? "");
  const cities: LiveCity[] = [...liveCity.values()].map((c) => ({
    id: c.entityId, name: c.name, cc: (c.countryCode ?? "").toLowerCase(),
    ...(typeof c.lat === "number" ? { lat: c.lat, lon: c.lon } : (coords(c.entityId) ?? {})),
  }));

  const bios = readHnCache();
  type Row = Link & { username: string; today: boolean; after: boolean };
  const rows: Row[] = [];
  let fetched = 0, missing = 0, withLinks = 0;
  for (const username of users.keys()) {
    const b = bios.get(username);
    if (!b) continue;
    fetched++;
    if (b.missing) { missing++; continue; }
    const links = extractLinks(b.about ?? "").filter((l) => l.format !== "home" && l.format !== "other page");
    if (links.length) withLinks++;
    for (const l of links) {
      // Production's home page ignores ?city= (removed in Sept 2024), so those land on the map, not the city.
      const today = l.format !== "query ?city=" && liveCity.has(l.id!);
      rows.push({ ...l, username, today, after: resolvesAfter(l.id!) });
    }
  }

  // Map each distinct dead-after id once.
  const deadIds = [...new Set(rows.filter((r) => !r.after).map((r) => r.id!))];
  const mappings: Record<string, Mapping> = {};
  for (const id of deadIds) {
    // Each link on its own (a cut-off "us-New" may be New York in one bio, New Orleans in another).
    const rs = rows.filter((r) => r.id === id);
    const ms = rs.map((r) => mapDeadId(r, cities, finalOf, [userCityAfter.get(r.username)].filter((x): x is string => !!x), isRegionPage));
    const targets = new Set(ms.map((m) => m.to));
    const ok = ms.filter((m): m is Extract<Mapping, { to: string }> => !!m.to);
    mappings[id] = targets.size === 1
      ? { ...ms[0], owners: ms.length, ...(ok.length ? { ownersAgree: ok.every((m) => m.ownersAgree) } : {}) } as Mapping
      : { to: null, why: `links disagree: ${[...targets].map((t) => t ?? "none").join(" / ")}`, owners: ms.length, candidates: ok.map((m) => m.to) };
    // The full spaced id ("us-Fort Collins", as stored before) gets its own redirect.
    for (const m of ok) if (m.fullId && !resolvesAfter(m.fullId)) mappings[m.fullId] ??= { ...m, fullId: undefined };
  }

  const committed: Record<string, { to: string; how: string; links: number; ownersAgree: boolean }> = {};
  for (const [id, m] of Object.entries(mappings))
    if (m.to) committed[id] = { to: m.to, how: m.how, links: rows.filter((r) => r.id === id).length, ownersAgree: m.ownersAgree };
  const unmappable = Object.entries(mappings).filter(([, m]) => !m.to);
  writeFileSync("./cityLegacyLinks.json", JSON.stringify({
    note: "Dead meet.hn ids found in HN bios, mapped to their page after the city migration (scripts/auditHnBioLinks.ts). migrateCityIdentity.ts writes one REDIRECT per entry.",
    generatedAt: new Date().toISOString(),
    redirects: Object.fromEntries(Object.entries(committed).sort()),
    unmappable: Object.fromEntries(unmappable.map(([id, m]) => [id, (m as any).why])),
  }, null, 1) + "\n");

  // ---------- report ----------
  const formats = [...new Set(rows.map((r) => r.format))];
  const fixed = (r: Row) => !r.after && !!mappings[r.id!]?.to;
  console.log(`bios: ${fetched}/${users.size} users fetched (${missing} not on HN), ${withLinks} with a meet.hn city link, ${rows.length} links`);
  console.log(`\n${"format".padEnd(16)} links  dead-today  ok-after-migration  fixed-by-new-redirects  still-dead`);
  for (const f of [...formats, "ALL"]) {
    const rs = f === "ALL" ? rows : rows.filter((r) => r.format === f);
    console.log(`${f.padEnd(16)} ${String(rs.length).padStart(5)}  ${String(rs.filter((r) => !r.today).length).padStart(10)}  ${String(rs.filter((r) => r.after).length).padStart(18)}  ${String(rs.filter(fixed).length).padStart(22)}  ${String(rs.filter((r) => !r.after && !fixed(r)).length).padStart(10)}`);
  }
  const wrongOwner = Object.entries(committed).filter(([, c]) => !c.ownersAgree);
  console.log(`\nnew redirects: ${Object.keys(committed).length} ids (${wrongOwner.length} where an owner now lives elsewhere)`);
  for (const [id, c] of Object.entries(committed).slice(0, 8)) console.log(`  ${id} → ${c.to}  (${c.how}; ${c.links} link${c.links > 1 ? "s" : ""})`);
  console.log(`unmappable: ${unmappable.length} ids, ${rows.filter((r) => !r.after && !fixed(r)).length} links`);
  for (const [id, m] of unmappable) console.log(`  ${id}: ${(m as any).why}${(m as any).candidates?.length ? ` [${(m as any).candidates.join(", ")}]` : ""}`);
  writeFileSync("./migrations/hnBioLinkAudit.json", JSON.stringify({ rows, mappings }, null, 1));
  console.log(`\nmapping → ./cityLegacyLinks.json, per-link detail → ./migrations/hnBioLinkAudit.json (has usernames, gitignored)`);
}

if (typeof require !== "undefined" && require.main === module) main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
