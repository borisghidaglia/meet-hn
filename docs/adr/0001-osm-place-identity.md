# 0001 — Stable OSM place identity for locations

- Status: Accepted
- Date: 2026-06-29

## Context

Locations (the `City` entity) were keyed by their coordinates, `${lat},${lon}`,
and before that by a `${countryCode}-${cityName}` slug (e.g. `fr-Paris`). This
caused the same place to exist under several ids and split users across separate
pages/URLs, because:

1. **Coordinates are not an identity.** Nominatim returns different lat/lon
   precision for the same place over time (`2.3200410` vs `2.3200410217200766`),
   so picking the same place on different days produced different ids.
2. **One place, several OSM objects.** A search for "Paris" returns the city,
   a suburb, and a city_district as distinct objects with distinct coordinates.
3. **Three id generations coexisted** in the data: `cc-name`, `lat,lon`, and
   precision-variants of `lat,lon`.

The id is also embedded in users' Hacker News profiles (`meet.hn/city/<id>`),
which we do not control and must not break.

## Decision

1. **Identity = OSM object id.** A location is identified by its
   `osm_type + osm_id` in short form: `R<id>` (relation), `N<id>` (node),
   `W<id>` (way) — e.g. `R71525` for Paris. This is stable, precision- and
   zoom-independent. Coordinates are stored only to place the map pin, never as
   identity.

2. **URL: `/place/<osmId>/<slug>`.** The path prefix is `place`, not `city`,
   because a location can be any granularity. The `<slug>` is the slugified
   Nominatim `display_name` (which is already ordered correctly per country);
   it is purely decorative — routing keys only on `<osmId>`, so the slug can
   change without breaking links. `/city/*` permanently redirects to `/place/*`.

3. **Deduplicate only true duplicates.** We merge records that resolve to the
   **same** OSM object (the same place reached via the three historical id
   schemes). Distinct OSM objects are treated as **distinct valid locations** —
   users may legitimately pick a suburb, neighbourhood, or city. We do not force
   a place into its parent city. Cases where one name mapped to several objects
   (Paris, Manchester, Málaga, Gdańsk) were resolved by one-off human review;
   canonical choices favour the actual city object with the cleaner metadata.

4. **No location enforcement at sign-up.** The search dropdown shows every
   matching OSM result with its current people-count as guidance, but the user
   may pick any valid location. Convergence is encouraged (counts steer people
   to the populated object), not enforced. Consequently the alias map redirects
   **only historical record ids**, never osm id → osm id: a future user who
   deliberately picks Paris's suburb is respected, not bumped to the city.

5. **Backfill via structured search.** Existing records were re-resolved to OSM
   ids using Nominatim **structured** search (`?city=&country=`) and choosing the
   result nearest the stored coordinate. Free-text (`?q=`) search was rejected:
   its ranking matched unrelated POIs (e.g. "Buenos Aires Argentina" → a café in
   Milan).

6. **Migration.** All city records are re-keyed to OSM ids, every `user.cityId`
   is re-pointed, and hacker counts are recomputed from the actual user rows.

7. **Legacy links via a committed, temporary alias map.** `cityAliases.json`
   (committed, versioned) maps every **historical** id (the `lat,lon` and
   `cc-name` ids that exist in current HN profiles) to its canonical OSM id. It
   contains no osm id → osm id entries (see decision 4). The route 301-redirects
   ids found in the map; ids not in the map (i.e. newly registered OSM places)
   are served directly. `addUser` canonicalises the id parsed from the HN profile
   through the same map before storing. **This file is transient:** it exists
   only to keep pre-existing HN profile links working, shrinks as users update
   their profiles (referenced ids are detectable in stored `about` text), and is
   deleted once no old id is referenced.

## Consequences

- Existing HN profile links keep working via redirect; new sign-ups use OSM ids
  natively and never need an alias entry.
- The whole dataset is re-keyed once (~all users' `cityId` change); migration is
  mechanical and was verified on a restored copy before prod.
- `cityAliases.json` is technical debt by design — a decaying migration aid, not
  a permanent part of the request flow.

## Artifacts

- `scripts/backfillOsm.ts` — resolve records to OSM ids (read-only).
- `scripts/reviewDuplicates.ts` — local map UI for the duplicate decisions.
- `scripts/buildAliasList.ts` — produce `cityAliases.json` from the backfill +
  review decisions.
