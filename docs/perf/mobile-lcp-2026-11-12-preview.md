# meet.hn performance — after, 2026-11-12

Base http://localhost:3201. curl and Lighthouse on Boris's Mac (home network); Lighthouse mobile = default simulated slow 4G + 4x CPU, desktop = --preset=desktop. Medians of 3 Lighthouse runs per page and form factor; TTFB is the median of 6 warm curl requests after one first request. Compared with docs/perf/mobile-lcp-2026-11-12-prod.json.

Re-run: `node scripts/measurePerf.mjs --phase=after --compare=docs/perf/mobile-lcp-2026-11-12-preview.json`

### home — `/`

| | value |
|---|---|
| HTML (wire / decoded KB) | 31.7 (was 29.8) / 114.1 (was 108.9) |
| Initial JS (16 files, wire / decoded KB) | 278.4 (was 278.9) / 842.5 (was 844.5) |
| Navigation data, RSC (wire / decoded KB) | 28.4 (was 26.7) / 86 (was 83.4) |
| TTFB warm median / first request (ms) | 33 (was 31.5) / 34 (cache: HIT) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 96 (was 78), 966 ms (was 965), 2849 ms (was 5982), 61 ms (was 70), 0 |
| Lighthouse mobile: total / script KB | 672.8 (was 668.1) / 490.2 (was 490) |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 100 (was 95), 303 ms (was 306), 727 ms (was 1476), 0 ms (was 0), 0 |

### large city (Berlin, ~55 people) — `/city/R62422`

| | value |
|---|---|
| HTML (wire / decoded KB) | 47.7 (was 46) / 398.6 (was 393.2) |
| Initial JS (14 files, wire / decoded KB) | 234.3 (was 234.8) / 712.6 (was 714.6) |
| Navigation data, RSC (wire / decoded KB) | 42.4 (was 40.8) / 191.6 (was 188.9) |
| TTFB warm median / first request (ms) | 31.5 (was 37) / 44 (cache: HIT) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 94 (was 91), 1114 ms (was 1111), 2999 ms (was 2980), 69 ms (was 148), 0 |
| Lighthouse mobile: total / script KB | 921.5 (was 928.2) / 492.6 (was 492.4) |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 99 (was 94), 346 ms (was 346), 900 ms (was 1594), 0 ms (was 0), 0 |

### small city (Basel, 1 person) — `/city/R1683619`

| | value |
|---|---|
| HTML (wire / decoded KB) | 31.1 (was 29.1) / 111.8 (was 106.4) |
| Initial JS (14 files, wire / decoded KB) | 234.3 (was 234.8) / 712.6 (was 714.6) |
| Navigation data, RSC (wire / decoded KB) | 28.9 (was 27.3) / 88.6 (was 85.9) |
| TTFB warm median / first request (ms) | 29.5 (was 31) / 57 (cache: HIT) |
| Lighthouse mobile: score, FCP, LCP, TBT, CLS | 85 (was 74), 965 ms (was 960), 4458 ms (was 6755), 54 ms (was 161), 0 |
| Lighthouse mobile: total / script KB | 1053.4 (was 1110.4) / 492.6 (was 492.4) |
| Lighthouse desktop: score, FCP, LCP, TBT, CLS | 98 (was 93), 307 ms (was 301), 1081 ms (was 1673), 0 ms (was 0), 0 |

