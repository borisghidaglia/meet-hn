#!/usr/bin/env node
// Measures page weight and load timings of a deployed meet.hn (read-only GETs).
//
//   node scripts/measurePerf.mjs --phase=before            # old ids (before the city migration)
//   node scripts/measurePerf.mjs --phase=after             # new OSM ids (after the release)
//   node scripts/measurePerf.mjs --phase=after --compare=docs/perf/before-2026-11-12.json
//
// Options: --base=https://meet.hn  --runs=3 (Lighthouse runs per page and form factor)
//          --ttfb-runs=7  --no-lighthouse  --out=<file.json>
// Writes docs/perf/<phase>-<date>.json and .md. Needs curl and Google Chrome;
// Lighthouse is run through npx (pinned below).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIGHTHOUSE = "lighthouse@12.6.0";
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const flag = (k) => process.argv.includes(`--${k}`);
const BASE = arg("base", "https://meet.hn").replace(/\/$/, "");
const PHASE = arg("phase", "before");
const RUNS = +arg("runs", "3");
const TTFB_RUNS = +arg("ttfb-runs", "7");
const DATE = new Date().toISOString().slice(0, 10);
const OUT = arg("out", `docs/perf/${PHASE}-${DATE}.json`);

// The same places before and after the migration (ids change; old ids 308 to the new ones).
const PAGES = [
  { name: "home", before: "/", after: "/" },
  { name: "large city (Berlin, ~55 people)", before: "/city/52.510885,13.3989367", after: "/city/R62422" },
  { name: "small city (Basel, 1 person)", before: "/city/47.5581077,7.5878261", after: "/city/R1683619" },
];

const tmp = mkdtempSync(join(tmpdir(), "meethn-perf-"));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const kb = (b) => Math.round(b / 102.4) / 10;
const ms = (s) => Math.round(s * 1000);

// One GET with curl: wire bytes (compressed), decoded bytes, timings, response headers.
function get(url, headers = {}) {
  const body = join(tmp, "body"), head = join(tmp, "head");
  const h = Object.entries({ "Accept-Encoding": "br, gzip", ...headers }).flatMap(([k, v]) => ["-H", `${k}: ${v}`]);
  const w = execFileSync("curl", ["-s", "-o", body, "-D", head, ...h, "-w", "%{http_code} %{size_download} %{time_connect} %{time_starttransfer} %{time_total}", url], { encoding: "utf8" });
  const [code, wire, connect, ttfb, total] = w.split(" ").map(Number);
  const hdrs = Object.fromEntries(readFileSync(head, "utf8").split(/\r?\n/).filter((l) => l.includes(":")).map((l) => [l.slice(0, l.indexOf(":")).toLowerCase(), l.slice(l.indexOf(":") + 1).trim()]));
  const enc = hdrs["content-encoding"];
  const raw = readFileSync(body);
  const decoded = enc === "br" ? execFileSync("brotli", ["-dc"], { input: raw, maxBuffer: 1 << 28 })
    : enc === "gzip" ? execFileSync("gzip", ["-dc"], { input: raw, maxBuffer: 1 << 28 }) : raw;
  return { code, wire, decoded: decoded.length, text: decoded.toString("utf8"), connect, ttfb, total, cache: hdrs["x-vercel-cache"] ?? null, type: hdrs["content-type"] ?? null };
}

function weight(path) {
  const html = get(BASE + path);
  if (html.code !== 200) throw new Error(`${path}: HTTP ${html.code}`);
  // Scripts the HTML loads up front (lazy chunks such as the map show in Lighthouse's total).
  const srcs = [...new Set([...html.text.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")))];
  let jsWire = 0, jsDecoded = 0;
  for (const s of srcs) { const r = get(new URL(s, BASE).href); jsWire += r.wire; jsDecoded += r.decoded; }
  // Client-side navigation data (RSC payload) for the same page.
  const rsc = get(`${BASE}${path}${path.includes("?") ? "&" : "?"}_rsc=measure`, { RSC: "1" });
  return {
    htmlKB: { wire: kb(html.wire), decoded: kb(html.decoded) },
    initialJs: { files: srcs.length, wireKB: kb(jsWire), decodedKB: kb(jsDecoded) },
    rscKB: { wire: kb(rsc.wire), decoded: kb(rsc.decoded), contentType: rsc.type },
  };
}

function ttfb(path) {
  const runs = [];
  for (let i = 0; i < TTFB_RUNS; i++) { const r = get(BASE + path); runs.push({ ttfbMs: ms(r.ttfb), connectMs: ms(r.connect), totalMs: ms(r.total), cache: r.cache }); }
  const warm = runs.slice(1); // the first request may refresh a stale cache entry
  return { firstMs: runs[0].ttfbMs, firstCache: runs[0].cache, warmMedianMs: median(warm.map((r) => r.ttfbMs)), warmMedianTotalMs: median(warm.map((r) => r.totalMs)), cache: [...new Set(runs.map((r) => r.cache))], runs };
}

function lighthouse(path, formFactor) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const out = join(tmp, "lh.json");
    execFileSync("npx", ["-y", LIGHTHOUSE, BASE + path, "--quiet", "--only-categories=performance", "--output=json", `--output-path=${out}`, "--chrome-flags=--headless=new", ...(formFactor === "desktop" ? ["--preset=desktop"] : [])], { stdio: ["ignore", "ignore", "inherit"], timeout: 180_000 });
    const r = JSON.parse(readFileSync(out, "utf8"));
    const a = (id) => r.audits[id]?.numericValue;
    const items = r.audits["resource-summary"]?.details?.items ?? [];
    const res = (t) => items.find((x) => x.resourceType === t)?.transferSize ?? 0;
    runs.push({ score: Math.round(r.categories.performance.score * 100), fcpMs: Math.round(a("first-contentful-paint")), lcpMs: Math.round(a("largest-contentful-paint")), tbtMs: Math.round(a("total-blocking-time")), cls: +a("cumulative-layout-shift").toFixed(3), speedIndexMs: Math.round(a("speed-index")), serverResponseMs: Math.round(a("server-response-time") ?? 0), totalKB: kb(a("total-byte-weight")), scriptKB: kb(res("script")), documentKB: kb(res("document")) });
  }
  const med = {};
  for (const k of Object.keys(runs[0])) med[k] = median(runs.map((r) => r[k]));
  return { median: med, runs };
}

const result = { phase: PHASE, base: BASE, measuredAt: new Date().toISOString(), from: "curl and Lighthouse on Boris's Mac (home network); Lighthouse mobile = default simulated slow 4G + 4x CPU, desktop = --preset=desktop", lighthouse: LIGHTHOUSE, pages: [] };
for (const p of PAGES) {
  const path = p[PHASE] ?? p.after;
  process.stderr.write(`${p.name} ${path}\n`);
  const page = { name: p.name, path, weight: weight(path), ttfb: ttfb(path) };
  if (!flag("no-lighthouse")) page.lighthouse = { mobile: lighthouse(path, "mobile"), desktop: lighthouse(path, "desktop") };
  result.pages.push(page);
}
rmSync(tmp, { recursive: true, force: true });

// Markdown summary (and deltas against an earlier run with --compare).
const prev = arg("compare") ? JSON.parse(readFileSync(arg("compare"), "utf8")) : null;
const d = (now, was, unit = "") => (was === undefined || was === null ? `${now}${unit}` : `${now}${unit} (was ${was})`);
const rows = result.pages.map((p, i) => {
  const q = prev?.pages[i];
  const m = p.lighthouse?.mobile.median, dm = p.lighthouse?.desktop.median, qm = q?.lighthouse?.mobile.median, qd = q?.lighthouse?.desktop.median;
  return [
    `### ${p.name} — \`${p.path}\``, "",
    "| | value |", "|---|---|",
    `| HTML (wire / decoded KB) | ${d(p.weight.htmlKB.wire, q?.weight.htmlKB.wire)} / ${d(p.weight.htmlKB.decoded, q?.weight.htmlKB.decoded)} |`,
    `| Initial JS (${p.weight.initialJs.files} files, wire / decoded KB) | ${d(p.weight.initialJs.wireKB, q?.weight.initialJs.wireKB)} / ${d(p.weight.initialJs.decodedKB, q?.weight.initialJs.decodedKB)} |`,
    `| Navigation data, RSC (wire / decoded KB) | ${d(p.weight.rscKB.wire, q?.weight.rscKB.wire)} / ${d(p.weight.rscKB.decoded, q?.weight.rscKB.decoded)} |`,
    `| TTFB warm median / first request (ms) | ${d(p.ttfb.warmMedianMs, q?.ttfb.warmMedianMs)} / ${p.ttfb.firstMs} (cache: ${p.ttfb.cache.join(", ")}) |`,
    ...(m ? [
      `| Lighthouse mobile: score, FCP, LCP, TBT, CLS | ${d(m.score, qm?.score)}, ${d(m.fcpMs, qm?.fcpMs, " ms")}, ${d(m.lcpMs, qm?.lcpMs, " ms")}, ${d(m.tbtMs, qm?.tbtMs, " ms")}, ${m.cls} |`,
      `| Lighthouse mobile: total / script KB | ${d(m.totalKB, qm?.totalKB)} / ${d(m.scriptKB, qm?.scriptKB)} |`,
      `| Lighthouse desktop: score, FCP, LCP, TBT, CLS | ${d(dm.score, qd?.score)}, ${d(dm.fcpMs, qd?.fcpMs, " ms")}, ${d(dm.lcpMs, qd?.lcpMs, " ms")}, ${d(dm.tbtMs, qd?.tbtMs, " ms")}, ${dm.cls} |`,
    ] : []), "",
  ].join("\n");
});
const md = [`# meet.hn performance — ${PHASE}, ${DATE}`, "", `Base ${BASE}. ${result.from}. Medians of ${RUNS} Lighthouse runs per page and form factor; TTFB is the median of ${TTFB_RUNS - 1} warm curl requests after one first request.${prev ? ` Compared with ${arg("compare")}.` : ""}`, "", `Re-run: \`node scripts/measurePerf.mjs --phase=${PHASE === "before" ? "after" : PHASE} --compare=${OUT}\``, "", ...rows].join("\n");
mkdirSync(OUT.slice(0, OUT.lastIndexOf("/")), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
writeFileSync(OUT.replace(/\.json$/, ".md"), md + "\n");
console.log(md);
