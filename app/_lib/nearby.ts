// "Nearby" for a city page: which other pages hold people you could meet.
// Pages are never merged for being close (only true duplicates merge, see
// docs/adr/0001-osm-place-identity.md); nearness is computed and shown instead.
//
// Two places are near when their pins are within NEARBY_KM. A REGION pick (a
// province, an emirate, a state, a country) is different: its pin is the
// region's centre and says nothing about where its people are, so it never
// gets a distance. It is matched by containment instead (the other place's pin
// is inside the region's bounding box), shown separately as "also in this
// region". Cities are always matched by distance, however large: their box
// can include far islands (San Francisco's includes the Farallons).

export const NEARBY_KM = 25;
// Region types (Nominatim addresstype) whose centre doesn't locate anyone.
const REGION_TYPES = new Set(["country", "state", "province", "region", "state_district", "county", "territory"]);
// A region box this large is useless for containment (Tokyo's includes islands
// 1,000+ km away): the region is then matched by distance like a city.
const MAX_REGION_HALF_DIAGONAL_KM = 600;

export type GeoPlace = {
  id: string;
  name: string;
  country?: string;
  hackers: number;
  lat: number;
  lon: number;
  bbox?: [number, number, number, number] | null; // [south, north, west, east]
  placeType?: string | null; // Nominatim addresstype of the place
};

export type Nearby = {
  near: { place: GeoPlace; km: number }[]; // sorted by distance
  region: GeoPlace[]; // containment matches involving a region pick
  hackersNear: number; // people in `near` (this page's own excluded)
};

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

// A bbox spanning more than half the globe in longitude (antimeridian
// countries like the US, Russia, Fiji) says nothing useful: ignore it.
const usableBbox = (b: GeoPlace["bbox"]): b is [number, number, number, number] =>
  !!b && b.length === 4 && b.every(Number.isFinite) && b[1] >= b[0] && b[3] - b[2] <= 180;

export const isRegion = (p: GeoPlace) =>
  !!p.placeType && REGION_TYPES.has(p.placeType) && usableBbox(p.bbox) &&
  distanceKm({ lat: p.bbox[0], lon: p.bbox[2] }, { lat: p.bbox[1], lon: p.bbox[3] }) / 2 <= MAX_REGION_HALF_DIAGONAL_KM;

const contains = (b: GeoPlace["bbox"], p: { lat: number; lon: number }) =>
  usableBbox(b) && p.lat >= b[0] && p.lat <= b[1] && p.lon >= b[2] && p.lon <= b[3];

export function nearby(self: GeoPlace, places: GeoPlace[], km = NEARBY_KM): Nearby {
  const near: Nearby["near"] = [];
  const region: GeoPlace[] = [];
  const selfRegion = isRegion(self);
  for (const p of places) {
    if (p.id === self.id || p.hackers <= 0) continue;
    const pRegion = isRegion(p);
    if (selfRegion || pRegion) {
      if ((selfRegion && contains(self.bbox, p)) || (pRegion && contains(p.bbox, self))) region.push(p);
      continue;
    }
    const d = distanceKm(self, p);
    if (d <= km) near.push({ place: p, km: d });
  }
  near.sort((a, b) => a.km - b.km || b.place.hackers - a.place.hackers);
  region.sort((a, b) => b.hackers - a.hackers || a.name.localeCompare(b.name));
  return { near, region, hackersNear: near.reduce((s, n) => s + n.place.hackers, 0) };
}

// Coordinates of a stored city: explicit fields (OSM-keyed records, written by
// the migration) or the legacy `${lat},${lon}` id itself.
export function cityGeo(c: {
  id: string; name: string; country?: string; hackers: number;
  lat?: number; lon?: number; bbox?: [number, number, number, number] | null; placeType?: string;
}): GeoPlace | null {
  let lat = c.lat, lon = c.lon;
  if (lat === undefined || lon === undefined) {
    const m = c.id.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    lat = Number(m[1]);
    lon = Number(m[2]);
  }
  return { id: c.id, name: c.name, country: c.country, hackers: c.hackers, lat, lon, bbox: c.bbox ?? null, placeType: c.placeType ?? null };
}
