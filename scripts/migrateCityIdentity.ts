// Re-keys city pages onto OSM objects (ADR 0001): creates/updates CITY pages,
// moves users' cityId, writes one-hop REDIRECTs from retired ids, deletes the
// retired CITY records. Merges are PROVABLE ONLY by default (automated
// verification + the sign-up rules); committed human merges need
// --include-human-merges.
//
//   dry run (default, read-only: Scan + Nominatim, refuses any write):
//     npm run script scripts/migrateCityIdentity.ts -- --table=<name>
//   apply (journals every original item BEFORE writing):
//     npm run script scripts/migrateCityIdentity.ts -- --table=<name> --apply --confirm=<name>
//   roll back an apply:
//     npm run script scripts/migrateCityIdentity.ts -- --table=<name> --rollback=<journal.json> --confirm=<name>
//
// Idempotent: every run diffs the desired state against what the table holds
// now, so a re-run (or a run after a crash midway) only does what is left.
// After an apply or rollback, revalidate the site caches (scripts/revalidateTags.ts).

import { DeleteCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

import { addGeo, buildPlan, Decisions, Plan } from "./buildAliasList";
import type { Snapshot } from "./citySnapshot";
import { docClient } from "./common";
import { lookup, lookupGeo, verifyAll } from "./verifyOsm";

type Item = Record<string, any> & { entityType: string; entityId: string };
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const flag = (k: string) => process.argv.includes(`--${k}`);

const TABLE = arg("table");
const MODE: "dry-run" | "apply" | "rollback" = arg("rollback") ? "rollback" : flag("apply") ? "apply" : "dry-run";
if (!TABLE) {
  console.error("usage: --table=<name> [--apply --confirm=<name> | --rollback=<journal> --confirm=<name>] [--include-human-merges]");
  process.exit(2);
}
process.env.DYNAMODB_TABLE = TABLE;
if (MODE !== "dry-run" && arg("confirm") !== TABLE) {
  console.error(`${MODE} writes to ${TABLE}: pass --confirm=${TABLE}`);
  process.exit(2);
}

// The only door to DynamoDB. In a dry run anything but a read throws.
const READS = new Set([ScanCommand.name, QueryCommand.name]);
async function send(cmd: any): Promise<any> {
  if (MODE === "dry-run" && !READS.has(cmd.constructor.name)) throw new Error(`dry run: refusing ${cmd.constructor.name}`);
  return docClient.send(cmd);
}

async function scanAll(): Promise<Item[]> {
  const items: Item[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;
  do {
    const r = await send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey }));
    items.push(...(r.Items ?? []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}
const usersOn = async (cityId: string): Promise<number> => {
  let n = 0;
  let ExclusiveStartKey: Record<string, any> | undefined;
  do {
    const r = await send(new QueryCommand({
      TableName: TABLE, IndexName: "cityId-updatedAt-index", Select: "COUNT",
      KeyConditionExpression: "cityId = :c", ExpressionAttributeValues: { ":c": cityId }, ExclusiveStartKey,
    }));
    n += r.Count ?? 0;
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return n;
};

// Key-order-independent equality, for "is this write already done?".
const canon = (x: any): any =>
  Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x;
const same = (a: any, b: any) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const clean = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));

export type Ops = {
  cityPuts: { item: Item; before: Item | null; why: string }[];
  redirectPuts: { item: Item; before: Item | null }[];
  userMoves: { username: string; from: string; to: string }[];
  cityDeletes: { before: Item }[];
};

export function diff(items: Item[], plan: Plan, now = Date.now()): Ops {
  const by = (t: string) => new Map(items.filter((i) => i.entityType === t).map((i) => [i.entityId, i]));
  const cities = by("CITY");
  const users = by("USER");
  const redirects = by("REDIRECT");
  const ops: Ops = { cityPuts: [], redirectPuts: [], userMoves: [], cityDeletes: [] };

  for (const p of Object.values(plan.canonicals)) {
    const existing = cities.get(p.id) ?? null;
    const recs = p.fromRecords.map((id) => cities.get(id)).filter((x): x is Item => !!x);
    const links = new Map<string, any>();
    for (const r of [existing, ...recs]) for (const l of r?.communityLinks ?? []) links.set(l.link, l);
    const desired = clean({
      ...(existing ?? {}),
      entityType: "CITY", entityId: p.id, id: p.id,
      name: existing?.name ?? p.name, fullName: existing?.fullName ?? p.fullName,
      country: existing?.country ?? recs.find((r) => r.country)?.country,
      countryCode: existing?.countryCode ?? p.countryCode,
      createdAt: existing?.createdAt ?? Math.min(...recs.map((r) => r.createdAt ?? now)),
      hackers: p.users,
      // A lookup that misses this run never erases what the page already has.
      lat: p.lat ?? existing?.lat, lon: p.lon ?? existing?.lon, bbox: p.bbox ?? existing?.bbox,
      placeType: p.placeType ?? existing?.placeType, state: p.state ?? existing?.state, wikidata: p.wikidata ?? existing?.wikidata,
      communityLinks: links.size ? [...links.values()] : undefined,
    }) as Item;
    if (existing && same(existing, desired)) continue;
    const merges = new Set(p.fromRecords).size > 1;
    const why = !existing ? (merges ? "create-merge" : "create") : merges ? "merge" : existing.hackers !== p.users ? "counter" : "fields";
    ops.cityPuts.push({ item: desired, before: existing, why });
  }

  const finalTo = new Map(Object.entries(plan.aliases));
  for (const [from, to] of Object.entries(plan.aliases)) {
    const before = redirects.get(from) ?? null;
    const item = { entityType: "REDIRECT", entityId: from, to, reason: "city-osm-migration", createdAt: before?.createdAt ?? now };
    if (!before || before.to !== to) ops.redirectPuts.push({ item, before });
  }
  // Existing redirects pointing at a retired id move on (one hop).
  for (const r of redirects.values())
    if (finalTo.has(r.to) && !finalTo.has(r.entityId)) ops.redirectPuts.push({ item: { ...r, to: finalTo.get(r.to)! }, before: r });

  for (const m of plan.userMoves) if (users.get(m.username)?.cityId === m.from) ops.userMoves.push(m);
  for (const id of plan.cityRecordsToRetire) {
    const before = cities.get(id);
    if (before && !plan.canonicals[id]) ops.cityDeletes.push({ before });
  }
  return ops;
}

async function computePlan(items: Item[]): Promise<Plan> {
  const snapshot: Snapshot = {
    takenAt: new Date().toISOString(),
    cities: items.filter((i) => i.entityType === "CITY").map((c) => ({
      id: c.id ?? c.entityId, name: c.name, fullName: c.fullName, country: c.country, countryCode: c.countryCode,
      hackers: c.hackers ?? 0, createdAt: c.createdAt,
      ...(typeof c.lat === "number" && typeof c.lon === "number" ? { lat: c.lat, lon: c.lon } : {}),
    })),
    users: items.filter((i) => i.entityType === "USER").map((u) => ({
      username: u.username ?? u.entityId, cityId: u.cityId, createdAt: u.createdAt, updatedAt: u.updatedAt,
    })),
  };
  const verdicts = await verifyAll(snapshot);
  const committed: Decisions = JSON.parse(readFileSync("./cityMergeDecisions.json", "utf8"));
  const decisions: Decisions = flag("include-human-merges") ? committed : { merges: [], separate: committed.separate };
  const plan = await buildPlan(snapshot, verdicts, decisions, async (key) => {
    const c = await lookup(key);
    return c && { name: c.name, fullName: c.displayName, countryCode: c.cc, lat: c.lat, lon: c.lon };
  }, lookupGeo);
  await addGeo(plan, lookupGeo);
  return plan;
}

function report(ops: Ops, plan: Plan, items: Item[]) {
  const count = (why: string) => ops.cityPuts.filter((c) => c.why === why).length;
  const liveCities = items.filter((i) => i.entityType === "CITY");
  const occupied = new Set(items.filter((i) => i.entityType === "USER").map((u) => u.cityId));
  const livePages = liveCities.filter((c) => occupied.has(c.entityId)).length;
  console.log(`\n${MODE} against ${TABLE}${process.env.DYNAMODB_ENDPOINT ? ` @ ${process.env.DYNAMODB_ENDPOINT}` : ""}`);
  console.log(`  read: ${items.length} items (${liveCities.length} CITY, ${items.filter((i) => i.entityType === "USER").length} USER, ${items.filter((i) => i.entityType === "REDIRECT").length} REDIRECT)`);
  console.log(`  pages with people: ${livePages} → ${Object.values(plan.canonicals).filter((p) => p.users > 0).length}`);
  console.log(`  CITY puts: ${ops.cityPuts.length} (new page ${count("create")}, new page merging several records ${count("create-merge")}, existing page gaining records ${count("merge")}, counter fix ${count("counter")}, new fields ${count("fields")})`);
  console.log(`  USER cityId moves: ${ops.userMoves.length}`);
  console.log(`  REDIRECT puts: ${ops.redirectPuts.length}`);
  console.log(`  CITY deletes (retired ids, after their users moved): ${ops.cityDeletes.length}`);
  console.log(`  merges: ${plan.provenMerges.length} proven page merges, ${plan.humanMerges.length} human merges applied`);
  for (const w of plan.warnings) console.log(`  warning: ${w}`);
  console.log(plan.violations.length ? `  VIOLATIONS (nothing may be applied):\n    ${plan.violations.join("\n    ")}` : "  invariants: all hold");
}

async function apply(ops: Ops, journalPath: string) {
  // Journal first: every original item, and every key we create.
  writeFileSync(journalPath, JSON.stringify({ table: TABLE, at: new Date().toISOString(), ops }, null, 1));
  console.log(`journal → ${journalPath}`);
  for (const c of ops.cityPuts)
    await send(new PutCommand({ TableName: TABLE, Item: c.item, ...(c.before ? {} : { ConditionExpression: "attribute_not_exists(entityId)" }) }))
      .catch((e) => { if (e?.name !== "ConditionalCheckFailedException") throw e; });
  for (const r of ops.redirectPuts) await send(new PutCommand({ TableName: TABLE, Item: r.item }));
  let moved = 0;
  for (const m of ops.userMoves)
    await send(new UpdateCommand({
      TableName: TABLE, Key: { entityType: "USER", entityId: m.username },
      UpdateExpression: "SET cityId = :to", ConditionExpression: "cityId = :from",
      ExpressionAttributeValues: { ":to": m.to, ":from": m.from },
    })).then(() => moved++, (e) => { if (e?.name !== "ConditionalCheckFailedException") throw e; });
  // Counters from the user rows themselves (sign-ups may land during the run).
  for (const id of new Set(ops.cityPuts.map((c) => c.item.entityId)))
    await send(new UpdateCommand({
      TableName: TABLE, Key: { entityType: "CITY", entityId: id }, UpdateExpression: "SET hackers = :n",
      ConditionExpression: "attribute_exists(entityId)", ExpressionAttributeValues: { ":n": await usersOn(id) },
    }));
  const kept: string[] = [];
  for (const d of ops.cityDeletes) {
    if ((await usersOn(d.before.entityId)) > 0) { kept.push(d.before.entityId); continue; } // someone still there: keep
    await send(new DeleteCommand({ TableName: TABLE, Key: { entityType: "CITY", entityId: d.before.entityId } }));
  }
  console.log(`applied: ${ops.cityPuts.length} city puts, ${ops.redirectPuts.length} redirects, ${moved} users moved, ${ops.cityDeletes.length - kept.length} cities retired${kept.length ? `, kept (still has users): ${kept.join(", ")}` : ""}`);
}

async function rollback(journalPath: string) {
  const { table, ops } = JSON.parse(readFileSync(journalPath, "utf8")) as { table: string; ops: Ops };
  if (table !== TABLE) throw new Error(`journal is for ${table}, not ${TABLE}`);
  const skipped: string[] = [];
  for (const m of ops.userMoves)
    await send(new UpdateCommand({
      TableName: TABLE, Key: { entityType: "USER", entityId: m.username },
      UpdateExpression: "SET cityId = :from", ConditionExpression: "cityId = :to",
      ExpressionAttributeValues: { ":to": m.to, ":from": m.from },
    })).catch((e) => { if (e?.name === "ConditionalCheckFailedException") skipped.push(`user ${m.username} moved since`); else throw e; });
  for (const d of ops.cityDeletes) await send(new PutCommand({ TableName: TABLE, Item: d.before }));
  for (const r of ops.redirectPuts)
    await send(r.before ? new PutCommand({ TableName: TABLE, Item: r.before }) : new DeleteCommand({ TableName: TABLE, Key: { entityType: "REDIRECT", entityId: r.item.entityId } }));
  for (const c of ops.cityPuts) {
    if (c.before) { await send(new PutCommand({ TableName: TABLE, Item: c.before })); continue; }
    if ((await usersOn(c.item.entityId)) > 0) { skipped.push(`city ${c.item.entityId} has users that signed up since: kept`); continue; }
    await send(new DeleteCommand({ TableName: TABLE, Key: { entityType: "CITY", entityId: c.item.entityId } }));
  }
  console.log(`rolled back ${journalPath}${skipped.length ? `\n  skipped:\n    ${skipped.join("\n    ")}` : ""}`);
}

async function main() {
  if (MODE === "rollback") return rollback(arg("rollback")!);
  const items = await scanAll();
  const plan = await computePlan(items);
  const ops = diff(items, plan);
  report(ops, plan, items);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync("./migrations", { recursive: true });
  writeFileSync(`./migrations/${MODE}-${stamp}.json`, JSON.stringify({ table: TABLE, ops, provenMerges: plan.provenMerges, warnings: plan.warnings }, null, 1));
  if (MODE === "dry-run") return console.log(`\ndry run: nothing written. Details → ./migrations/${MODE}-${stamp}.json`);
  if (plan.violations.length) throw new Error("violations: not applying");
  const journal = `./migrations/journal-${stamp}.json`;
  if (existsSync(journal)) throw new Error(`${journal} exists`);
  await apply(ops, journal);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
