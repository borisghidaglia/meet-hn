# meet.hn performance — after, 2026-11-12

Base http://localhost:3202. curl and Lighthouse on Boris's Mac (home network); Lighthouse mobile = default simulated slow 4G + 4x CPU, desktop = --preset=desktop. Medians of 3 Lighthouse runs per page and form factor; TTFB is the median of 6 warm curl requests after one first request.

Re-run: `node scripts/measurePerf.mjs --phase=after --compare=docs/perf/mobile-lcp-2026-11-12-prod.json`

### home — `/`

| | value |
|---|---|
| HTML (wire / decoded KB) | 29.8 / 108.9 |
| Initial JS (16 files, wire / decoded KB) | 278.9 / 844.5 |
| Navigation data, RSC (wire / decoded KB) | 26.7 / 83.4 |
| TTFB warm median / first request (ms) | 31.5 / 39 (cache: HIT) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 78, 965 ms, 5982 ms, 70 ms, 0 |
| Lighthouse mobile: total / script KB | 668.1 / 490 |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 95, 306 ms, 1476 ms, 0 ms, 0 |

### large city (Berlin, ~55 people) — `/city/R62422`

| | value |
|---|---|
| HTML (wire / decoded KB) | 46 / 393.2 |
| Initial JS (14 files, wire / decoded KB) | 234.8 / 714.6 |
| Navigation data, RSC (wire / decoded KB) | 40.8 / 188.9 |
| TTFB warm median / first request (ms) | 37 / 37 (cache: HIT) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 91, 1111 ms, 2980 ms, 148 ms, 0 |
| Lighthouse mobile: total / script KB | 928.2 / 492.4 |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 94, 346 ms, 1594 ms, 0 ms, 0 |

### small city (Basel, 1 person) — `/city/R1683619`

| | value |
|---|---|
| HTML (wire / decoded KB) | 29.1 / 106.4 |
| Initial JS (14 files, wire / decoded KB) | 234.8 / 714.6 |
| Navigation data, RSC (wire / decoded KB) | 27.3 / 85.9 |
| TTFB warm median / first request (ms) | 31 / 38 (cache: HIT) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 74, 960 ms, 6755 ms, 161 ms, 0 |
| Lighthouse mobile: total / script KB | 1110.4 / 492.4 |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 93, 301 ms, 1673 ms, 0 ms, 0 |

