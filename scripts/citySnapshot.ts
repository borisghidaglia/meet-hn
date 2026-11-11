// READ-ONLY snapshot of the live table: every CITY and USER item, via Scan only
// (scripts/common.ts issues no Put/Update/Delete). The pipeline always starts
// from this, so nothing it decides is baked from an old copy.
//
//   npm run script scripts/citySnapshot.ts   # writes ./citySnapshot.json
//
// Users are reduced to what the pipeline needs (no `about` text).

import { writeFileSync } from "fs";

import { City, DbUser } from "@/app/_db/schema";
import { getAllCities, getAllUsers } from "./common";

export type SnapCity = {
  id: string;
  name?: string;
  fullName?: string;
  country?: string;
  countryCode?: string;
  hackers: number;
  createdAt?: number;
};
export type SnapUser = { username: string; cityId: string; createdAt?: number; updatedAt?: number };
export type Snapshot = { takenAt: string; cities: SnapCity[]; users: SnapUser[] };

export async function takeSnapshot(): Promise<Snapshot> {
  const takenAt = new Date().toISOString();
  const [cities, users] = await Promise.all([getAllCities(), getAllUsers()]);
  return {
    takenAt,
    cities: (cities as (City & { entityId?: string })[]).map((c) => ({
      id: c.id ?? c.entityId!,
      name: c.name,
      fullName: c.fullName,
      country: c.country,
      countryCode: c.countryCode,
      hackers: c.hackers ?? 0,
      createdAt: c.createdAt,
    })),
    users: (users as (DbUser & { entityId?: string })[]).map((u) => ({
      username: u.username ?? u.entityId!,
      cityId: u.cityId,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
  };
}

if (typeof require !== "undefined" && require.main === module) {
  takeSnapshot().then((s) => {
    writeFileSync("./citySnapshot.json", JSON.stringify(s, null, 2));
    console.log(`${s.takenAt}: ${s.cities.length} cities, ${s.users.length} users → ./citySnapshot.json`);
  });
}
