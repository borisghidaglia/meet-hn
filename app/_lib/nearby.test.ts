import { describe, expect, it } from "vitest";

import { cityGeo, distanceKm, GeoPlace, isRegion, nearby } from "./nearby";

const place = (id: string, lat: number, lon: number, extra: Partial<GeoPlace> = {}): GeoPlace => ({
  id, name: id, hackers: 1, lat, lon, ...extra,
});

describe("nearby", () => {
  const manhattan = place("Manhattan", 40.7831, -73.9712, { hackers: 2 });
  const brooklyn = place("Brooklyn", 40.6526, -73.9497, { hackers: 3 });
  const sanJose = place("San Jose", 37.3361, -121.8906);
  const sf = place("San Francisco", 37.7793, -122.4193);
  const oakland = place("Oakland", 37.8044, -122.2712);

  it("lists places within 25 km, closest first, but never itself", () => {
    const n = nearby(manhattan, [manhattan, brooklyn, sf]);
    expect(n.near.map((x) => x.place.id)).toEqual(["Brooklyn"]);
    expect(n.hackersNear).toBe(3);
  });
  it("is symmetric for precise places and doesn't chain", () => {
    expect(nearby(sf, [oakland, sanJose]).near.map((x) => x.place.id)).toEqual(["Oakland"]);
    expect(nearby(oakland, [sf]).near.map((x) => x.place.id)).toEqual(["San Francisco"]);
  });
  it("skips empty pages", () => {
    expect(nearby(manhattan, [{ ...brooklyn, hackers: 0 }]).near).toEqual([]);
  });
  it("matches a province by containment, without a distance", () => {
    // Buenos Aires province: its centre is ~90 km from the city, but its box contains it.
    const province = place("BA province", -36.38, -60.39, { placeType: "state", bbox: [-41.04, -33.26, -63.39, -56.66] });
    const city = place("BA city", -34.6096, -58.3888, { hackers: 5, placeType: "city" });
    expect(isRegion(province)).toBe(true);
    expect(nearby(city, [province])).toMatchObject({ near: [], region: [province] });
    expect(nearby(province, [city])).toMatchObject({ near: [], region: [city] });
  });
  it("uses distance for a city whatever its box (San Francisco includes the Farallons)", () => {
    const sfWide = { ...sf, placeType: "city", bbox: [37.64, 37.93, -123.17, -122.28] as [number, number, number, number] };
    const missionBay = place("Mission Bay", 37.7706, -122.3915, { placeType: "quarter" });
    expect(isRegion(sfWide)).toBe(false);
    expect(nearby(sfWide, [missionBay]).near.map((x) => x.place.id)).toEqual(["Mission Bay"]);
  });
  it("falls back to distance for a region whose box is useless (Tokyo's spans remote islands)", () => {
    const tokyo = place("Tokyo", 35.6769, 139.7639, { placeType: "province", hackers: 8, bbox: [20.21, 35.9, 135.85, 154.21] });
    const shibuya = place("Shibuya", 35.6637, 139.6977);
    const nagoya = place("Nagoya", 35.1815, 136.9066);
    expect(isRegion(tokyo)).toBe(false);
    expect(nearby(tokyo, [shibuya, nagoya]).near.map((x) => x.place.id)).toEqual(["Shibuya"]);
  });
  it("ignores antimeridian-spanning boxes", () => {
    const us = place("United States", 39.78, -100.45, { placeType: "country", bbox: [-14.76, 71.54, -180, 180] });
    expect(isRegion(us)).toBe(false);
    expect(nearby(us, [brooklyn]).region).toEqual([]);
  });
});

describe("cityGeo", () => {
  it("reads legacy lat,lon ids and explicit fields", () => {
    expect(cityGeo({ id: "48.85,2.35", name: "Paris", hackers: 1 })).toMatchObject({ lat: 48.85, lon: 2.35 });
    expect(cityGeo({ id: "R71525", name: "Paris", hackers: 1, lat: 1, lon: 2 })).toMatchObject({ lat: 1, lon: 2 });
    expect(cityGeo({ id: "fr-Paris", name: "Paris", hackers: 1 })).toBeNull();
  });
  it("distanceKm is roughly right (Manhattan–Brooklyn ≈ 14 km centre to centre)", () => {
    expect(distanceKm({ lat: 40.7831, lon: -73.9712 }, { lat: 40.6526, lon: -73.9497 })).toBeCloseTo(14.6, 0);
  });
});
