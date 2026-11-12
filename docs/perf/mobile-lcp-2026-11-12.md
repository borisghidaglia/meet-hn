# Mobile LCP — 2026-11-12 (branch perf-mobile)

## What drove it

Lighthouse mobile's LCP element on `/` and on small city pages is an
OpenStreetMap tile (`img.leaflet-tile`). Its request could only start after
all initial JS had downloaded and hydrated, the Leaflet chunk had loaded and
the map had been created: 64% of LCP was "load delay". gtag.js (178 KB) was
preloaded in `<head>` and shared the slow-4G bandwidth with all of that. On
city pages the map also opened on the region (zoom 3), then moved to the city
(zoom 6): two sets of tiles, and the zoom-6 ones are ~50 KB each.

Fonts and images play no part. The initial JS (~270 KB) is mostly Next/React,
and the polyfills chunk is `noModule`, so modern browsers never download it.

## Changes

- `components/MapPreview.tsx` and `app/_lib/mapView.ts`: an inline script,
  run while the HTML is parsed, computes the tiles Leaflet will show at first
  (the same projection, rounding and max-bounds clamp as Leaflet 1.9) and adds
  them as plain `<img>`s under the map. Leaflet mounts on top with a
  transparent background, gets the same URLs from the HTTP cache, and hides
  the preview once its own tiles have loaded. In Chrome, preview and Leaflet
  tiles matched to the pixel (412×823 mobile; 1440, 1600 and 2560 wide
  desktop; Europe, America, Pacific and Australia time zones; OSM and legacy
  `lat,lon` city ids).
- City pages open the map directly at the city (zoom 6) instead of
  region → city. The view ends up the same.
- Google Analytics: the same gtag tag, started once the map's first tiles
  have loaded, or after 10 s at the latest (`components/GoogleAnalytics.tsx`).
  Visitors who leave within about a second are no longer counted; Boris
  accepted this trade-off on 2026-11-12.
- `preconnect` to tile.openstreetmap.org. The Leaflet chunk starts
  downloading when the client module is first evaluated, before hydration
  reaches the map.

Vercel cost: none added. Tiles come from OSM, the pages stay static, and each
HTML page grows by ~1.5 KB.

## Results (Lighthouse mobile LCP, median of 3)

| page | prod | preview (this branch) |
|---|---|---|
| home `/` | 5982 ms | **2849 ms** |
| Berlin `/city/R62422` | 2980 ms | 2999 ms (its LCP is not the map) |
| Basel `/city/R1683619` | 6755 ms | **4458 ms** |

Desktop LCP: home 1476 → 727 ms, Berlin 1594 → 900 ms, Basel 1673 → 1081 ms.
Mobile TBT fell from 70–161 ms to 54–69 ms.

Both columns were measured the same way: through a local proxy, because
preview deployments sit behind Vercel Authentication (the proxy adds the
automation-bypass header only on requests to the preview). See
`mobile-lcp-2026-11-12-prod.*` and `-preview.*`. Local `next start` runs
(`-local-before.*`, `-local-after.*`) showed the same trend.

Basel stays above home because its zoom-6 tiles weigh ~450 KB, and they are
the map itself.
