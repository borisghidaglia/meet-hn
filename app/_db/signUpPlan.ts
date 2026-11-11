import "server-only";

// Turns a pick into a plan of writes, using the pure resolver. Called twice:
// dry from the form (to show the right page + link before the user pastes it)
// and again, authoritatively, when the sign-up is submitted.

import { City } from "@/app/_db/schema";
import { loadDirectory, lookupOsm, placeToCity } from "@/app/_db/Place";
import { OSM_KEY, Place } from "@/app/_lib/nominatim";
import { Resolution, resolvePlace } from "@/app/_lib/resolvePlace";

export type SignUpPlan = {
  pickId: string;
  pageId: string; // where the user ends up, after any re-key
  matchedPageId: string | null; // the existing page matched (before re-key)
  resolution: Resolution["kind"];
  rule?: string;
  city: City; // page record (existing, or to be created from the pick)
  create: boolean;
  redirect?: { from: string; to: string; reason: string };
  rekey?: { old: City; successor: Place; reason: string };
  suspects: { pageId: string; reason: string }[];
  dir: Awaited<ReturnType<typeof loadDirectory>>;
};

export async function planSignUp(pickId: string): Promise<SignUpPlan | null> {
  const dir = await loadDirectory();
  const base = { pickId, create: false, suspects: [], dir, matchedPageId: null };
  // Live page or redirect: no OSM call needed (also covers legacy ids).
  if (dir.cities.has(pickId)) return { ...base, pageId: pickId, resolution: "page", city: dir.cities.get(pickId)! };
  const to = dir.redirect(pickId);
  if (to && dir.cities.has(to)) return { ...base, pageId: to, resolution: "redirect", city: dir.cities.get(to)! };

  const pick = await lookupOsm(pickId);
  if (!pick) return null; // not an OSM object we can verify
  const r = resolvePlace(pick, dir);
  if (r.kind === "new")
    return { ...base, pageId: pick.id, resolution: "new", city: placeToCity(pick, Date.now()), create: true, suspects: r.suspects };
  if (r.kind !== "match") return { ...base, pageId: r.pageId, resolution: r.kind, city: dir.cities.get(r.pageId)! };

  const page = dir.cities.get(r.pageId)!;
  const reason = `sign-up pick ${pick.id} matched ${page.id} by ${r.rule}`;
  // The matched page's own OSM object is gone: follow OSM, re-key onto the pick.
  const pageIsDead = OSM_KEY.test(page.id) && (await lookupOsm(page.id)) === null;
  if (pageIsDead)
    return {
      ...base, matchedPageId: page.id, pageId: pick.id, resolution: "match", rule: r.rule,
      city: { ...placeToCity(pick, page.createdAt, page.hackers), ...(page.communityLinks ? { communityLinks: page.communityLinks } : {}) },
      rekey: { old: page, successor: pick, reason: `${reason}; ${page.id} no longer exists in OSM` },
    };
  return {
    ...base, matchedPageId: page.id, pageId: page.id, resolution: "match", rule: r.rule, city: page,
    redirect: { from: pick.id, to: page.id, reason },
  };
}
