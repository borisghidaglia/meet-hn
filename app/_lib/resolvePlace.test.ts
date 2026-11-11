import { describe, expect, it } from "vitest";

import { Place } from "./nominatim";
import { Directory, landsOn, redirectWrites, resolvePlace } from "./resolvePlace";

const P = (p: Partial<Place> & { id: string; name: string; lat: number; lon: number }): Place => ({
  fullName: p.name, countryCode: "fr", state: null, bbox: null, placeType: "city", wikidata: null, ...p,
});
const box = (lat: number, lon: number, d: number): Place["bbox"] => [lat - d, lat + d, lon - d, lon + d];
const dir = (pages: Place[], redirects: Record<string, string> = {}): Directory => ({
  page: (id) => pages.find((p) => p.id === id),
  redirect: (id) => redirects[id],
  pages,
});

const PARIS_LABEL = "Paris, Ile-de-France, Metropolitan France, France";
const paris = P({ id: "R71525", name: "Paris", fullName: PARIS_LABEL, state: "Ile-de-France", lat: 48.8535, lon: 2.3484, bbox: box(48.86, 2.34, 0.1), wikidata: "Q90" });

describe("resolvePlace", () => {
  it("joins a live page or follows a redirect", () => {
    expect(resolvePlace(paris, dir([paris]))).toEqual({ kind: "page", pageId: "R71525" });
    const old = { ...paris, id: "R7444" };
    expect(resolvePlace(old, dir([paris], { R7444: "R71525" }))).toEqual({ kind: "redirect", pageId: "R71525" });
  });
  it("matches Paris siblings with identical labels, whatever their type", () => {
    for (const [id, placeType] of [["R7444", "suburb"], ["R1641193", "city_district"]] as const) {
      const pick = P({ id, name: "Paris", fullName: PARIS_LABEL, state: "Ile-de-France", lat: 48.8589, lon: 2.32, bbox: box(48.86, 2.34, 0.1), placeType });
      expect(resolvePlace(pick, dir([paris]))).toMatchObject({ kind: "match", pageId: "R71525", rule: "label" });
    }
  });
  it("matches by Wikidata first", () => {
    const pick = P({ id: "N17807753", name: "Paris", fullName: "Paris, France", lat: 48.85, lon: 2.35, wikidata: "Q90" });
    expect(resolvePlace(pick, dir([paris]))).toMatchObject({ kind: "match", rule: "wikidata", pageId: "R71525" });
  });
  it("matches the same city under another name (London ⇢ Greater London)", () => {
    const greater = P({ id: "R175342", name: "Greater London", fullName: "Greater London, England, United Kingdom", countryCode: "gb", state: "England", lat: 51.5, lon: -0.12, bbox: [51.28, 51.69, -0.51, 0.33] });
    const london = P({ id: "N107775", name: "London", fullName: "London, Greater London, England, United Kingdom", countryCode: "gb", state: "England", lat: 51.5074, lon: -0.1278, bbox: box(51.5074, -0.1278, 0.01) });
    expect(resolvePlace(london, dir([greater]))).toMatchObject({ kind: "match", rule: "same-city", pageId: "R175342" });
  });
  it("never merges Kansas City MO and KS, and doesn't even flag them", () => {
    const mo = P({ id: "R1", name: "Kansas City", fullName: "Kansas City, Jackson County, Missouri, United States", countryCode: "us", state: "Missouri", lat: 39.0997, lon: -94.5786, bbox: box(39.1, -94.58, 0.2) });
    const ks = P({ id: "R2", name: "Kansas City", fullName: "Kansas City, Wyandotte County, Kansas, United States", countryCode: "us", state: "Kansas", lat: 39.1142, lon: -94.6275, bbox: box(39.11, -94.63, 0.1) });
    expect(resolvePlace(ks, dir([mo]))).toEqual({ kind: "new", suspects: [] });
  });
  it("never merges a region with a city of the same name (Dubai emirate vs Dubai)", () => {
    const city = P({ id: "N31248510", name: "Dubai", fullName: "Dubai, Dubai, United Arab Emirates", countryCode: "ae", state: "Dubai", lat: 25.07, lon: 55.17, bbox: box(25.07, 55.17, 0.2) });
    const emirate = P({ id: "R4479752", name: "Dubai", fullName: "Dubai, United Arab Emirates", countryCode: "ae", state: "Dubai", lat: 24.9, lon: 55.4, bbox: [24.6, 25.4, 54.9, 56.4], placeType: "state" });
    const r = resolvePlace(emirate, dir([city]));
    expect(r.kind).toBe("new");
    expect(r.kind === "new" && r.suspects.map((s) => s.pageId)).toEqual(["N31248510"]);
  });
  it("catches a replaced id with no Wikidata (village): one page, via the stored pin", () => {
    // The page's OSM object is gone; we still have its name, label, state and pin.
    const page = P({ id: "N111", name: "Louargat", fullName: "Louargat, Guingamp, Côtes-d'Armor, Brittany, France", state: "Brittany", lat: 48.566, lon: -3.336, placeType: "village" });
    const successor = P({ id: "R222", name: "Louargat", fullName: "Louargat, Côtes-d'Armor, Brittany, Metropolitan France, France", state: "Brittany", lat: 48.57, lon: -3.33, bbox: box(48.57, -3.33, 0.05), placeType: "village" });
    expect(resolvePlace(successor, dir([page]))).toMatchObject({ kind: "match", rule: "same-city", pageId: "N111" });
  });
  it("keeps a same-name village 40 km away separate, flagged for review", () => {
    const page = P({ id: "N111", name: "Saint-Martin", state: "Brittany", lat: 48.0, lon: -3.0, placeType: "village" });
    const other = P({ id: "R333", name: "Saint-Martin", state: "Brittany", lat: 48.0, lon: -2.46, bbox: box(48.0, -2.46, 0.03), placeType: "village" });
    expect(resolvePlace(other, dir([page]))).toEqual({ kind: "new", suspects: [] }); // 40 km: not even suspect
    const near = { ...other, lat: 48.0, lon: -2.9, bbox: box(48.0, -2.9, 0.03) }; // 7 km, no containment
    const r = resolvePlace(near, dir([page]));
    expect(r.kind === "new" && r.suspects.length).toBe(1);
  });
  it("doesn't prove a match when the state is known on one side only", () => {
    const page = P({ id: "R1", name: "Springfield", fullName: "Springfield, United States", countryCode: "us", state: null, lat: 39.8, lon: -89.65, bbox: box(39.8, -89.65, 0.1) });
    const pick = P({ id: "R2", name: "Springfield", fullName: "Springfield, Sangamon County, Illinois, United States", countryCode: "us", state: "Illinois", lat: 39.79, lon: -89.64, bbox: box(39.79, -89.64, 0.1) });
    expect(resolvePlace(pick, dir([page])).kind).toBe("new");
  });
  it("refuses an ambiguous match (two pages qualify)", () => {
    const a = { ...paris, id: "R1", wikidata: null };
    const b = { ...paris, id: "R2", wikidata: null };
    const pick = { ...paris, id: "R3", wikidata: null };
    expect(resolvePlace(pick, dir([a, b])).kind).toBe("new");
  });
});

describe("redirects", () => {
  it("stay one hop: new rows point at the final target, old rows move on", () => {
    const existing = new Map([["A", "B"], ["X", "B"]]);
    expect(redirectWrites("B", "C", existing)).toEqual([{ from: "B", to: "C" }, { from: "A", to: "C" }, { from: "X", to: "C" }]);
    expect(redirectWrites("D", "A2", new Map([["A2", "C"]]))).toEqual([{ from: "D", to: "C" }]);
    expect(() => redirectWrites("C", "B", new Map([["B", "C"]]))).toThrow(/loop/);
  });
  it("a pasted link lands on the page it redirects to", () => {
    const d = dir([paris], { "48.8588897,2.3200410217200766": "R71525" });
    expect(landsOn("48.8588897,2.3200410217200766", d)).toBe("R71525");
    expect(landsOn("R71525", d)).toBe("R71525");
  });
});
