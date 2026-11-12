// Pages created from a house address or a postcode (sign-ups before November
// 2026 saved Nominatim's raw name: "" for an address, "90066" for a postcode)
// show "1 hacker in , Switzerland". Each one goes to the city containing its
// pin (Nominatim reverse at city level, as the sign-up now does): users moved,
// the old id redirected (one hop, existing redirects follow), the old record
// deleted. When that city has no page yet, it is created. A record with no
// users and no city page is only deleted.
//
//   dry run (default, read-only: Scan + Nominatim, refuses any write):
//     npm run script scripts/fixPlaceLabels.ts -- --table=<name>
//   apply (journals every original item BEFORE writing):
//     npm run script scripts/fixPlaceLabels.ts -- --table=<name> --apply --confirm=<name>
//   roll back an apply:
//     npm run script scripts/fixPlaceLabels.ts -- --table=<name> --rollback=<journal.json> --confirm=<name>
//
// Then revalidate the site caches (printed at the end of an apply).

import { existsSync, mkdirSync, writeFileSync } from "fs";

import { Place, reverseCityUrl, toPlace } from "../app/_lib/nominatim";
import { isPagePlace } from "../app/_lib/placeLevel";
import { Directory, redirectWrites, resolvePlace } from "../app/_lib/resolvePlace";
import { Item, Ops, tableOps } from "./cityOps";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const flag = (k: string) => process.argv.includes(`--${k}`);
const TABLE = arg("table");
const MODE: "dry-run" | "apply" | "rollback" = arg("rollback") ? "rollback" : flag("apply") ? "apply" : "dry-run";
if (!TABLE) {
  console.error("usage: --table=<name> [--apply --confirm=<name> | --rollback=<journal> --confirm=<name>]");
  process.exit(2);
}
if (MODE !== "dry-run" && arg("confirm") !== TABLE) {
  console.error(`${MODE} writes to ${TABLE}: pass --confirm=${TABLE}`);
  process.exit(2);
}
const { scanAll, apply, rollback } = tableOps(TABLE, MODE);

const UA = { headers: { "User-Agent": "meet.hn (https://meet.hn)" } };
async function containingCity(lat: number, lon: number): Promise<Place | null> {
  await new Promise((r) => setTimeout(r, 1100)); // Nominatim: at most 1 request/s
  const res = await fetch(reverseCityUrl(lat, lon), UA);
  if (!res.ok) throw new Error(`Nominatim reverse ${lat},${lon}: HTTP ${res.status}`);
  const r = await res.json();
  return r?.error ? null : toPlace(r);
}

// The page record for a place (the fields app/_db/Place.ts placeToCity writes).
const cityItem = (p: Place, createdAt: number, communityLinks?: unknown): Item => ({
  entityType: "CITY", entityId: p.id, id: p.id, name: p.name, fullName: p.fullName, hackers: 0, createdAt,
  lat: p.lat, lon: p.lon,
  ...(p.country ? { country: p.country } : {}), ...(p.countryCode ? { countryCode: p.countryCode } : {}),
  ...(p.bbox ? { bbox: p.bbox } : {}), ...(p.placeType ? { placeType: p.placeType } : {}),
  ...(p.state ? { state: p.state } : {}), ...(p.wikidata ? { wikidata: p.wikidata } : {}),
  ...(communityLinks ? { communityLinks } : {}),
});

// A stored page whose label names no place.
export const isBrokenPage = (c: Item) =>
  !isPagePlace({ id: c.entityId, name: typeof c.name === "string" ? c.name : "", fullName: c.fullName ?? "", placeType: c.placeType, lat: c.lat, lon: c.lon });

type Row = { id: string; name: string | null; users: number; action: string; target: string | null; targetName: string | null };

async function plan(items: Item[]) {
  const cities = new Map(items.filter((i) => i.entityType === "CITY").map((i) => [i.entityId, i]));
  const redirectItems = new Map(items.filter((i) => i.entityType === "REDIRECT").map((i) => [i.entityId, i]));
  const redirects = new Map([...redirectItems].map(([k, v]) => [k, v.to as string]));
  // The sign-up's view of the live pages, so a city without a page of its own
  // still joins the page sign-up would send it to (same Wikidata, label…).
  const asPlace = (c: Item): Place => ({
    id: c.entityId, name: c.name ?? "", fullName: c.fullName ?? "", country: c.country, countryCode: c.countryCode,
    state: c.state ?? null, lat: c.lat, lon: c.lon, bbox: c.bbox ?? null, placeType: c.placeType ?? null, wikidata: c.wikidata ?? null,
  });
  const located = [...cities.values()].filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && !isBrokenPage(c)).map(asPlace);
  const byId = new Map(located.map((p) => [p.id, p]));
  const dir: Directory = { page: (id) => byId.get(id), redirect: (id) => redirects.get(id), pages: located };
  const usersOf = (id: string) => items.filter((i) => i.entityType === "USER" && i.cityId === id);
  const ops: Ops = { cityPuts: [], redirectPuts: [], userMoves: [], cityDeletes: [] };
  const rows: Row[] = [];
  const now = Date.now();

  for (const old of [...cities.values()].filter(isBrokenPage)) {
    const users = usersOf(old.entityId);
    const row: Row = { id: old.entityId, name: old.name ?? null, users: users.length, action: "", target: null, targetName: null };
    rows.push(row);
    if (!Number.isFinite(old.lat) || !Number.isFinite(old.lon)) { row.action = "SKIP: no coordinates"; continue; }
    const city = await containingCity(old.lat, old.lon);
    if (!city || !isPagePlace(city)) { row.action = "SKIP: no containing city"; continue; }
    if (city.id === old.entityId) { row.action = "SKIP: is its own city"; continue; }

    // The page that city lands on now: itself, its redirect target, or a page this run creates.
    const r = resolvePlace(city, dir);
    const live = r.kind === "new" ? null : r.pageId;
    const planned = ops.cityPuts.find((c) => c.item.entityId === (live ?? city.id));
    let to: string;
    if (live) {
      to = live;
      if (!planned) ops.cityPuts.push({ item: cities.get(live)!, before: cities.get(live)!, why: "merge" }); // recounted on apply
      row.action = users.length ? `merge into existing page` : "redirect to existing page";
    } else if (planned || users.length) {
      to = city.id;
      if (!planned) ops.cityPuts.push({ item: cityItem(city, old.createdAt, old.communityLinks), before: null, why: "create" });
      row.action = "move to a new page for its city";
    } else {
      ops.cityDeletes.push({ before: old });
      row.action = "delete (no users, no page for its city)";
      row.target = city.id; row.targetName = city.name;
      continue;
    }
    row.target = to; row.targetName = (cities.get(to)?.name as string) ?? city.name;
    for (const u of users) ops.userMoves.push({ username: u.entityId, from: old.entityId, to });
    const reason = `page from an address/postcode pick (name ${JSON.stringify(old.name ?? null)}) → its city ${city.id}`;
    for (const w of redirectWrites(old.entityId, to, redirects)) {
      ops.redirectPuts.push({ item: { entityType: "REDIRECT", entityId: w.from, to: w.to, reason, createdAt: now }, before: redirectItems.get(w.from) ?? null });
      redirects.set(w.from, w.to);
    }
    ops.cityDeletes.push({ before: old });
  }
  return { ops, rows };
}

async function main() {
  if (MODE === "rollback") return rollback(arg("rollback")!);
  const items = await scanAll();
  const { ops, rows } = await plan(items);
  console.log(`\n${MODE} against ${TABLE}: ${rows.length} pages whose label names no place`);
  for (const r of rows)
    console.log(`  ${r.id.padEnd(40)} ${JSON.stringify(r.name).padEnd(8)} users ${r.users}  ${r.action}${r.target ? ` → ${r.target} ${r.targetName}` : ""}`);
  console.log(`  writes: ${ops.cityPuts.filter((c) => !c.before).length} new pages, ${ops.cityPuts.filter((c) => c.before).length} existing pages recounted, ${ops.userMoves.length} users moved, ${ops.redirectPuts.length} redirects, ${ops.cityDeletes.length} pages deleted`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync("./migrations", { recursive: true });
  writeFileSync(`./migrations/fix-place-labels-${MODE}-${stamp}.json`, JSON.stringify({ table: TABLE, rows, ops }, null, 1));
  if (MODE === "dry-run") return console.log(`\ndry run: nothing written. Details → ./migrations/fix-place-labels-${MODE}-${stamp}.json`);
  const journal = `./migrations/journal-fix-place-labels-${stamp}.json`;
  if (existsSync(journal)) throw new Error(`${journal} exists`);
  await apply(ops, journal);
  const tags = [...new Set([...ops.cityDeletes.map((d) => d.before.entityId), ...ops.cityPuts.map((c) => c.item.entityId)])];
  console.log(`\nthen: npm run script scripts/revalidateTags.ts -- cities redirects ${tags.flatMap((t) => [t, `${t}-users`]).join(" ")}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
