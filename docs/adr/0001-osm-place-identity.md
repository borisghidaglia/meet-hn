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

## Amendment (2026-11-11, experiment): merge duplicates only, show what's nearby

A page is the place the user picked. Two records merge only when they are the
same place:

- the same OSM object (verified from the pin), or
- the same city under another name: the pin lies inside exactly one city-level
  area whose name matches once administrative wrappers and spelling are ignored
  (London / Greater London, Old Toronto / Toronto, Da Nang / Đà Nẵng), or
- a committed human merge in `cityMergeDecisions.json` (each with its reason).

Nothing is moved for being close or inside something bigger: a building, a
neighbourhood or a borough stays its own page (a roll-up verdict maps to the
object picked, not its area). Instead every page lists the other pages within
25 km of its pin, and region picks (state, province, county, country) are
matched by containment and shown as "also in this region"
(`app/_lib/nearby.ts`). This needs no list of big cities and nothing to decide
about where a city ends.

## Amendment (2026-11-11): sign-up resolves a pick before creating a page

OSM drifts: a centre moves, an object is replaced, or search starts offering a
sibling object for the same city (Paris: commune, city, district, all with the
label "Paris, Ile-de-France, …"). A newcomer's pick then carries a new id. A page
is still an OSM object. Instead of our own ids or a weekly reconcile job, the
drift is fixed lazily at sign-up, where it shows up (`app/_lib/resolvePlace.ts`):

1. the pick is a live page, so the user joins it;
2. the pick is redirected, so the user joins the target;
3. the pick has the same Wikidata QID as exactly one page, so it matches;
4. the label is identical (any type), with the same country, same tier (region
   vs place) and box containment, and exactly one page qualifies, so it matches;
5. the city name is the same modulo wrappers, with the same country and same
   state (both absent counts as same), same tier and containment, and exactly one
   page qualifies, so it matches;
6. otherwise a new page is created. Nearby same-name pages are logged as
   `SUSPECTED_DUPLICATE` and sent to Telegram for review, never merged.

On a match, the pick becomes a `REDIRECT` to the page. If the page's own OSM
object is gone, the page is re-keyed onto the pick instead: new CITY item, users'
`cityId` rewritten, old id redirected, counter recomputed. Redirects stay one hop:
chains are collapsed on write. Old links in HN profiles redirect permanently on the
city page, and the profile check accepts any id that lands on the same page. The
pick is always re-fetched server-side; client fields are never trusted.

The migration pipeline applies the same rules page against page
(`buildPlan`, `provenMerges`). It catches what pin verification can't, because
pin verification only compares a record to OSM, never two pages to each other.
Example: the Manchester city node and its boundary relation have different
Wikidata and different labels, yet they match on the same name, state and
settlement with containment. Rule 3 needs the same tier: a region tagged with its
city's QID stays separate. Rule 5 needs both sides to be settlements (not a
station) and one name to be the plain name. A bare "City of" is not a wrapper
(City of London ≠ Greater London).

The migration apply (`scripts/migrateCityIdentity.ts`, see the next amendment) writes one `REDIRECT` per alias in
`cityAliases.json` and `state`/`wikidata` on each CITY item. The pipeline now
carries both. Proof: `app/_lib/searchRoundTrip.test.ts` replays recorded searches
for every merged page (`scripts/recordSearchRoundTrip.ts` re-records them).

## Amendment (2026-11-12): typed-era pins, HN-bio links, the apply

**Typed-era pins.** Before 2024-09-19 a city was typed, not picked, and stored
as the search result's centre point with no `fullName`. Such a pin names a city,
not the building it lands on (New York's old pin is in Brooklyn; Tokyo's is in
Chiyoda). For these pins only (`isTypedEra` in `scripts/osmMatch.ts`), the pin
verifies to the area that contains it and has the same name, same country,
place tier, not a node: exactly one settlement (city/town/village/municipality),
else exactly one province, else it stays unverified. When reverse geocoding
skips the city level (Brooklyn), the parents listed in the finest area's own
address are tried, settlements only. Safeguards:

- a winner found through those parents must contain the pin (point in its
  outline);
- any other same-name settlement among the parents, or among the address lines
  Nominatim marks as non-address, makes it ambiguous, so nothing merges;
- the rule also runs when a coordinate match fails the distance proof
  (Cali, Porto). Brasília stays unverified.

Two spellings that are identical count as the same name even when both carry a
wrapper ("Guangzhou City").

**Human merges.** New York and Tokyo now merge through the typed-era rule, so
their entries in `cityMergeDecisions.json` are kept only as a record and are
not applied (`--include-human-merges` is off by default). The Málaga merge is
revoked and recorded as `separate`: the second record is a dropdown pick of
Málaga province, a different place and tier; it shows under "also in this
region".

**HN-bio links.** `scripts/fetchHnAbouts.ts` and `scripts/auditHnBioLinks.ts`
read every stored HN about and list each `meet.hn/city/...` link that would
404 after the migration. `cityLegacyLinks.json` (committed, no usernames) maps
those 506 ids to their page; the apply writes them as `REDIRECT` items with
reason `hn-bio-legacy-link`.

**Apply.** `scripts/migrateCityIdentity.ts` is read-only by default (dry run).
`--apply --confirm=<table>` writes a journal first, then conditional writes, and
is idempotent; `--rollback=<journal> --confirm=<table>` restores every touched
item. Release steps: `docs/release-checklist.md`.

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
