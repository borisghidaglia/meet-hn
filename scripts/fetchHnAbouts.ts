// Fetches every user's HN profile "about" from the official API, politely:
// 2 in flight, ≥350 ms between request starts (≤ ~3/s), exponential backoff on
// 429/5xx/network errors. Resumable: results are appended to a local cache and
// skipped on the next run.
//
//   npm run script scripts/fetchHnAbouts.ts        # usernames from ./citySnapshot.json
//
// Read-only (HN API + local files). Writes ./hnAboutCache.jsonl (gitignored).

import { appendFileSync, existsSync, readFileSync } from "fs";

export const HN_CACHE = "./hnAboutCache.jsonl";
const UA = "meet.hn link audit (https://meet.hn)";
const GAP_MS = 350;
const CONCURRENCY = 2;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function readHnCache(): Map<string, { about: string | null; missing?: boolean }> {
  const m = new Map();
  if (existsSync(HN_CACHE))
    for (const line of readFileSync(HN_CACHE, "utf8").split("\n"))
      if (line) {
        const r = JSON.parse(line);
        m.set(r.username, r);
      }
  return m;
}

let nextStart = 0;
async function slot() {
  const now = Date.now();
  const at = Math.max(now, nextStart);
  nextStart = at + GAP_MS;
  if (at > now) await wait(at - now);
}

async function fetchAbout(username: string): Promise<{ about: string | null; missing?: boolean }> {
  for (let attempt = 0; ; attempt++) {
    await slot();
    try {
      const res = await fetch(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username.trim())}.json`, { headers: { "User-Agent": UA } });
      if (res.ok) {
        const u = await res.json();
        return u ? { about: u.about ?? null } : { about: null, missing: true };
      }
      if (res.status !== 429 && res.status < 500) return { about: null, missing: true };
    } catch {}
    if (attempt >= 5) throw new Error(`giving up on ${username}`);
    await wait(2000 * 2 ** attempt);
  }
}

async function main() {
  const { users } = JSON.parse(readFileSync("./citySnapshot.json", "utf8"));
  const cache = readHnCache();
  const todo: string[] = [...new Set<string>(users.map((u: any) => u.username))].filter((u) => !cache.has(u) || (cache.get(u)!.missing && u !== u.trim())); // stray whitespace in stored names: retry trimmed
  console.log(`${users.length} users, ${cache.size} cached, ${todo.length} to fetch`);
  let done = 0;
  const worker = async () => {
    for (let u = todo.shift(); u !== undefined; u = todo.shift()) {
      const r = await fetchAbout(u);
      appendFileSync(HN_CACHE, JSON.stringify({ username: u, ...r, fetchedAt: Date.now() }) + "\n");
      if (++done % 100 === 0) console.log(`  ${done} fetched`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`done: ${done} fetched`);
}

if (typeof require !== "undefined" && require.main === module) main();
