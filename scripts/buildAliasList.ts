// Builds the committed alias list from cityOsm.json + cityDecisions.tmp.json.
// READ-ONLY on DynamoDB. Writes ./cityAliases.json (the artifact we commit).
//
//   npm run script scripts/buildAliasList.ts
//
// Output shape:
//   {
//     canonicals: { "<canonicalId>": { osmType, osmId, name, fullName,
//                    countryCode, lat, lon, users, fromRecords:[oldIds...] } },
//     aliases:    { "<oldId>": "<canonicalId>" }   // every id that must redirect
//   }
// canonicalId = osm short form: R<id> | N<id> | W<id> (e.g. R71525).
// Rules: same-osm records always collapse; a multi-osm cluster collapses to the
// chosen canonical (decision "merge") or stays split (decision "separate");
// singletons map to their own osm id. Three legacy schemes (cc-name, lat,lon,
// precision-variants) all fold into one stable osm identity.

import { writeFileSync } from "fs";

type Row = {
  originalId: string;
  name?: string;
  countryCode?: string;
  realUsers: number;
  osm: { osmType: string; osmId: number; addresstype: string; fullName: string; lat: number; lon: number } | null;
  note?: string;
};

const short = (o: { osmType: string; osmId: number }) =>
  `${o.osmType.charAt(0).toUpperCase()}${o.osmId}`;
const decisionToShort = (s: string) => {
  const [t, id] = s.split("/");
  return `${t!.charAt(0).toUpperCase()}${id}`;
};

class UF {
  p = new Map<string, string>();
  find(x: string): string {
    if (!this.p.has(x)) this.p.set(x, x);
    let r = x;
    while (this.p.get(r) !== r) r = this.p.get(r)!;
    return r;
  }
  union(a: string, b: string) { this.p.set(this.find(a), this.find(b)); }
}

const osm = require("../cityOsm.json") as Record<string, Row>;
const decisions = require("../cityDecisions.tmp.json") as Record<string, any>;
const rows = Object.values(osm);

// --- cluster exactly like the review tool ---
const uf = new UF();
const byName = new Map<string, string>();
const byOsm = new Map<string, string>();
for (const r of rows) {
  uf.find(r.originalId);
  if (r.name) {
    const k = `${r.name.trim().toLowerCase()}|${(r.countryCode ?? "").toLowerCase()}`;
    byName.has(k) ? uf.union(r.originalId, byName.get(k)!) : byName.set(k, r.originalId);
  }
  if (r.osm) {
    const k = `${r.osm.osmType}/${r.osm.osmId}`;
    byOsm.has(k) ? uf.union(r.originalId, byOsm.get(k)!) : byOsm.set(k, r.originalId);
  }
}
const groups = new Map<string, Row[]>();
for (const r of rows) (groups.get(uf.find(r.originalId)) ?? groups.set(uf.find(r.originalId), []).get(uf.find(r.originalId))!).push(r);

// Look up the cluster decision by the same id the review tool used.
const decisionFor = (members: Row[]) =>
  decisions[members.map((m) => m.originalId).sort().join("__")];

// --- assign each record a canonical osm short id ---
// We only ever redirect HISTORICAL record ids (the lat,lon / cc-name ids that
// live in existing HN profiles). We deliberately do NOT alias osm ids → osm ids:
// a future user who picks e.g. the Paris suburb is respected, not forced into the
// city. The dropdown's people-counts guide that choice; we never enforce it.
const canonicalOf = new Map<string, string>(); // originalId -> canonicalId
const noOsm: Row[] = [];

for (const members of groups.values()) {
  const distinctOsm = new Set(members.filter((m) => m.osm).map((m) => `${m.osm!.osmType}/${m.osm!.osmId}`));
  const d = members.length > 1 ? decisionFor(members) : undefined;
  const merged = distinctOsm.size > 1 && d?.decision === "merge" && d.canonicalOsm;

  for (const m of members) {
    if (!m.osm) { noOsm.push(m); continue; }
    canonicalOf.set(m.originalId, merged ? decisionToShort(d!.canonicalOsm) : short(m.osm));
  }
}

// --- assemble canonicals + aliases ---
const canonicals: Record<string, any> = {};
const aliases: Record<string, string> = {};

for (const r of rows) {
  const cid = canonicalOf.get(r.originalId);
  if (!cid || !r.osm) continue;
  if (!canonicals[cid]) {
    canonicals[cid] = {
      osmType: r.osm.osmType, osmId: r.osm.osmId,
      name: r.name, fullName: r.osm.fullName, countryCode: r.countryCode,
      lat: r.osm.lat, lon: r.osm.lon, users: 0, fromRecords: [] as string[],
    };
  }
  const c = canonicals[cid];
  c.users += r.realUsers;
  c.fromRecords.push(r.originalId);
  // Prefer richer metadata from the record that IS the canonical osm.
  if (short(r.osm) === cid) {
    c.name = r.name ?? c.name;
    c.fullName = r.osm.fullName;
    c.lat = r.osm.lat; c.lon = r.osm.lon;
  }
  if (r.originalId !== cid) aliases[r.originalId] = cid;
}

writeFileSync(
  "./cityAliases.json",
  JSON.stringify({ generatedAt: "BUILD", canonicals, aliases }, null, 2),
);

// --- report ---
const movingUsers = rows.filter((r) => {
  const cid = canonicalOf.get(r.originalId);
  return r.osm && cid && r.realUsers > 0 && r.originalId !== cid;
});
console.log(`records:            ${rows.length}`);
console.log(`canonical places:   ${Object.keys(canonicals).length}`);
console.log(`alias redirects:    ${Object.keys(aliases).length}`);
console.log(`users to re-point:  ${movingUsers.reduce((s, r) => s + r.realUsers, 0)} (across ${movingUsers.length} records)`);
console.log(`unresolved (no osm):${noOsm.length}  ${noOsm.map((r) => r.originalId).join(", ")}`);
console.log(`\n→ ./cityAliases.json`);
