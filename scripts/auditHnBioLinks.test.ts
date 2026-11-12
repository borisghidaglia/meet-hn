import { describe, expect, it } from "vitest";

import { extractLinks, mapDeadId } from "./auditHnBioLinks";

describe("extractLinks", () => {
  it("reads every historical format from HN's about HTML", () => {
    const about =
      'Hi<p>meet.hn&#x2F;city&#x2F;45.0677551,7.6824892&#x2F;Turin<p>' +
      '<a href="https:&#x2F;&#x2F;meet.hn&#x2F;city&#x2F;fr-S%C3%A3o%20Paulo" rel="nofollow">https:&#x2F;&#x2F;meet.hn&#x2F;city&#x2F;fr-S%C3%A3o%20...</a><p>' +
      "old: meet.hn&#x2F;?city=fr-Paris. also meet.hn and meet.hn-9196b221-3da2 and www.meet.hn/city/R71525/Paris)";
    expect(extractLinks(about).map((l) => [l.format, l.id ?? null])).toEqual([
      ["city/cc-Name", "fr-São Paulo"],
      ["city/lat,lon", "45.0677551,7.6824892"],
      ["query ?city=", "fr-Paris"],
      ["home", null],
      ["city/osm", "R71525"],
    ]);
  });
});

describe("mapDeadId", () => {
  const cities = [
    { id: "48.85,2.35", name: "Paris", cc: "fr", lat: 48.85, lon: 2.35 },
    { id: "45.76,4.83", name: "Lyon", cc: "fr", lat: 45.76, lon: 4.83 },
    { id: "33.66,-95.55", name: "Paris", cc: "us", lat: 33.66, lon: -95.55 },
  ];
  const finalOf = (id: string) => ({ "48.85,2.35": "R71525" })[id] ?? id;

  it("maps a cc-Name id by name and country, even if its owner moved", () => {
    const m = mapDeadId({ raw: "", format: "city/cc-Name", id: "fr-Paris" }, cities, finalOf, ["45.76,4.83"]);
    expect(m).toMatchObject({ to: "R71525", ownersAgree: false });
  });
  it("maps a precision-variant lat,lon by place and slug", () => {
    const m = mapDeadId({ raw: "", format: "city/lat,lon", id: "48.8566,2.3522", slug: "Paris" }, cities, finalOf, ["R71525"]);
    expect(m).toMatchObject({ to: "R71525", ownersAgree: true });
  });
  it("refuses to guess when nothing fits", () => {
    expect(mapDeadId({ raw: "", format: "city/cc-Name", id: "fr-Brest" }, cities, finalOf, ["45.76,4.83"]).to).toBeNull();
  });
});

describe("names written with a space", () => {
  const cities = [
    { id: "40.58,-105.07", name: "Fort Collins", cc: "us", lat: 40.58, lon: -105.07 },
    { id: "46.32,-0.46", name: "Niort", cc: "fr", lat: 46.32, lon: -0.46 },
    { id: "44.69,10.63", name: "Reggio nell'Emilia", cc: "it", lat: 44.69, lon: 10.63 },
  ];
  const finalOf = (id: string) => id;
  const one = (about: string) => extractLinks(about)[0]!;

  it("reads the rest of the line when the link stops at a space", () => {
    const l = one("meet.hn&#x2F;city&#x2F;us-Fort Collins<p>Socials");
    expect(l).toMatchObject({ id: "us-Fort", tail: ["Collins"] });
    expect(mapDeadId(l, cities, finalOf, [])).toMatchObject({ to: "40.58,-105.07", fullId: "us-Fort Collins" });
  });
  it("keeps apostrophes inside the id", () => {
    const l = one("meet.hn&#x2F;city&#x2F;it-Reggio-nell&#x27;Emilia<p>x");
    expect(l.id).toBe("it-Reggio-nell'Emilia");
    expect(mapDeadId(l, cities, finalOf, []).to).toBe("44.69,10.63");
  });
  it("matches an id with no country by name", () => {
    expect(mapDeadId(one("meet.hn&#x2F;city&#x2F;niort"), cities, finalOf, []).to).toBe("46.32,-0.46");
  });
  it("ignores trailing words that aren't part of the name", () => {
    const l = { raw: "", format: "city/cc-Name" as const, id: "us-Fort", tail: ["Collins", "and", "Denver"] };
    expect(mapDeadId(l, cities, finalOf, []).to).toBe("40.58,-105.07");
  });
});

describe("ties", () => {
  const cities = [
    { id: "-34.60,-58.38", name: "Buenos Aires", cc: "ar", lat: -34.6, lon: -58.38 },
    { id: "-36.37,-60.38", name: "Buenos Aires", cc: "ar", lat: -36.37, lon: -60.38 },
    { id: "36.7960087,-4.547378378829243", name: "Malaga", cc: "es", lat: 36.7960087, lon: -4.547378378829243 },
    { id: "36.7213028,-4.4216366", name: "Malaga", cc: "es", lat: 36.7213028, lon: -4.4216366 },
    { id: "51.5,-0.12", name: "London", cc: "gb", lat: 51.5, lon: -0.12 },
  ];
  const finalOf = (id: string) => id;
  it("takes the city over its province when an old id could mean either", () => {
    const m = mapDeadId({ raw: "", format: "city/cc-Name", id: "ar-Buenos-Aires" }, cities, finalOf, [], (id) => id === "-36.37,-60.38");
    expect(m.to).toBe("-34.60,-58.38");
  });
  it("takes the same pin at another precision first", () => {
    const m = mapDeadId({ raw: "", format: "city/lat,lon", id: "36.7960087,-4.5473784", slug: "Malaga" }, cities, finalOf, []);
    expect(m.to).toBe("36.7960087,-4.547378378829243");
  });
  it("reads uk as gb", () => {
    expect(mapDeadId({ raw: "", format: "city/cc-Name", id: "uk-London" }, cities, finalOf, []).to).toBe("51.5,-0.12");
  });
});
