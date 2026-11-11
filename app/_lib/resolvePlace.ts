// Sign-up resolution: which existing page does a freshly picked OSM object
// belong to? Pure (no I/O) so the rules are tested offline. A page IS an OSM
// object; when OSM drifts (centre moved, object replaced, search now offers a
// sibling object for the same city) a newcomer's pick carries a different id,
// and this is the one place where we notice. See ADR 0001.
//
// Order, first that applies:
//   1. the pick's id is a live page                      → join it
//   2. the pick's id is redirected                       → join the target
//   3. same Wikidata QID as exactly one page             → provable match
//   4. identical label (display name), same country, same tier (region vs
//      not), one box contains the other's pin, exactly one page → provable
//      (Paris commune / city / city_district: identical labels, any type)
//   5. same city name modulo wrappers (London / Greater London), same country
//      AND same state, same tier, containment, exactly one page → provable
//   6. otherwise a NEW page; nearby same-name pages are reported as suspected
//      duplicates for a human, never merged.
// Different states (Kansas City MO vs KS) are never a match nor a suspect.

import { distanceKm, REGION_TYPES } from "./nearby";
import { Place } from "./nominatim";
import { normName, sameCityName } from "./placeNames";

export const SUSPECT_KM = 25;

export type Rule = "wikidata" | "label" | "same-city";
export type Resolution =
  | { kind: "page"; pageId: string }
  | { kind: "redirect"; pageId: string }
  | { kind: "match"; pageId: string; rule: Rule }
  | { kind: "new"; suspects: { pageId: string; reason: string }[] };

export type Directory = {
  page: (id: string) => Place | undefined; // live pages only
  redirect: (id: string) => string | undefined; // one hop
  pages: Place[]; // every live page
};

export const isRegion = (p: Place) => !!p.placeType && REGION_TYPES.has(p.placeType);
export const sameTier = (a: Place, b: Place) => isRegion(a) === isRegion(b);
export const sameCountry = (a: Place, b: Place) =>
  !!a.countryCode && !!b.countryCode && a.countryCode.toLowerCase() === b.countryCode.toLowerCase();
// Both absent counts as the same (countries without states); exactly one
// known is "unknown": never enough to prove a match.
export const stateRelation = (a: Place, b: Place): "same" | "different" | "unknown" => {
  const x = a.state ? normName(a.state) : "";
  const y = b.state ? normName(b.state) : "";
  if (!x && !y) return "same";
  if (!x || !y) return "unknown";
  return x === y ? "same" : "different";
};
const inBox = (b: Place["bbox"], p: { lat: number; lon: number }) =>
  !!b && p.lat >= b[0] && p.lat <= b[1] && p.lon >= b[2] && p.lon <= b[3];
export const contained = (a: Place, b: Place) => inBox(a.bbox, b) || inBox(b.bbox, a);
const sameLabel = (a: Place, b: Place) => normName(a.fullName).length > 0 && normName(a.fullName) === normName(b.fullName);

const only = <T,>(xs: T[]) => (xs.length === 1 ? xs[0] : undefined);

export function resolvePlace(pick: Place, dir: Directory): Resolution {
  if (dir.page(pick.id)) return { kind: "page", pageId: pick.id };
  const to = dir.redirect(pick.id);
  if (to && dir.page(to)) return { kind: "redirect", pageId: to };

  const others = dir.pages.filter((p) => p.id !== pick.id);
  if (pick.wikidata) {
    const m = only(others.filter((p) => p.wikidata === pick.wikidata));
    if (m) return { kind: "match", pageId: m.id, rule: "wikidata" };
  }
  const byLabel = only(others.filter((p) => sameLabel(pick, p) && sameCountry(pick, p) && sameTier(pick, p) && contained(pick, p)));
  if (byLabel) return { kind: "match", pageId: byLabel.id, rule: "label" };
  const byName = only(
    others.filter(
      (p) => sameCityName(pick.name, p.name) && sameCountry(pick, p) && stateRelation(pick, p) === "same" &&
        sameTier(pick, p) && contained(pick, p),
    ),
  );
  if (byName) return { kind: "match", pageId: byName.id, rule: "same-city" };

  const suspects = others
    .filter(
      (p) => sameCountry(pick, p) && (sameCityName(pick.name, p.name) || sameLabel(pick, p)) &&
        stateRelation(pick, p) !== "different" && (contained(pick, p) || distanceKm(pick, p) <= SUSPECT_KM),
    )
    .map((p) => ({
      pageId: p.id,
      reason: `same name "${p.name}" ${Math.round(distanceKm(pick, p))} km away, not provable (${[
        !sameTier(pick, p) ? "region vs place" : null,
        stateRelation(pick, p) === "unknown" ? "state unknown" : null,
        !contained(pick, p) ? "no containment" : null,
        p.wikidata && pick.wikidata && p.wikidata !== pick.wikidata ? "different Wikidata" : null,
      ].filter(Boolean).join(", ") || "several candidates"})`,
    }));
  return { kind: "new", suspects };
}

// Redirect writes that keep every redirect ONE hop to a live page: the new
// row points at its target's own target, and rows pointing at `from` move on.
export function redirectWrites(from: string, to: string, redirects: Map<string, string>) {
  const target = redirects.get(to) ?? to;
  if (target === from) throw new Error(`redirect ${from} → ${to} would loop`);
  const writes = [{ from, to: target }];
  for (const [x, y] of redirects) if (y === from && x !== from) writes.push({ from: x, to: target });
  return writes;
}

// A pasted profile link is valid when it lands on the same page as the pick.
export const landsOn = (token: string, dir: Pick<Directory, "page" | "redirect">) =>
  dir.page(token) ? token : (dir.redirect(token) ?? token);
