import { describe, expect, it } from "vitest";

import { buildPlan, Decisions } from "./buildAliasList";
import type { Snapshot } from "./citySnapshot";
import {
  AddressLine,
  Cand,
  isPlaceLevel,
  matchContainment,
  matchLegacy,
  matchPin,
  matchSameCity,
  normName,
  sameCityName,
  rollupTarget,
} from "./osmMatch";
import type { Verdict } from "./verifyOsm";

const cand = (p: Partial<Cand> & { key: string; lat: number; lon: number }): Cand => ({
  osmType: p.key.startsWith("R") ? "relation" : p.key.startsWith("W") ? "way" : "node",
  osmId: Number(p.key.slice(1)),
  name: "Springfield",
  names: [p.name ?? "Springfield"],
  category: "place",
  type: "city",
  addresstype: "city",
  cc: "us",
  displayName: "Springfield, United States",
  importance: 0.5,
  ...p,
});
const PIN: [number, number] = [40, -90];
const rec = { name: "Springfield", cc: "us", pin: PIN };
// ~1.1 m per 1e-5 degree of latitude
const north = (m: number) => PIN[0] + m / 111_195;

describe("normName", () => {
  it("ignores case, diacritics and punctuation", () => {
    expect(normName("Gdańsk")).toBe(normName("gdansk"));
    expect(normName("Saint-Étienne")).toBe("saint etienne");
  });
});

describe("matchPin", () => {
  it("accepts the unique same-name same-country object on the pin", () => {
    const m = matchPin(rec, [cand({ key: "R1", lat: north(0.5), lon: PIN[1] })]);
    expect(m.status).toBe("exact");
  });
  it("rejects a match whose name differs", () => {
    const m = matchPin(rec, [cand({ key: "R1", lat: PIN[0], lon: PIN[1], name: "Shelbyville", names: ["Shelbyville"] })]);
    expect(m.status).toBe("none");
  });
  it("rejects a match in another country", () => {
    const m = matchPin(rec, [cand({ key: "R1", lat: PIN[0], lon: PIN[1], cc: "ca" })]);
    expect(m.status).toBe("none");
  });
  it("rejects a same-name object further than MATCH_M", () => {
    expect(matchPin(rec, [cand({ key: "R1", lat: north(150), lon: PIN[1] })]).status).toBe("none");
  });
  it("is ambiguous when two matching objects sit on the pin", () => {
    const m = matchPin(rec, [cand({ key: "R1", lat: north(5), lon: PIN[1] }), cand({ key: "N2", lat: north(8), lon: PIN[1] })]);
    expect(m.status).toBe("ambiguous");
  });
  it("is ambiguous when a same-name rival is within SEP_M", () => {
    const m = matchPin(rec, [cand({ key: "R1", lat: north(5), lon: PIN[1] }), cand({ key: "R2", lat: north(1500), lon: PIN[1] })]);
    expect(m.status).toBe("ambiguous");
  });
  it("an object on the exact coordinate wins even with a same-name rival nearby", () => {
    const m = matchPin(rec, [cand({ key: "R1", lat: PIN[0], lon: PIN[1] }), cand({ key: "R2", lat: north(400), lon: PIN[1] })]);
    expect(m.status).toBe("exact");
  });
  it("two objects sharing the exact coordinate are ambiguous unless fullName picks one", () => {
    const a = cand({ key: "R1", lat: PIN[0], lon: PIN[1], displayName: "Springfield, County, US" });
    const b = cand({ key: "R2", lat: PIN[0], lon: PIN[1], displayName: "Springfield, US" });
    expect(matchPin(rec, [a, b]).status).toBe("ambiguous");
    const m = matchPin({ ...rec, fullName: "Springfield, US" }, [a, b]);
    expect(m.status === "exact" && m.cand.key).toBe("R2");
  });
  it("ignores rivals beyond SEP_M", () => {
    const m = matchPin(rec, [cand({ key: "R1", lat: PIN[0], lon: PIN[1] }), cand({ key: "R2", lat: north(5000), lon: PIN[1] })]);
    expect(m.status).toBe("exact");
  });
  it("without a stored name, requires the coordinate to be essentially identical", () => {
    const noName = { name: null, cc: "us", pin: PIN };
    expect(matchPin(noName, [cand({ key: "R1", lat: north(5), lon: PIN[1] })]).status).toBe("none");
    expect(matchPin(noName, [cand({ key: "R1", lat: north(0.2), lon: PIN[1] })]).status).toBe("exact");
  });
});

describe("matchContainment", () => {
  const province = cand({ key: "R10", lat: north(89_000), lon: PIN[1], category: "boundary", type: "administrative", addresstype: "state", displayName: "Springfield, United States" });
  it("accepts the single same-name area containing the pin", () => {
    expect(matchContainment(rec, [province], [province]).status).toBe("exact");
  });
  it("never accepts a node as a containing area", () => {
    const node = cand({ key: "N10", lat: north(89_000), lon: PIN[1] });
    expect(matchContainment(rec, [node], [node]).status).toBe("none");
  });
  it("is ambiguous when the pin is inside two same-name areas (city inside same-name state)", () => {
    const city = cand({ key: "R11", lat: north(3000), lon: PIN[1], category: "boundary", type: "administrative" });
    expect(matchContainment(rec, [province, city], [province, city]).status).toBe("ambiguous");
  });
  it("is ambiguous when a same-name object is near the pin", () => {
    const town = cand({ key: "N12", lat: north(800), lon: PIN[1], addresstype: "town" });
    expect(matchContainment(rec, [province], [province, town]).status).toBe("ambiguous");
  });
  it("rejects a coarse match when the pin is inside a different settlement (NYC → New York state)", () => {
    const state = cand({ key: "R61320", name: "New York", names: ["New York"], lat: north(200_000), lon: PIN[1], category: "boundary", type: "administrative", addresstype: "state" });
    const nyc = cand({ key: "R175905", name: "City of New York", names: ["City of New York"], lat: north(9000), lon: PIN[1], category: "boundary", type: "administrative", addresstype: "city" });
    expect(matchContainment({ ...rec, name: "New York" }, [state, nyc], [state, nyc]).status).toBe("ambiguous");
  });
  it("requires the stored fullName to match when there is one", () => {
    expect(matchContainment({ ...rec, fullName: "Springfield, Illinois, United States" }, [province], [province]).status).toBe("ambiguous");
    expect(matchContainment({ ...rec, fullName: "Springfield, United States" }, [province], [province]).status).toBe("exact");
  });
});

describe("sameCityName", () => {
  it("ignores administrative wrappers and spelling only", () => {
    for (const [a, b] of [
      ["London", "Greater London"], ["Old Toronto", "Toronto"], ["Capital City of Prague", "Prague"],
      ["Brisbane City", "Brisbane"], ["Da Nang", "Đà Nẵng"], ["St. Louis", "Saint Louis"],
      ["Ballina Shire Council", "Ballina"], ["Lima Metropolitan Area", "Lima"],
    ]) expect(sameCityName(a!, b!), `${a} ~ ${b}`).toBe(true);
  });
  it("keeps genuinely different names apart", () => {
    for (const [a, b] of [
      ["London", "New London"], ["Kingston upon Thames", "Kingston"], ["Queens", "Queens Chapel"],
      ["York", "New York"], ["Mexico City", "Mexico City Metropolitan"], ["City", "Greater"],
    ]) expect(sameCityName(a!, b!), `${a} ≁ ${b}`).toBe(false);
  });
});

describe("matchSameCity", () => {
  const london = { name: "London", cc: "gb", pin: [51.49, -0.144] as [number, number] };
  const greater = cand({ key: "R175342", lat: 51.5, lon: -0.12, name: "Greater London", names: ["Greater London"], cc: "gb", category: "boundary", type: "administrative", addresstype: "city" });
  it("accepts the only city-level area containing the pin with the same name", () => {
    const m = matchSameCity(london, [greater, cand({ key: "R2", lat: 51.49, lon: -0.14, name: "Westminster", names: ["Westminster"], cc: "gb", addresstype: "city_district" })]);
    expect(m.status === "exact" && m.cand.key).toBe("R175342");
  });
  it("never matches a region, a node, or another country", () => {
    expect(matchSameCity(london, [{ ...greater, addresstype: "state" }]).status).toBe("none");
    expect(matchSameCity(london, [{ ...greater, osmType: "node", key: "N1" }]).status).toBe("none");
    expect(matchSameCity(london, [{ ...greater, cc: "ca" }]).status).toBe("none");
  });
  it("is ambiguous when two such cities contain the pin", () => {
    expect(matchSameCity(london, [greater, { ...greater, key: "R9" }]).status).toBe("ambiguous");
  });
});

describe("rollupTarget", () => {
  const line = (p: Partial<AddressLine> & { key: string | null; rankAddress: number }): AddressLine => ({
    category: "boundary", type: "administrative", isAddress: true, name: "x", ...p,
  });
  const lines = [
    line({ key: "W1", rankAddress: 30, category: "building", type: "yes" }), // itself
    line({ key: "W2", rankAddress: 26, category: "highway", type: "residential" }),
    line({ key: "N3", rankAddress: 22, category: "place", type: "neighbourhood" }), // node: proximity only
    line({ key: "R4", rankAddress: 20, category: "boundary", type: "administrative" }),
    line({ key: "R5", rankAddress: 16, category: "boundary", type: "administrative" }),
  ];
  it("picks the smallest containing AREA, skipping place nodes and non-places", () => {
    expect(rollupTarget("W1", lines, new Set(["R4", "R5"]))?.key).toBe("R4");
  });
  it("requires the area to also be returned by reverse geocoding the pin", () => {
    expect(rollupTarget("W1", lines, new Set(["R5"]))?.key).toBe("R5");
    expect(rollupTarget("W1", lines, new Set())).toBeNull();
  });
});

describe("isPlaceLevel", () => {
  it("treats buildings, streets, landuse and single dwellings as non-places", () => {
    expect(isPlaceLevel("building", "yes")).toBe(false);
    expect(isPlaceLevel("highway", "residential")).toBe(false);
    expect(isPlaceLevel("landuse", "residential")).toBe(false);
    expect(isPlaceLevel("place", "isolated_dwelling")).toBe(false);
    expect(isPlaceLevel("place", "suburb")).toBe(true);
    expect(isPlaceLevel("boundary", "administrative")).toBe(true);
    expect(isPlaceLevel("boundary", "census")).toBe(true); // e.g. Ellicott City CDP
    expect(isPlaceLevel("place", "island")).toBe(true); // e.g. Tenerife
  });
});

describe("matchLegacy", () => {
  const city = cand({ key: "R1", lat: 0, lon: 0, displayName: "Springfield, Illinois, United States" });
  it("accepts when both searches, uniqueness and a pin-verified record agree", () => {
    expect(matchLegacy(rec, [city], [city], ["R1"]).status).toBe("consensus");
  });
  it("needs corroboration from outside the search index", () => {
    expect(matchLegacy(rec, [city], [city], []).status).toBe("unverified");
    expect(matchLegacy({ ...rec, fullName: "Springfield, Illinois, United States" }, [city], [city], []).status).toBe("consensus");
    expect(matchLegacy({ ...rec, fullName: "Springfield, Ohio, United States" }, [city], [city], ["R1"]).status).toBe("unverified");
  });
  it("rejects when two same-name settlements exist", () => {
    const town = cand({ key: "R2", lat: 1, lon: 1, addresstype: "town" });
    expect(matchLegacy(rec, [city, town], [city], ["R1"]).status).toBe("unverified");
  });
  it("rejects when a pin-verified record disagrees", () => {
    expect(matchLegacy(rec, [city], [city], ["R1", "R9"]).status).toBe("unverified");
  });
});

describe("buildPlan", () => {
  const v = (id: string, status: Verdict["status"], key?: string): Verdict => ({
    originalId: id, scheme: "latlon", name: "X", countryCode: "us", realUsers: 0, status, reason: status, evidence: {},
    ...(key ? { canonical: { key, osmType: "relation", osmId: 1, name: "X", displayName: "X, US", cc: "us", lat: 0, lon: 0, category: "place", type: "city", addresstype: "city" } } : {}),
  });
  const snap = (ids: string[], users: [string, string][]): Snapshot => ({
    takenAt: "t", cities: ids.map((id) => ({ id, hackers: 0 })), users: users.map(([username, cityId]) => ({ username, cityId })),
  });
  const none: Decisions = { merges: [], separate: [] };

  it("collapses records verified as the same object and re-points their users", async () => {
    const p = await buildPlan(snap(["1,1", "1.0000001,1"], [["a", "1,1"], ["b", "1.0000001,1"]]), { "1,1": v("1,1", "exact", "R1"), "1.0000001,1": v("1.0000001,1", "exact", "R1") }, none);
    expect(p.violations).toEqual([]);
    expect(p.canonicals.R1!.users).toBe(2);
    expect(p.aliases).toEqual({ "1,1": "R1", "1.0000001,1": "R1" });
    expect(p.userMoves).toHaveLength(2);
  });
  it("keeps unverified records as their own place: never aliased, never merged", async () => {
    const p = await buildPlan(snap(["1,1", "2,2"], [["a", "1,1"], ["b", "2,2"]]), { "1,1": v("1,1", "exact", "R1"), "2,2": v("2,2", "unverified") }, none);
    expect(p.aliases).toEqual({ "1,1": "R1" });
    expect(p.unverified["2,2"]).toBeDefined();
    expect(p.canonicals["2,2"]!.users).toBe(1);
    expect(p.userMoves.map((m) => m.username)).toEqual(["a"]);
  });
  it("keeps a rolled-up pick (building, street) as the object picked, not its area", async () => {
    const rolled: Verdict = { ...v("1,1", "rollup", "R100"), exact: { ...v("1,1", "exact", "W5").canonical!, key: "W5" } };
    const p = await buildPlan(snap(["1,1", "2,2"], [["a", "1,1"], ["b", "2,2"]]), { "1,1": rolled, "2,2": v("2,2", "exact", "R100") }, none);
    expect(p.aliases).toEqual({ "1,1": "W5", "2,2": "R100" });
    expect(p.violations).toEqual([]);
  });
  it("merges the same city picked under another name", async () => {
    const p = await buildPlan(snap(["1,1", "2,2"], [["a", "1,1"], ["b", "2,2"]]), { "1,1": v("1,1", "samecity", "R175342"), "2,2": v("2,2", "exact", "R175342") }, none);
    expect(p.canonicals.R175342!.users).toBe(2);
  });
  it("leaves cities that already have an OSM id alone", async () => {
    const p = await buildPlan(snap(["R7"], [["a", "R7"]]), { R7: { ...v("R7", "native"), scheme: "osm" } }, none);
    expect(p.aliases).toEqual({});
    expect(p.userMoves).toEqual([]);
    expect(p.violations).toEqual([]);
  });
  it("applies a committed human merge across different objects", async () => {
    const p = await buildPlan(snap(["1,1", "2,2"], []), { "1,1": v("1,1", "exact", "R1"), "2,2": v("2,2", "exact", "R2") }, { merges: [{ label: "m", members: ["1,1", "2,2"], canonical: "R1" }], separate: [] });
    expect(p.aliases).toEqual({ "1,1": "R1", "2,2": "R1" });
    expect(p.violations).toEqual([]);
  });
  it("flags a 'separate' decision that would be violated", async () => {
    const p = await buildPlan(snap(["1,1", "2,2"], []), { "1,1": v("1,1", "exact", "R1"), "2,2": v("2,2", "exact", "R1") }, { merges: [], separate: [{ label: "s", members: ["1,1", "2,2"] }] });
    expect(p.violations.join()).toMatch(/must stay separate/);
  });
  describe("pages sign-up would join are merged (same rules both sides)", () => {
    // Manchester: the city node and its boundary relation verify to two
    // different OSM objects, with different Wikidata and different labels.
    const at = (id: string, key: string, fullName: string): Verdict => {
      const b = v(id, "exact", key);
      return { ...b, canonical: { ...b.canonical!, key, name: "Manchester", displayName: fullName, cc: "gb" } };
    };
    const verdicts = {
      "53.4794892,-2.2451148": at("53.4794892,-2.2451148", "N294001443", "Manchester, Lancashire, Greater Manchester, England, M60 2WN, United Kingdom"),
      "53.4424618,-2.2324547": at("53.4424618,-2.2324547", "R146656", "Manchester, Greater Manchester, England, United Kingdom"),
    };
    const geo = (state2: string) => async () =>
      new Map([
        ["N294001443", { lat: 53.4795, lon: -2.2451, bbox: [53.32, 53.64, -2.41, -2.09], placeType: "city", state: "England", wikidata: "Q18125" }],
        ["R146656", { lat: 53.4425, lon: -2.2325, bbox: [53.34, 53.54, -2.32, -2.15], placeType: "city", state: state2, wikidata: "Q21525592" }],
      ]);
    const users: [string, string][] = [["a", "53.4794892,-2.2451148"], ["b", "53.4794892,-2.2451148"], ["c", "53.4424618,-2.2324547"]];
    const records = Object.keys(verdicts);

    it("merges onto the page with the most people and moves the rest", async () => {
      const p = await buildPlan(snap(records, users), verdicts, none, undefined, geo("England"));
      expect(p.violations).toEqual([]);
      expect(p.provenMerges).toEqual([{ canonical: "N294001443", members: [{ id: "R146656", rule: "same-city" }] }]);
      expect(p.canonicals.N294001443!.users).toBe(3);
      expect(p.aliases["53.4424618,-2.2324547"]).toBe("N294001443");
    });
    it("doesn't when the proof fails (different state)", async () => {
      const p = await buildPlan(snap(records, users), verdicts, none, undefined, geo("Scotland"));
      expect(p.provenMerges).toEqual([]);
      expect(Object.keys(p.canonicals).sort()).toEqual(["N294001443", "R146656"]);
    });
    it("respects a committed 'separate' decision", async () => {
      const p = await buildPlan(snap(records, users), verdicts, { merges: [], separate: [{ label: "s", members: records }] }, undefined, geo("England"));
      expect(p.provenMerges).toEqual([]);
      expect(p.violations).toEqual([]);
    });
  });
  describe("a record torn between candidates that are all the same page", () => {
    // Paris: the pin is shared by R7444 (Q90) and R1641193 (same label) — both are Paris.
    const LABEL = "Paris, Ile-de-France, Metropolitan France, France";
    const exactParis: Verdict = { ...v("48.85,2.34", "exact", "R71525"), name: "Paris", countryCode: "fr" };
    exactParis.canonical = { ...exactParis.canonical!, name: "Paris", displayName: LABEL, cc: "fr" };
    const torn = (keys: string[]): Verdict => ({ ...v("48.8588,2.32", "unverified"), name: "Paris", countryCode: "fr", evidence: { cands: keys.map((key) => ({ key })) } });
    const meta = async (k: string) => ({ name: "Paris", fullName: k === "R999" ? "Paris, Lamar County, Texas, United States" : LABEL, countryCode: k === "R999" ? "us" : "fr", lat: 48.86, lon: 2.34 });
    const geo = async (keys: string[]) =>
      new Map(keys.map((k) => [k, { lat: 48.86, lon: 2.34, bbox: [48.81, 48.91, 2.22, 2.47], placeType: k === "R71525" ? "city" : "suburb", state: "Ile-de-France", wikidata: k === "R71525" || k === "R7444" ? "Q90" : null }]));
    const snapP = snap(["48.85,2.34", "48.8588,2.32"], [["a", "48.85,2.34"], ["b", "48.8588,2.32"], ["c", "48.8588,2.32"]]);

    it("joins the page every candidate lands on", async () => {
      const p = await buildPlan(snapP, { "48.85,2.34": exactParis, "48.8588,2.32": torn(["R7444", "R1641193"]) }, none, meta, geo);
      expect(p.violations).toEqual([]);
      expect(p.aliases["48.8588,2.32"]).toBe("R71525");
      expect(p.canonicals.R71525!.users).toBe(3);
    });
    it("stays its own place when one candidate lands elsewhere", async () => {
      const p = await buildPlan(snapP, { "48.85,2.34": exactParis, "48.8588,2.32": torn(["R7444", "R999"]) }, none, meta, geo);
      expect(p.aliases["48.8588,2.32"]).toBeUndefined();
      expect(p.unverified["48.8588,2.32"]).toBeDefined();
    });
  });
  it("reports users whose city record is missing, without moving them", async () => {
    const p = await buildPlan(snap(["1,1"], [["a", "9,9"]]), { "1,1": v("1,1", "exact", "R1") }, none);
    expect(p.orphanUsers).toEqual([{ username: "a", cityId: "9,9" }]);
    expect(p.violations).toEqual([]);
  });
});
