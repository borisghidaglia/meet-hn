// The Nominatim requests the site makes, and the place shape both the picker
// (browser) and the sign-up resolver (server) work with. Kept in one module so
// the search round-trip test exercises exactly what users get.

export const NOMINATIM = "https://nominatim.openstreetmap.org";
const PARAMS = "format=jsonv2&addressdetails=1&extratags=1&accept-language=en-US";

// What the sign-up picker asks for while the user types.
export const pickerSearchUrl = (q: string) =>
  `${NOMINATIM}/search?q=${encodeURIComponent(q)}&limit=5&${PARAMS}`;
// Server-side re-fetch of a picked object: never trust client-sent fields.
export const lookupUrl = (keys: string[]) => `${NOMINATIM}/lookup?osm_ids=${keys.join(",")}&${PARAMS}`;

export const OSM_KEY = /^[NWR]\d+$/;
export const osmKey = (osmType: string, osmId: number | string) =>
  `${osmType.charAt(0).toUpperCase()}${osmId}`;

export type Place = {
  id: string; // OSM short key (R71525) — or a legacy page id
  name: string;
  fullName: string; // Nominatim display_name (the label users see)
  country?: string;
  countryCode?: string;
  state?: string | null; // address.state, used to tell Kansas City MO from KS
  lat: number;
  lon: number;
  bbox?: [number, number, number, number] | null; // [south, north, west, east]
  placeType?: string | null; // Nominatim addresstype
  wikidata?: string | null; // Wikidata QID, when OSM has one
};

// A raw jsonv2 search/lookup result → Place.
export function toPlace(r: any): Place | null {
  if (!r || r.osm_id == null || typeof r.osm_type !== "string") return null;
  const bb = Array.isArray(r.boundingbox) ? r.boundingbox.map(Number) : null;
  return {
    id: osmKey(r.osm_type, r.osm_id),
    name: r.name || r.display_name?.split(",")[0] || "",
    fullName: r.display_name ?? "",
    country: r.address?.country,
    countryCode: r.address?.country_code ?? r.cc ?? undefined,
    state: r.address?.state ?? r.state ?? null,
    lat: Number(r.lat),
    lon: Number(r.lon),
    bbox: bb && bb.length === 4 && bb.every(Number.isFinite) ? (bb as Place["bbox"]) : null,
    placeType: r.addresstype ?? null,
    wikidata: r.extratags?.wikidata ?? r.wikidata ?? null,
  };
}

// What the picker shows: one entry per label (Nominatim often returns several
// OSM objects with identical labels), preferring the "city" object, cities
// first. Cosmetic only; resolution happens server-side.
export function pickerList<T extends { fullName: string; addresstype: string }>(results: T[]): T[] {
  const byFullName = new Map<string, T>();
  for (const r of results) {
    const existing = byFullName.get(r.fullName);
    if (!existing || (existing.addresstype !== "city" && r.addresstype === "city")) byFullName.set(r.fullName, r);
  }
  return [...byFullName.values()].sort((a, b) => {
    const aIsCity = a.addresstype === "city";
    const bIsCity = b.addresstype === "city";
    return aIsCity === bIsCity ? 0 : aIsCity ? -1 : 1;
  });
}
