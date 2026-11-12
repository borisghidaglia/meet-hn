// What a city page can be. Shared by the sign-up (app/_db/signUpPlan.ts) and
// the city pipeline (scripts/osmMatch.ts). No I/O, unit-tested.

import { Place } from "./nominatim";

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

// A name made only of digits (a postcode such as 90066, a house number such as
// 27) labels no place.
const NUMERIC_NAME = /^[\d\s-]*$/;

// Can this pick become a page as it is? Pages created from house addresses or
// postcodes (before November 2026) showed "1 hacker in , Switzerland" or
// "1 hacker in 90066": Nominatim gives an address no name and a postcode its
// number as name. Those picks are rolled up to their containing city instead.
export const isPagePlace = (p: Place) =>
  !NUMERIC_NAME.test(p.name.trim()) &&
  p.placeType !== "postcode" &&
  (p.category === undefined || p.type === undefined || (isPlaceLevel(p.category, p.type) && p.type !== "postcode"));
