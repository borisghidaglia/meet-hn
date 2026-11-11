// READ-ONLY on DynamoDB. For every city record, re-query Nominatim to recover a
// STABLE identity (osm_type + osm_id) plus repaired metadata (fullName,
// addresstype, fresh lat/lon). Writes results to ./cityOsm.json at the repo root
// — it does NOT modify DynamoDB. Resumable: re-running skips ids already in the
// output file, so a crash/rate-limit mid-run isn't fatal.
//
//   npm run script scripts/backfillOsm.ts
//
// Strategy per record:
//   - lat,lon id  → forward-search by `name [country]`, pick the result whose
//                   coords are NEAREST the stored point (reconstructs the exact
//                   object the user originally selected: city vs suburb etc.).
//   - legacy id   → forward-search by `name [country]`, take the first result.
//   - no name     → reverse-geocode the stored coordinate.
// Nominatim policy: max 1 req/s + a real User-Agent. ~1071 cities ≈ 20 min.

import { existsSync, readFileSync, writeFileSync } from "fs";

import { City, DbUser } from "@/app/_db/schema";
import { getAllCities, getAllUsers } from "./common";

const OUT = "./cityOsm.json";
const UA = "meet.hn-osm-backfill/1.0 (hi@meet.hn)";
const DELAY_MS = 1100;

type Osm = {
  osmType: string;
  osmId: number;
  addresstype: string;
  fullName: string;
  lat: number;
  lon: number;
};

type Row = {
  originalId: string;
  scheme: "latlon" | "legacy";
  name?: string;
  country?: string;
  countryCode?: string;
  storedHackers: number;
  realUsers: number;
  storedCoords: [number, number] | null;
  osm: Osm | null;
  matchDistanceKm: number | null; // distance osm result ↔ stored coord
  note?: string;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseCoords(id: string): [number, number] | null {
  const m = id?.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// A usable result must carry a stable OSM identity.
const isValid = (r: any) => r && r.osm_id != null && typeof r.osm_type === "string";
const PLACE_TYPES = new Set([
  "city",
  "town",
  "village",
  "municipality",
  "suburb",
  "administrative",
]);

function toOsm(r: any): Osm {
  return {
    osmType: r.osm_type,
    osmId: r.osm_id,
    addresstype: r.addresstype,
    fullName: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
  };
}

async function nominatim(url: string): Promise<any[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

async function resolve(
  name: string | undefined,
  country: string | undefined,
  coords: [number, number] | null,
): Promise<{ osm: Osm | null; dist: number | null; note?: string }> {
  // No name → reverse geocode the coordinate.
  if (!name) {
    if (!coords) return { osm: null, dist: null, note: "no name, no coords" };
    const [lat, lon] = coords;
    const r = (
      await nominatim(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=en-US`,
      )
    )[0];
    return isValid(r)
      ? { osm: toOsm(r), dist: 0, note: "reverse" }
      : { osm: null, dist: null, note: "reverse: no result" };
  }

  // STRUCTURED search (city=&country=) is far more reliable than free-text q=,
  // which can match unrelated POIs (e.g. "Buenos Aires Argentina" → a Milan café).
  const params = new URLSearchParams({
    city: name,
    format: "json",
    limit: "10",
    addressdetails: "1",
    "accept-language": "en-US",
  });
  if (country) params.set("country", country);
  let results = (
    await nominatim(`https://nominatim.openstreetmap.org/search?${params}`)
  ).filter(isValid);

  // Fallback: if structured search finds nothing, reverse-geocode the coordinate.
  if (!results.length && coords) {
    const [lat, lon] = coords;
    const r = (
      await nominatim(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=en-US`,
      )
    )[0];
    return isValid(r)
      ? { osm: toOsm(r), dist: 0, note: "reverse fallback" }
      : { osm: null, dist: null, note: "no structured + no reverse" };
  }
  if (!results.length) return { osm: null, dist: null, note: "search: no result" };

  // lat,lon record → pick the valid result nearest the stored coordinate.
  if (coords) {
    let best = results[0];
    let bestDist = Infinity;
    for (const r of results) {
      const d = haversineKm(coords, [Number(r.lat), Number(r.lon)]);
      if (d < bestDist) {
        bestDist = d;
        best = r;
      }
    }
    return { osm: toOsm(best), dist: bestDist };
  }

  // legacy record (no coords) → prefer a place-type result, else the first.
  const preferred = results.find((r) => PLACE_TYPES.has(r.addresstype)) ?? results[0];
  return { osm: toOsm(preferred), dist: null, note: "legacy: structured first" };
}

async function main() {
  const [cities, users] = await Promise.all([getAllCities(), getAllUsers()]);

  const realUsersByCity = new Map<string, number>();
  for (const u of users as DbUser[])
    realUsersByCity.set(u.cityId, (realUsersByCity.get(u.cityId) ?? 0) + 1);

  const out: Record<string, Row> = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, "utf8"))
    : {};
  const done = new Set(Object.keys(out));
  console.log(`${cities.length} cities, ${done.size} already done.`);

  let i = 0;
  for (const c of cities as City[]) {
    i++;
    const id = c.id ?? (c as unknown as { entityId: string }).entityId;
    if (done.has(id)) continue;

    const coords = parseCoords(id);
    // Legacy ids look like `cc-City-Name`; if the record lost its `name`
    // attribute, recover it from the id (e.g. "pl-Kraków" → "Kraków").
    const name =
      c.name ??
      (!coords && id.includes("-")
        ? id.split("-").slice(1).join(" ").trim() || undefined
        : undefined);
    const row: Row = {
      originalId: id,
      scheme: coords ? "latlon" : "legacy",
      name,
      country: c.country,
      countryCode: c.countryCode,
      storedHackers: c.hackers ?? 0,
      realUsers: realUsersByCity.get(id) ?? 0,
      storedCoords: coords,
      osm: null,
      matchDistanceKm: null,
    };

    try {
      const { osm, dist, note } = await resolve(name, c.country, coords);
      row.osm = osm;
      row.matchDistanceKm = dist;
      if (note) row.note = note;
    } catch (e: any) {
      row.note = `error: ${e.message}`;
    }

    out[id] = row;
    writeFileSync(OUT, JSON.stringify(out, null, 2)); // incremental save
    console.log(
      `${i}/${cities.length}  ${c.name ?? "(no name)"}  → ${
        row.osm ? `${(row.osm.osmType ?? "?").charAt(0).toUpperCase()}${row.osm.osmId} (${row.osm.addresstype}${row.matchDistanceKm != null ? `, ${row.matchDistanceKm.toFixed(1)}km` : ""})` : `MISS: ${row.note}`
      }`,
    );
    await wait(DELAY_MS);
  }

  const total = Object.values(out);
  console.log(
    `\nDone. ${total.length} rows. resolved=${total.filter((r) => r.osm).length} missed=${total.filter((r) => !r.osm).length}. → ${OUT}`,
  );
}

main();
