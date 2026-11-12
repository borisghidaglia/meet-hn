# meet.hn performance — after, 2026-11-12

Base http://localhost:3100. curl and Lighthouse on Boris's Mac (home network); Lighthouse mobile = default simulated slow 4G + 4x CPU, desktop = --preset=desktop. Medians of 3 Lighthouse runs per page and form factor; TTFB is the median of 6 warm curl requests after one first request.

Re-run: `node scripts/measurePerf.mjs --phase=after --compare=docs/perf/mobile-lcp-2026-11-12-local-before.json`

### home — `/`

| | value |
|---|---|
| HTML (wire / decoded KB) | 29.6 / 108.4 |
| Initial JS (16 files, wire / decoded KB) | 270.5 / 844 |
| Navigation data, RSC (wire / decoded KB) | 0 / 0 |
| TTFB warm median / first request (ms) | 3 / 3 (cache: ) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 79, 905 ms, 5738 ms, 95 ms, 0 |
| Lighthouse mobile: total / script KB | 649.4 / 475.4 |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 97, 245 ms, 1265 ms, 0 ms, 0 |

### large city (Berlin, ~55 people) — `/city/R62422`

| | value |
|---|---|
| HTML (wire / decoded KB) | 61.4 / 392.8 |
| Initial JS (14 files, wire / decoded KB) | 227.5 / 714.1 |
| Navigation data, RSC (wire / decoded KB) | 0 / 0 |
| TTFB warm median / first request (ms) | 5 / 6 (cache: ) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 88, 1055 ms, 3093 ms, 288 ms, 0 |
| Lighthouse mobile: total / script KB | 930.3 / 477.5 |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 95, 286 ms, 1500 ms, 0 ms, 0 |

### small city (Basel, 1 person) — `/city/R1683619`

| | value |
|---|---|
| HTML (wire / decoded KB) | 29.3 / 106 |
| Initial JS (14 files, wire / decoded KB) | 227.5 / 714.1 |
| Navigation data, RSC (wire / decoded KB) | 0 / 0 |
| TTFB warm median / first request (ms) | 3 / 3 (cache: ) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 74, 906 ms, 6260 ms, 221 ms, 0 |
| Lighthouse mobile: total / script KB | 1039 / 477.5 |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 95, 245 ms, 1508 ms, 0 ms, 0 |

