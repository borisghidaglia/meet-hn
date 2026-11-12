# meet.hn performance — after, 2026-11-12

Base http://localhost:3100. curl and Lighthouse on Boris's Mac (home network); Lighthouse mobile = default simulated slow 4G + 4x CPU, desktop = --preset=desktop. Medians of 3 Lighthouse runs per page and form factor; TTFB is the median of 6 warm curl requests after one first request. Compared with docs/perf/mobile-lcp-2026-11-12-local-before.json.

Re-run: `node scripts/measurePerf.mjs --phase=after --compare=docs/perf/mobile-lcp-2026-11-12-local-after.json`

### home — `/`

| | value |
|---|---|
| HTML (wire / decoded KB) | 31.3 (was 29.6) / 113.4 (was 108.4) |
| Initial JS (16 files, wire / decoded KB) | 269.9 (was 270.5) / 842.1 (was 844) |
| Navigation data, RSC (wire / decoded KB) | 0 (was 0) / 0 (was 0) |
| TTFB warm median / first request (ms) | 4 (was 3) / 4 (cache: ) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 87 (was 79), 909 ms (was 905), 4032 ms (was 5738), 74 ms (was 95), 0 |
| Lighthouse mobile: total / script KB | 652.4 (was 649.4) / 475 (was 475.4) |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 100 (was 97), 247 ms (was 245), 801 ms (was 1265), 0 ms (was 0), 0 |

### large city (Berlin, ~55 people) — `/city/R62422`

| | value |
|---|---|
| HTML (wire / decoded KB) | 63.5 (was 61.4) / 398 (was 392.8) |
| Initial JS (14 files, wire / decoded KB) | 226.9 (was 227.5) / 712.2 (was 714.1) |
| Navigation data, RSC (wire / decoded KB) | 0 (was 0) / 0 (was 0) |
| TTFB warm median / first request (ms) | 8 (was 5) / 8 (cache: ) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 94 (was 88), 1057 ms (was 1055), 3023 ms (was 3093), 79 ms (was 288), 0 |
| Lighthouse mobile: total / script KB | 916.2 (was 930.3) / 477.1 (was 477.5) |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 98 (was 95), 288 ms (was 286), 1077 ms (was 1500), 0 ms (was 0), 0 |

### small city (Basel, 1 person) — `/city/R1683619`

| | value |
|---|---|
| HTML (wire / decoded KB) | 31.2 (was 29.3) / 111.2 (was 106) |
| Initial JS (14 files, wire / decoded KB) | 226.9 (was 227.5) / 712.2 (was 714.1) |
| Navigation data, RSC (wire / decoded KB) | 0 (was 0) / 0 (was 0) |
| TTFB warm median / first request (ms) | 4 (was 3) / 4 (cache: ) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 79 (was 74), 908 ms (was 906), 5499 ms (was 6260), 80 ms (was 221), 0 |
| Lighthouse mobile: total / script KB | 1030.7 (was 1039) / 477.1 (was 477.5) |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 99 (was 95), 246 ms (was 245), 874 ms (was 1508), 0 ms (was 0), 0 |

