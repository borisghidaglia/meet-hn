// The whole city re-keying pipeline, recomputed from LIVE data every run:
//   snapshot (read-only Scan) → verify (Nominatim, cached) → plan (pure)
// Nothing is carried over from earlier runs except the Nominatim response cache
// and the committed human decisions, so running it at publish time picks up
// every city and user created, moved or deleted until that moment.
// This script performs NO DynamoDB writes.
//
//   npm run script scripts/cityPipeline.ts -- --table=<live table name>
//
// The table must be named explicitly: .env.local may point at an analysis copy.

import { writeFileSync } from "fs";

import { addGeo, buildPlan, Decisions, reportPlan, writePlan } from "./buildAliasList";
import { takeSnapshot } from "./citySnapshot";
import { lookup, lookupGeo, reportVerification, verifyAll } from "./verifyOsm";

export async function runPipeline(table: string) {
  process.env.DYNAMODB_TABLE = table; // read at Scan time by scripts/common.ts
  const snapshot = await takeSnapshot();
  console.log(`snapshot of ${table} at ${snapshot.takenAt}: ${snapshot.cities.length} cities, ${snapshot.users.length} users`);
  writeFileSync("./citySnapshot.json", JSON.stringify({ table, ...snapshot }, null, 2));

  const verdicts = await verifyAll(snapshot);
  writeFileSync("./cityVerification.json", JSON.stringify(verdicts, null, 2));
  reportVerification(verdicts);

  const decisions: Decisions = require("../cityMergeDecisions.json");
  const plan = await buildPlan(snapshot, verdicts, decisions, async (key) => {
    const c = await lookup(key);
    return c && { name: c.name, fullName: c.displayName, countryCode: c.cc, lat: c.lat, lon: c.lon };
  }, lookupGeo);
  await addGeo(plan, lookupGeo);
  console.log("");
  reportPlan(plan, snapshot);
  if (!plan.violations.length) writePlan(plan);
  return plan;
}

if (typeof require !== "undefined" && require.main === module) {
  const table = process.argv.find((a) => a.startsWith("--table="))?.slice("--table=".length);
  if (!table) {
    console.error("usage: npm run script scripts/cityPipeline.ts -- --table=<live table name>");
    process.exit(2);
  }
  runPipeline(table).then((p) => process.exit(p.violations.length ? 1 : 0));
}
