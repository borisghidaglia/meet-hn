// Pure decision logic for re-identifying legacy city records as OSM objects.
// No I/O here, so every rule is unit-tested (scripts/osmMatch.test.ts) and the
// verifier can be re-run offline from its Nominatim cache.
//
// Ground truth we exploit: a `lat,lon` record id IS the Nominatim coordinate of
// the result the user clicked (see app/_db/City.client.ts), and `name` /
// `countryCode` are that result's own fields. So the object the user picked is
// the one whose *current* Nominatim coordinate sits on the pin AND whose name
// AND country match. We accept only when all three agree and nothing else
// competes; otherwise the record falls back to a safe default (kept as its own
// place, never merged).

export type OsmType = "node" | "way" | "relation";

export type Cand = {
  key: string; // short form: N123 | W123 | R123
  osmType: OsmType;
  osmId: number;
  lat: number;
  lon: number;
  name: string | null; // localized (en-US) display name
  names: string[]; // name + selected namedetails (name:en, alt_name, ...)
  category: string;
  type: string;
  addresstype: string;
  cc: string | null;
  displayName: string;
  importance: number | null;
};

export type AddressLine = {
  key: string | null;
  category: string;
  type: string;
  rankAddress: number;
  isAddress: boolean;
  name: string;
};

// A pin is accepted as "on" an object when the object's current Nominatim
// coordinate is within MATCH_M of it, and no other same-name same-country
// object is within SEP_M (so there is nothing it could be confused with).
// Calibrated on the data: see the report printed by scripts/verifyOsm.ts.
export const MATCH_M = 100;
// Ids are Nominatim's own coordinates, so a true match normally sits within
// centimetres (precision variants). Up to PROOF_M is proof on its own; between
// PROOF_M and MATCH_M (object edited since) a second, independent signal is
// required: reverse-geocoding the pin must return that very object.
export const PROOF_M = 10;
// The id string IS the clicked object's coordinate to 7 decimals (~1 cm). An
// object still sitting within EXACT_M of it is that object: rivals farther away
// cannot have produced this exact coordinate, so the SEP_M rule doesn't apply.
export const EXACT_M = 1;
export const SEP_M = 2000;
// Records with no stored name only have coordinate + country to go on, so the
// coordinate must be essentially identical (precision variants only).
export const NO_NAME_MATCH_M = 1;

export const shortKey = (osmType: string, osmId: number | string) =>
  `${osmType.charAt(0).toUpperCase()}${osmId}`;

export function haversineM(a: [number, number], b: [number, number]) {
  const R = 6371008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const normName = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const nameMatches = (c: Cand, name: string) => {
  const n = normName(name);
  return n.length > 0 && c.names.some((x) => normName(x) === n);
};

// Primary-name match only (no alt/old names) — used where coordinates can't
// gate the comparison (legacy `cc-Name` records).
export const primaryNameMatches = (c: Cand, name: string) => {
  const n = normName(name);
  return n.length > 0 && [c.name, c.names[0]].some((x) => x != null && normName(x) === n);
};

// Is this object a "place" a person can say they live in (country … suburb /
// neighbourhood), as opposed to a building, street, shop, landuse polygon or a
// single dwelling? Non-places are rolled up to their containing place.
const NON_PLACE_PLACE_TYPES = new Set([
  "house",
  "houses",
  "plot",
  "square",
  "city_block",
  "allotments",
  "farm",
  "isolated_dwelling",
]);
// Named areas people say they live in, even when not administrative
// (census-designated places like Ellicott City, islands like Tenerife): kept
// as picked — rolling them up to a county/region would merge distinct places.
const PLACE_BOUNDARIES = new Set(["administrative", "census", "statistical", "political"]);
export const isPlaceLevel = (category: string, type: string) =>
  (category === "boundary" && PLACE_BOUNDARIES.has(type)) ||
  (category === "place" && !NON_PLACE_PLACE_TYPES.has(type));

// The display name stored at sign-up vs the object's current display_name.
// Exact (normalized) equality only: it is used as a corroborating signal, so a
// partial overlap must never count.
export const sameFullName = (stored: string | null | undefined, c: Cand) =>
  !!stored && normName(stored).length > 0 && normName(stored) === normName(c.displayName);

export const dedupe = (cands: Cand[]) => {
  const m = new Map<string, Cand>();
  for (const c of cands) if (!m.has(c.key)) m.set(c.key, c);
  return [...m.values()];
};

export type PinMatch =
  | { status: "exact"; cand: Cand; distM: number; runnerUpM: number | null }
  | { status: "ambiguous"; reason: string; cands: { key: string; distM: number }[] }
  | { status: "none"; reason: string; nearestSameNameM: number | null };

export function matchPin(
  rec: { name?: string | null; cc?: string | null; pin: [number, number]; fullName?: string | null },
  cands: Cand[],
  opts: { matchM?: number; sepM?: number; noNameMatchM?: number } = {},
): PinMatch {
  const hasName = !!rec.name && normName(rec.name).length > 0;
  const matchM = hasName ? (opts.matchM ?? MATCH_M) : (opts.noNameMatchM ?? NO_NAME_MATCH_M);
  const sepM = opts.sepM ?? SEP_M;

  const eligible = dedupe(cands)
    .filter((c) => !rec.cc || c.cc === rec.cc.toLowerCase())
    .filter((c) => !hasName || nameMatches(c, rec.name!))
    .map((c) => ({ c, d: haversineM(rec.pin, [c.lat, c.lon]) }))
    .sort((a, b) => a.d - b.d);

  const onPin = eligible.filter((e) => e.d <= EXACT_M);
  if (onPin.length === 1)
    return { status: "exact", cand: onPin[0]!.c, distM: onPin[0]!.d, runnerUpM: eligible[1]?.d ?? null };
  if (onPin.length > 1) {
    // Several objects share the exact centre (e.g. a city and a same-name
    // municipality on one label node). Only the stored sign-up display name
    // can tell which one was clicked.
    const byFullName = onPin.filter((e) => sameFullName(rec.fullName, e.c));
    if (byFullName.length === 1)
      return { status: "exact", cand: byFullName[0]!.c, distM: byFullName[0]!.d, runnerUpM: eligible.find((e) => e !== byFullName[0])?.d ?? null };
    return {
      status: "ambiguous",
      reason: `${onPin.length} matching objects share the pin's exact coordinate`,
      cands: onPin.map((e) => ({ key: e.c.key, distM: e.d })),
    };
  }
  const within = eligible.filter((e) => e.d <= matchM);
  if (within.length === 0)
    return {
      status: "none",
      reason: hasName
        ? `no same-name${rec.cc ? " same-country" : ""} object within ${matchM}m of the pin`
        : `no object within ${matchM}m of the pin`,
      nearestSameNameM: eligible[0]?.d ?? null,
    };
  if (within.length > 1)
    return {
      status: "ambiguous",
      reason: `${within.length} matching objects within ${matchM}m`,
      cands: within.map((e) => ({ key: e.c.key, distM: e.d })),
    };
  const runnerUp = eligible[1]?.d ?? null;
  if (runnerUp !== null && runnerUp < sepM)
    return {
      status: "ambiguous",
      reason: `another matching object ${Math.round(runnerUp)}m away (< ${sepM}m)`,
      cands: eligible.slice(0, 2).map((e) => ({ key: e.c.key, distM: e.d })),
    };
  return { status: "exact", cand: within[0]!.c, distM: within[0]!.d, runnerUpM: runnerUp };
}

const SETTLEMENT_AREA = new Set(["city", "town", "village", "municipality"]);
// Any of these containing the pin means it is inside a populated place finer
// than a coarse match (NYC boroughs are tagged "suburb", for instance).
const INNER_PLACE = new Set([...SETTLEMENT_AREA, "borough", "suburb", "city_district", "quarter", "neighbourhood", "hamlet"]);

// Fallback for large areas whose Nominatim coordinate has drifted since the
// pick (a province's computed centre can move tens of km when its boundary is
// edited). Reverse geocoding the pin returns the polygons that CONTAIN it; we
// accept the area only if it is the single same-name, same-country polygon
// containing the pin AND no other same-name object (e.g. a city of the same
// name whose own point drifted) lies within SEP_M of the pin.
export function matchContainment(
  rec: { name?: string | null; cc?: string | null; pin: [number, number]; fullName?: string | null },
  containing: Cand[], // results of reverse geocoding AT the pin
  all: Cand[], // every candidate seen for this record
  opts: { sepM?: number } = {},
): PinMatch {
  const sepM = opts.sepM ?? SEP_M;
  if (!rec.name || !normName(rec.name)) return { status: "none", reason: "no name to match a containing area", nearestSameNameM: null };
  const same = (c: Cand) => (!rec.cc || c.cc === rec.cc.toLowerCase()) && nameMatches(c, rec.name!);
  const areas = dedupe(containing).filter(
    (c) => c.osmType !== "node" && isPlaceLevel(c.category, c.type) && same(c),
  );
  if (areas.length === 0)
    return { status: "none", reason: "pin is not inside any same-name same-country area", nearestSameNameM: null };
  if (areas.length > 1)
    return { status: "ambiguous", reason: `pin is inside ${areas.length} same-name areas`, cands: areas.map((c) => ({ key: c.key, distM: haversineM(rec.pin, [c.lat, c.lon]) })) };
  const area = areas[0]!;
  // A coarse match (state/province/county…) is rejected when the pin also lies
  // inside a DIFFERENT settlement: the user most likely picked that city and it
  // has since been renamed (e.g. NYC is now "City of New York", so only the
  // state still matches "New York" at NYC's old centre).
  if (!SETTLEMENT_AREA.has(area.addresstype)) {
    const inner = dedupe(containing).find(
      (c) => c.key !== area.key && c.osmType !== "node" && INNER_PLACE.has(c.addresstype),
    );
    if (inner)
      return { status: "ambiguous", reason: `matched ${area.addresstype} ${area.key}, but the pin is inside ${inner.addresstype} ${inner.key} "${inner.name}"`, cands: [{ key: inner.key, distM: haversineM(rec.pin, [inner.lat, inner.lon]) }] };
  }
  // Containment proves the pin is in the area, not that the user picked it. When
  // the sign-up display name is known it must be this area's display name.
  if (rec.fullName && !sameFullName(rec.fullName, area))
    return { status: "ambiguous", reason: `inside ${area.key} but stored fullName differs from its display name`, cands: [{ key: area.key, distM: haversineM(rec.pin, [area.lat, area.lon]) }] };
  const rivals = dedupe(all)
    .filter((c) => c.key !== area.key && same(c))
    .map((c) => ({ key: c.key, distM: haversineM(rec.pin, [c.lat, c.lon]) }))
    .sort((a, b) => a.distM - b.distM);
  if (rivals[0] && rivals[0].distM < sepM)
    return { status: "ambiguous", reason: `inside ${area.key} but ${rivals[0].key} (same name) is ${Math.round(rivals[0].distM)}m from the pin`, cands: rivals.slice(0, 1) };
  return { status: "exact", cand: area, distM: haversineM(rec.pin, [area.lat, area.lon]), runnerUpM: rivals[0]?.distM ?? null };
}

// Where a building / street / dwelling pick goes: the smallest administrative
// or settlement AREA that (a) Nominatim lists in that object's own address
// (/details) and (b) reverse-geocoding the pin also returns, i.e. the pin lies
// inside its polygon. Place *nodes* are excluded: Nominatim attaches them to
// addresses by proximity, not containment, so they can sit across a boundary.
const ROLLUP_PLACE_TYPES = new Set([
  "country", "state", "region", "province", "state_district", "county", "district",
  "municipality", "city", "town", "village", "hamlet", "borough", "city_district",
  "suburb", "quarter", "neighbourhood",
]);
export const isRollupArea = (l: { key: string | null; category: string; type: string }) =>
  l.key !== null &&
  !l.key.startsWith("N") &&
  ((l.category === "boundary" && l.type === "administrative") ||
    (l.category === "place" && ROLLUP_PLACE_TYPES.has(l.type)));

export function rollupTarget(
  selfKey: string,
  lines: AddressLine[],
  containingKeys: Set<string>, // keys returned by reverse geocoding the pin
): AddressLine | null {
  const ok = lines.filter(
    (l) =>
      l.key !== null &&
      l.key !== selfKey &&
      l.isAddress &&
      l.rankAddress >= 4 &&
      l.rankAddress <= 25 &&
      isRollupArea(l) &&
      containingKeys.has(l.key),
  );
  if (!ok.length) return null;
  return ok.reduce((a, b) => (b.rankAddress > a.rankAddress ? b : a));
}

const SETTLEMENT = new Set(["city", "town", "village", "municipality"]);

export type LegacyMatch =
  | { status: "consensus"; cand: Cand; signals: string[] }
  | { status: "unverified"; reason: string };

// Legacy `cc-Name` records carry no coordinate: the old id only ever meant
// "the place called Name in country cc". We accept a single object only if
// every independent signal names the same one:
//   1. top same-name result of structured search (city=&country=)
//   2. top same-name result of free-text search (q=, countrycodes=)
//   3. it is the only same-name settlement (city/town/village/municipality)
//      in the country
//   4. corroboration from outside the search index: pin-verified records of
//      the same name+country all resolved to this object, and/or the display
//      name stored at sign-up equals its display name (at least one must exist;
//      any that exists must agree)
export function matchLegacy(
  rec: { name?: string | null; cc?: string | null; fullName?: string | null },
  structured: Cand[],
  freeText: Cand[],
  verifiedSameName: string[], // canonical keys of pin-verified same name+cc records
): LegacyMatch {
  if (!rec.name || !rec.cc) return { status: "unverified", reason: "legacy record lacks name or country" };
  const cc = rec.cc.toLowerCase();
  const ok = (c: Cand) => c.cc === cc && primaryNameMatches(c, rec.name!);
  const topS = structured.find(ok);
  const topF = freeText.find(ok);
  if (!topS || !topF) return { status: "unverified", reason: "a search returned no same-name result in the country" };
  if (topS.key !== topF.key)
    return { status: "unverified", reason: `searches disagree (${topS.key} vs ${topF.key})` };
  const settlements = dedupe([...structured, ...freeText]).filter(
    (c) => ok(c) && SETTLEMENT.has(c.addresstype),
  );
  if (!settlements.some((c) => c.key === topS.key))
    return { status: "unverified", reason: `top result ${topS.key} is a ${topS.addresstype}, not a settlement` };
  if (settlements.length !== 1)
    return {
      status: "unverified",
      reason: `${settlements.length} same-name settlements in ${cc} (${settlements.map((c) => `${c.key}:${c.addresstype}`).join(", ")})`,
    };
  // Both searches share one index, so on their own they are not independent.
  // Independent corroboration: a record whose PIN proved the same object, or
  // the display name stored at sign-up equal to this object's.
  const disagree = verifiedSameName.filter((k) => k !== topS.key);
  if (disagree.length)
    return { status: "unverified", reason: `pin-verified same-name records point elsewhere (${disagree.join(", ")})` };
  if (rec.fullName && !sameFullName(rec.fullName, topS))
    return { status: "unverified", reason: "stored fullName differs from the candidate's display name" };
  if (!verifiedSameName.length && !rec.fullName)
    return { status: "unverified", reason: "no pin-verified record or stored fullName to corroborate" };
  return {
    status: "consensus",
    cand: topS,
    signals: [
      "structured top",
      "free-text top",
      "only same-name settlement in the country",
      ...(verifiedSameName.length ? [`same object as ${verifiedSameName.length} pin-verified record(s)`] : []),
      ...(rec.fullName ? ["stored fullName equals its display name"] : []),
    ],
  };
}
