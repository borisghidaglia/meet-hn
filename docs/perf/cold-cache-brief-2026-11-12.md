# Brief: slow first visits and cache invalidation on meet.hn (2026-11-12)

What we want: the best caching architecture for meet.hn on Next.js 16 and
Vercel. Pages must stay fast on a first visit, a sign-up must not force
re-renders across the whole site, counts must be right, and the Vercel bill
must stay low. Nothing is decided yet. A preview fix exists (described below)
but is not merged.

## The site

- Next.js 16.4.6 with Turbopack, React 19, App Router. Vercel **Hobby** plan.
  Functions run in iad1 (the default), which is also where ISR's durable
  storage lives. DynamoDB is in us-east-1.
- Data: 1032 CITY rows, 914 of them with at least one user, and 2258 users.
  Sign-ups are rare: 3 in the last 30 days, 20 in the last 90, and 6 profile
  updates in the last 30 days. Traffic volume is unknown (Hobby, HN audience,
  global, mostly US/EU).
- The visitor-facing pages are `/`, `/city/[...id]` (about 914 pages),
  `/delete` and `/feedback`. Sign-up and deletion are Server Actions.

## How pages read data (files in this repo)

- `app/layout.tsx` sets `export const dynamic = "error"`. It renders
  `<MapComponent />` (`components/MapComponent.tsx`, a server component). That
  component calls `getCities()` and passes about 910 `{id, name, hackers, lat,
  lon}` objects to a client component (`MapContainerClient` → `MapContainer`,
  Leaflet, loaded with `next/dynamic` and `ssr: false`). **The full city list
  is therefore serialized into the RSC payload of every page**, both HTML and
  `.rsc`. Sizes: home is 111 KB raw / 31 KB brotli. Berlin is 408 KB raw /
  49 KB brotli; its flight data is 221 KB, and most of the rest is its long
  user list.
- `app/(not-root)/city/[...id]/page.tsx`:
  - `generateStaticParams` returns `{id: [city.id]}` for every city, so all
    pages are built at deploy.
  - It reads `getCity(id)` (tags `["city", id]`) and `getUsers(id)` (tags
    `["<id>-users", "users"]`).
  - `NearbySection` calls `getCities()` again to list places within 25 km and
    in the same region.
  - An unknown id goes to `getRedirect` (an uncached DynamoDB Get), which
    issues a `permanentRedirect`, or to `notFound`.
- `app/_db/City.ts`: `getCities = unstable_cache(Query CITY hackers>0, tag
  "cities")`. `app/_db/User.ts`: `getUser(username)` has tags `[username,
  "users"]`. `app/_db/Place.ts`: `getDirectory` (read only by sign-up) has
  tags `["cities", "redirects"]`.
- The map pushes `/city/<id>/<Name>` and calls `replaceState` to that URL, so
  shared links and reloads use the name form. The Nearby links use
  `/city/<id>`.
- Mobile LCP work already on the perf branch: an inline script draws the
  map's first tiles before JS loads. It depends only on the initial view (the
  city coordinates in a data attribute), not on the city list.

## What invalidates what today (`main`, live in production)

- **Sign-up**, `app/_actions/addUser.tsx`:
  - lines 153, 188 and 213: `updateTag("cities")`;
  - plus `updateTag` on the city id, `<id>-users` and the username.
- **Delete**, `app/_actions/deleteUser.tsx:92–95`: the same tags.
- **Page re-key during a sign-up**, `app/_db/Place.ts`: `"cities"` plus the
  old and new ids.
- **`/revalidate` route**, used for releases and data fixes:
  `revalidateTag(tag, { expire: 0 })`.
- **Why this expires every page:** every page carries the `cities` tag,
  because of the layout map (and the city page's Nearby section). Build
  output: `city/R62422.meta` has the tags `…, cities, city, R62422,
  R62422-users, users`, and `index.meta` has `…, cities`.
  - So any sign-up or delete expires all about 915 pages, and the next visitor
    to each one waits for a render.
  - This has been the case since 2024: the map has been in the layout since
    2024-09, and `revalidateTag("cities")` has been in sign-up since then. The
    Next 16 upgrade only renamed it to `updateTag`.

## Measurements (TTFB from Paris: edge cdg1, function and ISR in iad1)

| case | result |
|---|---|
| CDN HIT | ~90 ms |
| fresh deploy, first hit of a prerendered page per edge region (`PRERENDER`, the edge pulls from iad1 storage, no render) | 400–820 ms, median ~540 |
| prod before the fix: `/city/<id>/<Name>`, which is never prerendered (`MISS`, a render) | 440–960 ms |
| after `expire: 0` revalidate (or `updateTag`): first visit of each page (`REVALIDATED`, a blocking render) | 630–1506 ms, median 887 |
| render on a cold function | up to 2.6 s |
| after `revalidateTag(…, "max")`: first visit (`STALE`, served from cache, rebuilt in the background) | median 222 ms, then HIT |

## Preview fix (branch `perf-mobile`, not merged)

1. **Rewrite** `beforeFiles: /city/:id/:name+ → /city/:id`. Both URL forms
   use the prerendered entry: the HTML is a HIT right after `/city/<id>`, and
   an RSC map click on a fresh deploy is `PRERENDER` at ~534 ms instead of a
   render. The address bar is unchanged.
2. **`citiesChanged()`**: `revalidateTag("cities", "max")` plus
   `updateTag("place-directory")`, so the sign-up directory has its own tag
   and is always fresh. The page's own tags still use `updateTag`, so the
   user's own page is fresh.
   - I checked Next 16.4.6's source: `unstable_cache`, when the consumer is a
     prerender or ISR render (`willConsumerServerCache`), waits for fresh
     data instead of baking stale data in.
   - A Server Action `redirect()` fetches the target page as a normal request
     with the revalidated tags forwarded.
   - **Trade-off:** other pages can show the previous hacker count for one
     more visit.
3. **`/revalidate` defaults to `"max"`.** `now: true` (the `--now` flag of
   `scripts/revalidateTags.ts`) keeps `expire: 0`, for migrations.

Not used so far:
- Cache Components / PPR, because a dynamic hole would mean one function
  invocation per visit;
- warming after a deploy, which only warms the edge region of the machine that
  runs it.

## Incident today (production, `main`)

- After a data fix, one `/revalidate` call with about 80 tags (`users cities
  redirects` plus 2 per affected id) returned "Done". Pages then came back
  `REVALIDATED`, but **with the old city list**: the `unstable_cache` entry
  for `cities` had evidently not been invalidated.
- A second call with only `cities` fixed it at once, and `city users
  redirects` did the rest.
- The cause is not known. One candidate is the Hobby limit of 50 revalidation
  calls per second per team. Another is some batching behaviour in the route.
- So the current design also depends on one shared data entry being
  invalidated reliably.

## Platform facts gathered (Vercel docs, Next 16 bundled docs)

**Vercel**
- **ISR cache:** one per deployment, kept in durable storage in a single
  region (the default function region), and copied to each edge region on
  demand. The CDN cache is regional, ephemeral and best-effort. Tags are scoped
  per environment, and invalidation propagates within about 300 ms.
- **Hobby limits:** a single function region (Pro allows 5), and 50
  revalidations per second per team.
- **Costs:**
  - ISR reads and writes are counted in 8 KB units; an unchanged
    regeneration costs no write.
  - CDN reads are free; requests and Fast Data Transfer are counted.
  - Origin fetches cost Fast Origin Transfer.
  - Background regenerations count as function invocations.
  - Purges are free but drive regenerations.
- **Next 16 caches on Vercel:**
  - `use cache` (the default) is in memory per instance, which on serverless
    is ephemeral.
  - `use cache: remote` uses the Runtime Cache, which is regional (8 KB units).
  - On Vercel, a PPR page serves its shell through ISR, and a function renders
    the dynamic holes per request.
- **CDN caching of other responses:**
  - A function response with `s-maxage` / `stale-while-revalidate` is cached
    per region, best-effort.
  - The `Vercel-CDN-Cache-Control` and `CDN-Cache-Control` headers exist.
  - The `Vercel-Cache-Tag` response header allows purging by tag.
  - `public/` files are cached globally after the first request.

**Next 16**
- **`cacheComponents: true`:**
  - `export const dynamic`, `revalidate` and `fetchCache` error, and
    `dynamicParams` is incompatible; our layout has `dynamic = "error"`.
  - `generateStaticParams` must return at least one param.
  - `unstable_cache` still works.
  - PPR is the default: `<Suspense>` fallbacks go into the shell, holes stream
    per request, and `use cache` output with a long enough life goes into the
    shell.
- **`cacheLife` profiles** (stale / revalidate / expire):
  - default: 5 min / 15 min / never
  - hours: 5 min / 1 h / 1 d
  - days: 5 min / 1 d / 1 w
  - max: 5 min / 30 d / 1 y
- **Invalidation calls:**
  - `revalidateTag(tag, "max")` serves stale content while it revalidates.
  - `{expire: 0}` blocks the next request.
  - `updateTag` is the Server Action equivalent of `{expire: 0}`.
- **Route revalidation:** it regenerates a page's HTML and RSC together, as
  one entry. Whether invalidating one component's tag regenerates the whole
  page or only that component's entry is not stated.
- **Route handlers:** a GET handler can be prerendered (`force-static`, or with
  Cache Components a `use cache` helper) and revalidated by tag.
- **Client router:** it reuses layouts on navigation and fetches only the leaf.

## Constraints

- **Static:** pages stay static and served from the CDN. No per-visit
  function invocation on the hot path.
- **Low Vercel cost (Hobby):** fewer ISR writes, regenerations and origin
  transfer are welcome.
- **Correct counts after a sign-up:**
  - the user must see their own page fresh right away;
  - the map, Nearby and other pages may lag briefly but must converge;
  - a stale page must never be cached as fresh.
- **Behaviour identical:**
  - the map is on every page with markers and counts, and Nearby stays;
  - the URLs, redirects of old ids, and the address-bar name suffix stay;
  - mobile LCP must not regress (the map preview already draws without JS;
    markers appear after hydration).
- **Process:** no production deploy without Boris's OK. Keep it simple: a
  small codebase, one maintainer.

## Questions

1. What architecture would you choose, and why? Options to weigh:
   - (a) the current preview fix (rewrite + SWR on `cities`);
   - (b) load the map's city list separately from page HTML, for example a
     static or prerendered route handler / JSON (`/cities.json`, tag
     `cities`, CDN-cached), fetched by the map client-side, so that city pages
     no longer carry the `cities` tag;
   - (c) Cache Components with `use cache` + `cacheTag` per component;
   - (d) PPR with the map as a hole;
   - (e) splitting tags (Nearby per region/tile instead of all cities);
   - (f) anything else, including ISR region, warming, or a Vercel plan
     change.
2. If (b): how should the map get its data without hurting mobile LCP or
   marker latency (preload hint, inline only on the home page, a hashed static
   asset rebuilt on sign-up?), and how should the Nearby section (server-side,
   uses all cities) get its data without the page depending on `cities`?
3. Does Cache Components change whether invalidating `cities` re-renders
   every page in this app? Is it worth migrating, given `dynamic = "error"`
   and the cost of per-request holes on Vercel?
4. How do we make cache refreshes reliable, given today's incident (big tag
   batches, the Hobby limit of 50 revalidations/s)?
5. The remaining ~450 ms first-hit cost from Europe after each deploy, paid
   once per page per edge region: accept it, or is there a cheap fix?
6. Risks, an order of steps, and what to measure to validate.
