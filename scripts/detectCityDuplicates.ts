// READ-ONLY. Only Scans DynamoDB (no Put/Update/Delete) and writes a local JSON
// report. Run with:
//   npm run script scripts/detectCityDuplicates.ts
//
// The prod data is heterogeneous: ids exist in two generations — legacy
// `countrycode-cityname` (e.g. fr-Paris) and current `lat,lon` — and many
// records predate the `fullName` field. So we can't dedup on a single key.
// Instead we cluster by normalized (name + countryCode), which spans BOTH id
// schemes, then grade each multi-id cluster's confidence using fullName and
// coordinate proximity as secondary signals:
//   HIGH   — every member shares an identical fullName, OR all coords ≤ MAX_KM
//   REVIEW — same name+country but fullNames differ / coords spread / no coords
// Proposed canonical per cluster = the id with the most real users
// (tie-break: earliest createdAt) — i.e. the populated spot.

import { writeFileSync } from "fs";

import { City, DbUser } from "@/app/_db/schema";
import { getAllCities, getAllUsers } from "./common";

const MAX_KM = 25;

type Member = {
  id: string;
  name?: string;
  fullName?: string;
  country?: string;
  countryCode?: string;
  scheme: "latlon" | "legacy";
  coords: [number, number] | null;
  storedHackers: number;
  realUsers: number;
  createdAt: number;
};

type Cluster = {
  confidence: "HIGH" | "REVIEW";
  reason: string;
  key: string;
  canonicalId: string;
  members: Member[];
};

function parseCoords(id: string): [number, number] | null {
  const m = id?.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pickCanonical(members: Member[]): string {
  return [...members].sort(
    (a, b) => b.realUsers - a.realUsers || a.createdAt - b.createdAt,
  )[0]!.id;
}

// Max pairwise distance among members that have coords (0 if <2 have coords).
function maxSpreadKm(members: Member[]): number {
  const pts = members.map((m) => m.coords).filter((c): c is [number, number] => !!c);
  let max = 0;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      max = Math.max(max, haversineKm(pts[i]!, pts[j]!));
  return max;
}

async function main() {
  const [cities, users] = await Promise.all([getAllCities(), getAllUsers()]);

  const realUsersByCity = new Map<string, number>();
  for (const u of users as DbUser[])
    realUsersByCity.set(u.cityId, (realUsersByCity.get(u.cityId) ?? 0) + 1);

  const members: Member[] = (cities as City[]).map((c) => {
    // Some legacy records lack the `id` attribute; the key always lives in entityId.
    const id = c.id ?? (c as unknown as { entityId: string }).entityId;
    const coords = parseCoords(id);
    return {
      id,
      name: c.name,
      fullName: c.fullName,
      country: c.country,
      countryCode: c.countryCode,
      scheme: coords ? "latlon" : "legacy",
      coords,
      storedHackers: c.hackers ?? 0,
      realUsers: realUsersByCity.get(c.id) ?? 0,
      createdAt: c.createdAt ?? 0,
    };
  });

  // --- Data shape breakdown ---
  const legacy = members.filter((m) => m.scheme === "legacy");
  const latlon = members.filter((m) => m.scheme === "latlon");
  const noName = members.filter((m) => !m.name);
  const noFullName = members.filter((m) => !m.fullName);

  // --- Cluster by normalized name + countryCode (spans both schemes) ---
  const byNameCountry = new Map<string, Member[]>();
  const unkeyable: Member[] = [];
  for (const m of members) {
    if (!m.name) {
      unkeyable.push(m);
      continue;
    }
    const key = `${m.name.trim().toLowerCase()}|${(m.countryCode ?? "").toLowerCase()}`;
    const list = byNameCountry.get(key) ?? [];
    list.push(m);
    byNameCountry.set(key, list);
  }

  const clusters: Cluster[] = [];
  for (const [key, group] of byNameCountry) {
    if (group.length < 2) continue;
    const fullNames = new Set(group.filter((m) => m.fullName).map((m) => m.fullName));
    const spread = maxSpreadKm(group);
    const everyHasFullName = group.every((m) => m.fullName);
    const everyHasCoords = group.every((m) => m.coords);

    let confidence: Cluster["confidence"] = "REVIEW";
    let reason = "same name+country; fullNames differ or coords unknown/spread";
    if (everyHasFullName && fullNames.size === 1) {
      confidence = "HIGH";
      reason = "identical fullName";
    } else if (everyHasCoords && spread <= MAX_KM) {
      confidence = "HIGH";
      reason = `all coords within ${spread.toFixed(1)}km`;
    }

    clusters.push({
      confidence,
      reason,
      key,
      canonicalId: pickCanonical(group),
      members: group,
    });
  }

  // --- Report ---
  const fmt = (m: Member, canonicalId: string) => {
    const mark = m.id === canonicalId ? "→ CANON" : "  alias ";
    return `    ${mark} [${m.scheme === "legacy" ? "OLD" : "ll "}] users=${String(
      m.realUsers,
    ).padStart(3)} id=${m.id.padEnd(38)} fullName=${m.fullName ?? "(none)"}`;
  };

  const high = clusters.filter((c) => c.confidence === "HIGH");
  const review = clusters.filter((c) => c.confidence === "REVIEW");
  const sortByDupUsers = (a: Cluster, b: Cluster) =>
    b.members.length - a.members.length;

  const printGroup = (label: string, list: Cluster[]) => {
    console.log(`\n${"=".repeat(72)}\n${label} — ${list.length} cluster(s)\n${"=".repeat(72)}`);
    for (const c of [...list].sort(sortByDupUsers)) {
      const dupUsers = c.members
        .filter((m) => m.id !== c.canonicalId)
        .reduce((s, m) => s + m.realUsers, 0);
      console.log(
        `\n• ${c.members[0]!.name} / ${c.members[0]!.countryCode ?? "?"}  (${c.members.length} ids, ${dupUsers} user(s) off-canonical) — ${c.reason}`,
      );
      for (const m of c.members) console.log(fmt(m, c.canonicalId));
    }
  };

  printGroup("HIGH confidence (same place, safe to alias)", high);
  printGroup("REVIEW (same name+country, needs your eyes)", review);

  const dupUsersIn = (list: Cluster[]) =>
    list.reduce(
      (s, c) =>
        s + c.members.filter((m) => m.id !== c.canonicalId).reduce((a, m) => a + m.realUsers, 0),
      0,
    );

  console.log(`\n${"=".repeat(72)}\nDATA SHAPE`);
  console.log(`  cities scanned:        ${cities.length}`);
  console.log(`  users scanned:         ${users.length}`);
  console.log(`  legacy ids (cc-name):  ${legacy.length}`);
  console.log(`  lat,lon ids:           ${latlon.length}`);
  console.log(`  missing name:          ${noName.length}`);
  console.log(`  missing fullName:      ${noFullName.length}`);
  console.log(`  unkeyable (no name):   ${unkeyable.length}`);
  console.log(`\nDUPLICATE CLUSTERS (by name+country)`);
  console.log(`  HIGH confidence:       ${high.length}  (${dupUsersIn(high)} users would move to canonical)`);
  console.log(`  REVIEW:                ${review.length}  (${dupUsersIn(review)} users involved)`);
  console.log(`${"=".repeat(72)}`);

  const reportPath = "./scripts/cityDuplicates.report.json";
  writeFileSync(
    reportPath,
    JSON.stringify({ high, review, unkeyable }, null, 2),
  );
  console.log(`\nFull report → ${reportPath} (DynamoDB untouched).`);
}

main();
