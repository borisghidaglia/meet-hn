# Slow first visit of a city page — 2026-11-12 (branch perf-mobile)

## What was happening

- City pages are prerendered at build (`generateStaticParams`, ~920 pages, all
  served `PRERENDER`). But the map links to `/city/<id>/<Name>` and writes that
  into the address bar, and that path was never prerendered. It was a separate
  cache entry, rendered on its first visit. The RSC request (client
  navigation) and the HTML (a reload or a shared link) were each a `MISS` on
  production, at 440–960 ms, while a `HIT` took ~90 ms.
- Every page depends on the `cities` tag, because the map is in the layout and
  the city page has its Nearby section. Each sign-up or deletion called
  `updateTag("cities")`, and the release revalidate used `expire: 0`. Either
  one expired all ~920 pages at once, so the next visit of each page waited for
  a render (`REVALIDATED`). A render on a cold function took up to 2.6 s.
- The ISR cache is one per deployment. It is stored durably in a single region
  (iad1) and copied to each edge region on demand. Tags are scoped per
  environment, so a preview revalidate never touches production.

## Changes

- `next.config.js`: the rewrite `/city/:id/:name+` → `/city/:id`. Both URLs are
  served by the page prerendered at build and share one cache entry. The
  address bar is unchanged, and the page only reads the id. An old id with a
  name now redirects to `/city/<new id>`, and the map then puts the name back
  in the address bar, as it already did.
- `citiesChanged()` (`app/_db/City.ts`) replaces `updateTag("cities")` in
  sign-up, deletion and page re-keying. It calls `revalidateTag("cities",
  "max")`: cached pages are served as they are and rebuilt in the
  background. A page rendered for the cache, such as the city page a sign-up
  redirects to, still waits for the fresh city list. Next does not hand stale
  `unstable_cache` data to a render that will be cached. Each page's own tags
  (city id, `<id>-users`, username) still use `updateTag`, so a new sign-up
  sees their own page fresh. The only visible difference: other pages may show
  the previous hacker count once more.
- The sign-up resolver's directory (`getDirectory`, read by no page) gets its
  own tag. That tag is expired immediately, so the next sign-up plans against
  fresh data.
- `/revalidate` now marks tags stale by default. `now: true`
  (`scripts/revalidateTags.ts -- --now …`) keeps the old immediate expiry. The
  release checklist uses `--now` for migrations, when old ids must not be
  shown even once.

## Measured (preview, edge cdg1 → ISR region iad1; 9 cities, TTFB)

| first visit | before | after |
|---|---|---|
| `/city/<id>/<Name>`, fresh deploy, RSC (map click) | MISS 440–820 ms (prod) | PRERENDER 429–615 ms, median 534 |
| `/city/<id>/<Name>`, HTML after `/city/<id>` | MISS (prod) | HIT, median 97 ms |
| any page after a revalidate / sign-up | REVALIDATED 630–1506 ms, median 887 | STALE, median 222 ms |
| after that | HIT ~90 ms | HIT ~90 ms |

The "before" revalidate row is the same preview with `now: true`, which is the
old behaviour.

The remaining ~450 ms on a page's very first visit from Europe comes from the
edge fetching the prerendered page from iad1. It is paid once per page per
edge region per deployment, and involves no render. Moving the function region
would only move that cost onto US visitors.

Vercel cost: lower. There is one cache entry per city instead of one per URL
form, and a sign-up no longer forces ~920 blocking re-renders. Pages are
rebuilt only when someone visits them, as before.

Not used: Cache Components / PPR. The pages are already fully static, and a
dynamic hole would add a function invocation to every visit. Warming after a
deploy was also left out: it would only warm the edge region of the machine
running it, and the revalidate case no longer needs it.
