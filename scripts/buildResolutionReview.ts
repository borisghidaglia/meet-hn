// Builds review candidates for records whose backfill match landed far from the
// user's original pin (a sign structured `city=` search couldn't find the exact
// object they picked — e.g. a building or street). For each, we reverse-geocode
// the pin to recover what is ACTUALLY there, so you can eyeball forward-vs-pin in
// the review UI. READ-ONLY on DynamoDB. Writes ./cityResolutionReview.json.
//
//   npm run script scripts/buildResolutionReview.ts
//
// Threshold: forward match > FAR_KM from the stored pin.

import { existsSync, readFileSync, writeFileSync } from "fs";

const OSM = "./cityOsm.json";
const OUT = "./cityResolutionReview.json";
const UA = "meet.hn-resolution-review/1.0 (hi@meet.hn)";
const FAR_KM = 10;

type Osm = { osmType: string; osmId: number; addresstype: string; fullName: string; lat: number; lon: number };
type Row = {
  originalId: string; name?: string; country?: string; realUsers: number;
  storedCoords: [number, number] | null; matchDistanceKm: number | null;
  osm: Osm | null;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isValid = (r: any) => r && r.osm_id != null && typeof r.osm_type === "string";
const toOsm = (r: any): Osm => ({
  osmType: r.osm_type, osmId: r.osm_id, addresstype: r.addresstype,
  fullName: r.display_name, lat: Number(r.lat), lon: Number(r.lon),
});

// Reverse-geocode the pin at several zooms to recover the full admin ladder at
// that point — country, state, county, town/suburb — so a user who picked a
// whole region/country can be tied to exactly the level they chose, not a town.
const LADDER_ZOOMS = [3, 5, 8, 10, 14];
async function reverseAt(lat: number, lon: number, zoom: number): Promise<Osm | null> {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&zoom=${zoom}&format=json&addressdetails=1&accept-language=en-US`,
    { headers: { "User-Agent": UA } },
  ).then((x) => x.json());
  return isValid(r) ? toOsm(r) : null;
}
async function pinLadder(lat: number, lon: number): Promise<Osm[]> {
  const seen = new Set<string>();
  const out: Osm[] = [];
  for (const z of LADDER_ZOOMS) {
    let o: Osm | null = null;
    try { o = await reverseAt(lat, lon, z); } catch { /* skip */ }
    await wait(1100);
    if (!o) continue;
    const k = `${o.osmType}/${o.osmId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

async function main() {
  const rows: Row[] = Object.values(JSON.parse(readFileSync(OSM, "utf8")));
  const suspects = rows.filter(
    (r) => r.osm && r.storedCoords && (r.matchDistanceKm ?? 0) > FAR_KM,
  );
  const out: Record<string, any> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  console.log(`${suspects.length} records with forward match > ${FAR_KM}km. ${Object.keys(out).length} already done.`);

  let i = 0;
  for (const r of suspects.sort((a, b) => (b.matchDistanceKm ?? 0) - (a.matchDistanceKm ?? 0))) {
    i++;
    if (out[r.originalId]) continue;
    const [lat, lon] = r.storedCoords!;
    const ladder = await pinLadder(lat, lon);
    // Candidates = the by-name match (forward) + the admin ladder at the pin,
    // deduped. Each tagged so the UI can show country/state/town etc.
    const byKey = new Map<string, any>();
    byKey.set(`${r.osm!.osmType}/${r.osm!.osmId}`, { ...r.osm, source: "name" });
    for (const o of ladder) {
      const k = `${o.osmType}/${o.osmId}`;
      if (!byKey.has(k)) byKey.set(k, { ...o, source: "pin" });
    }
    out[r.originalId] = {
      originalId: r.originalId, name: r.name, country: r.country,
      realUsers: r.realUsers, pin: r.storedCoords, matchDistanceKm: r.matchDistanceKm,
      candidates: [...byKey.values()],
    };
    writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.log(`${i}/${suspects.length} ${r.name} (${Math.round(r.matchDistanceKm ?? 0)}km) → ${[...byKey.values()].map((c: any) => c.addresstype).join(", ")}`);
  }
  console.log(`\n→ ${OUT}`);
}

main();
