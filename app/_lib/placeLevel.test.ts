import { describe, expect, it } from "vitest";

import { toPlace } from "./nominatim";
import { isPagePlace } from "./placeLevel";

// Nominatim jsonv2 results, trimmed to the fields toPlace reads.
const result = (o: Record<string, unknown>) =>
  toPlace({ osm_type: "relation", osm_id: 1, lat: "46.9", lon: "7.4", address: { country: "Switzerland", country_code: "ch" }, ...o })!;

describe("isPagePlace", () => {
  it("accepts cities, towns, suburbs and administrative areas", () => {
    expect(isPagePlace(result({ name: "Bern", display_name: "Bern, Switzerland", category: "boundary", type: "administrative", addresstype: "city" }))).toBe(true);
    expect(isPagePlace(result({ name: "Shibuya", display_name: "Shibuya, Tokyo, Japan", category: "place", type: "suburb", addresstype: "suburb" }))).toBe(true);
    expect(isPagePlace(result({ name: "Tenerife", display_name: "Tenerife, Spain", category: "place", type: "island", addresstype: "island" }))).toBe(true);
  });

  it("rejects a house address: no name, so the label would be its house number", () => {
    const p = result({ osm_type: "node", name: "", display_name: "27, Gutenbergstrasse, Villette, Bern, 3007, Switzerland", category: "place", type: "house", addresstype: "place" });
    expect(p.name).toBe("27");
    expect(isPagePlace(p)).toBe(false);
  });

  it("rejects buildings and streets", () => {
    expect(isPagePlace(result({ name: "Osiedle Na Górce", display_name: "Osiedle Na Górce, Mikołajki, Poland", category: "landuse", type: "residential", addresstype: "residential" }))).toBe(false);
    expect(isPagePlace(result({ name: "Gutenbergstrasse", display_name: "Gutenbergstrasse, Bern, Switzerland", category: "highway", type: "residential", addresstype: "road" }))).toBe(false);
  });

  it("rejects postcodes, whatever their OSM class", () => {
    expect(isPagePlace(result({ name: "90066", display_name: "90066, Culver City, California, United States", category: "place", type: "postcode", addresstype: "postcode" }))).toBe(false);
    expect(isPagePlace(result({ name: "3007", display_name: "3007, Bern, Switzerland", category: "boundary", type: "postal_code", addresstype: "postcode" }))).toBe(false);
  });

  it("falls back to the name when the class is unknown (cached lookups)", () => {
    expect(isPagePlace(result({ name: "Bern", display_name: "Bern, Switzerland" }))).toBe(true);
    expect(isPagePlace(result({ name: "", display_name: "" }))).toBe(false);
    expect(isPagePlace(result({ name: "06511", display_name: "06511, New Haven, United States" }))).toBe(false);
  });
});
