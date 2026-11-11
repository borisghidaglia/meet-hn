// Records what a newcomer sees when searching each merged page's name, for the
// replay test app/_lib/searchRoundTrip.test.ts. Re-run after the pipeline:
//
//   npm run script scripts/recordSearchRoundTrip.ts
//
// Reads cityAliases.json (committed plan) + Nominatim. No DynamoDB access.

import { readFileSync, writeFileSync } from "fs";

import { pickerSearchUrl } from "../app/_lib/nominatim";
import { lookupGeo } from "./verifyOsm";

const OUT = "./app/_lib/__fixtures__/searchRoundTrip.json";
const UA = "meet.hn city verification (https://meet.hn)";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Pages people complained about, recorded even if the plan doesn't merge them.
const ALWAYS = ["Toulouse", "Paris", "London", "New York", "Tokyo", "Berlin"];

// Only the fields toPlace() and the picker read: the replay runs the real code.
const slim = (r: any) => ({
  osm_type: r.osm_type, osm_id: r.osm_id, name: r.name, display_name: r.display_name, lat: r.lat, lon: r.lon,
  boundingbox: r.boundingbox, addresstype: r.addresstype,
  address: { country: r.address?.country, country_code: r.address?.country_code, state: r.address?.state },
  extratags: r.extratags?.wikidata ? { wikidata: r.extratags.wikidata } : {},
});

async function main() {
  const { canonicals } = JSON.parse(readFileSync("./cityAliases.json", "utf8"));
  const pages = Object.values<any>(canonicals).filter((p) => p.users > 0);
  const geo = await lookupGeo(pages.filter((p) => p.isOsm).map((p) => p.id));
  const directory = pages.map((p) => {
    const g = geo.get(p.id);
    return {
      id: p.id, name: p.name ?? "", fullName: p.fullName ?? "", countryCode: p.countryCode ?? undefined,
      lat: g?.lat ?? p.lat, lon: g?.lon ?? p.lon, bbox: g?.bbox?.map(Number) ?? p.bbox ?? null,
      placeType: g?.placeType ?? p.placeType ?? null, state: g?.state ?? null, wikidata: g?.wikidata ?? null,
    };
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  const targets = pages
    .filter((p) => p.isOsm && p.name && (p.fromRecords.length > 1 || ALWAYS.includes(p.name)))
    .sort((a, b) => b.users - a.users);
  const searches = [];
  for (const t of targets) {
    await wait(1100);
    const res = await fetch(pickerSearchUrl(t.name), { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`search ${t.name}: HTTP ${res.status}`);
    searches.push({ pageId: t.id, query: t.name, results: ((await res.json()) as any[]).map(slim) });
    process.stdout.write(".");
  }
  writeFileSync(OUT, JSON.stringify({ recordedAt: new Date().toISOString(), directory, searches }, null, 1) + "\n");
  console.log(`\n${searches.length} searches, ${directory.length} pages → ${OUT}`);
}

main();
