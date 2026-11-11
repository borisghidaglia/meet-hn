// Search round-trip: for every merged page (and the ones people complained
// about), replay what a newcomer got when searching its name, and check where
// each result would land at sign-up. Real Nominatim responses, recorded by
//   npm run script scripts/recordSearchRoundTrip.ts
// so this runs offline; re-record after the pipeline to test against today's OSM.

import { describe, expect, it } from "vitest";

import fixture from "./__fixtures__/searchRoundTrip.json";
import { pickerList, Place, toPlace } from "./nominatim";
import { sameCityName } from "./placeNames";
import { Directory, resolvePlace, sameCountry, sameTier, stateRelation } from "./resolvePlace";

const pages = fixture.directory as Place[];
const byId = new Map(pages.map((p) => [p.id, p]));
const dir: Directory = { page: (id) => byId.get(id), redirect: () => undefined, pages };
const land = (p: Place) => {
  const r = resolvePlace(p, dir);
  return "pageId" in r ? r.pageId : null;
};
const searches = fixture.searches.map((s) => ({
  ...s,
  page: byId.get(s.pageId)!,
  results: s.results.map((r) => ({ ...toPlace(r)!, addresstype: r.addresstype ?? "" })),
}));
const sameCity = (a: Place, b: Place) =>
  sameCityName(a.name, b.name) && sameCountry(a, b) && stateRelation(a, b) === "same" && sameTier(a, b);


describe("search round-trip", () => {
  it("recorded enough searches to mean something", () => {
    expect(searches.length).toBeGreaterThan(40);
  });

  it("a result that is the same city as a page never creates a new page", () => {
    const splits = searches.flatMap((s) =>
      s.results.filter((r) => sameCity(r, s.page) && land(r) === null).map((r) => `${s.query}: ${r.id} ${r.fullName}`),
    );
    expect(splits).toEqual([]);
  });

  it("all same-city results of one search land on the same page", () => {
    const scattered = searches.flatMap((s) => {
      const landed = new Set(s.results.filter((r) => sameCity(r, s.page)).map(land));
      return landed.size > 1 ? [`${s.query}: ${[...landed].join(" / ")}`] : [];
    });
    expect(scattered).toEqual([]);
  });

  it("no two pages in the plan are ones sign-up would join (pipeline = sign-up rules)", () => {
    const joinable = pages.flatMap((p) => {
      const r = resolvePlace(p, { page: () => undefined, redirect: () => undefined, pages: pages.filter((q) => q.id !== p.id) });
      return r.kind === "match" ? [`${p.id} ${p.fullName} ⇒ ${r.pageId} by ${r.rule}`] : [];
    });
    expect(joinable).toEqual([]);
  });

  it("the entry the picker shows first lands on an existing page", () => {
    const misses = searches.flatMap((s) => {
      const first = pickerList(s.results)[0];
      return first && sameCity(first, s.page) && land(first) === null ? [s.query] : [];
    });
    expect(misses).toEqual([]);
  });

  it("never merges across countries or states", () => {
    const bad = searches.flatMap((s) =>
      s.results.flatMap((r) => {
        const id = land(r);
        const p = id ? byId.get(id) : undefined;
        if (!p || p.id === r.id) return [];
        return !sameCountry(r, p) || stateRelation(r, p) === "different" ? [`${r.id} ${r.fullName} → ${p.id} ${p.fullName}`] : [];
      }),
    );
    expect(bad).toEqual([]);
  });

  it("Paris and Toulouse siblings with identical labels join the city page", () => {
    const at = (q: string, id: string) => land(searches.find((s) => s.query === q)!.results.find((r) => r.id === id)!);
    expect(at("Paris", "R7444")).toBe("R71525"); // suburb, same Wikidata
    expect(at("Paris", "R1641193")).toBe("R71525"); // city_district, same label
    expect(at("Toulouse", "R1649040")).toBe("R35738"); // Toulouse Métropole, same label
  });

  it("keeps a region separate from its city (New York State, Málaga province)", () => {
    const at = (q: string, id: string) => searches.find((s) => s.query === q)!.results.find((r) => r.id === id)!;
    expect(land(at("New York", "R61320"))).toBeNull();
    expect(resolvePlace(at("Málaga", "R5275848"), dir)).toMatchObject({ kind: "new", suspects: [{ pageId: "N21750065" }] });
  });
});
