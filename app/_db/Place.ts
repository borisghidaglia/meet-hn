import "server-only";

// Storage side of sign-up resolution (rules: app/_lib/resolvePlace.ts).
//   CITY items                  pages; entityId = OSM key (or a legacy id)
//   REDIRECT items              entityId = old id, `to` = live page id (one hop)
//   SUSPECTED_DUPLICATE items   for Boris to review; never acted on automatically

import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { revalidateTag, unstable_cache } from "next/cache";

import { docClient } from "@/app/_db/Client";
import { City } from "@/app/_db/schema";
import { cityGeo } from "@/app/_lib/nearby";
import { lookupUrl, OSM_KEY, Place, toPlace } from "@/app/_lib/nominatim";
import { Directory, redirectWrites } from "@/app/_lib/resolvePlace";

const TABLE = () => process.env.DYNAMODB_TABLE!;
const UA = "meet.hn (https://meet.hn)";

async function queryAll<T>(entityType: string): Promise<T[]> {
  const items: T[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;
  do {
    const r = await docClient.send(
      new QueryCommand({
        TableName: TABLE(),
        KeyConditionExpression: "entityType = :t",
        ExpressionAttributeValues: { ":t": entityType },
        ExclusiveStartKey,
      }),
    );
    items.push(...((r.Items ?? []) as T[]));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export const cityToPlace = (c: City): Place | null => {
  const g = cityGeo(c);
  if (!g) return null;
  return {
    id: c.id, name: c.name ?? "", fullName: c.fullName ?? "", country: c.country, countryCode: c.countryCode,
    state: c.state ?? null, lat: g.lat, lon: g.lon, bbox: c.bbox ?? null, placeType: c.placeType ?? null,
    wikidata: c.wikidata ?? null,
  };
};

// Everything the resolver looks at, read fresh enough (invalidated on writes).
export const getDirectory = unstable_cache(
  async (): Promise<{ pages: City[]; redirects: [string, string][] }> => {
    const [pages, redirects] = await Promise.all([
      queryAll<City & { entityId: string }>("CITY"),
      queryAll<{ entityId: string; to: string }>("REDIRECT"),
    ]);
    return {
      pages: pages.map((p) => ({ ...p, id: p.id ?? p.entityId })),
      redirects: redirects.map((r) => [r.entityId, r.to]),
    };
  },
  ["place-directory"],
  { tags: ["cities", "redirects"] },
);

export async function loadDirectory(): Promise<Directory & { cities: Map<string, City>; redirectMap: Map<string, string> }> {
  const { pages, redirects } = await getDirectory();
  const cities = new Map(pages.map((c) => [c.id, c]));
  const places = new Map<string, Place>();
  for (const c of pages) {
    const p = cityToPlace(c);
    if (p) places.set(c.id, p);
  }
  const redirectMap = new Map(redirects);
  return {
    // A legacy page without coordinates still counts as live for id lookups.
    page: (id) => places.get(id) ?? (cities.has(id) ? ({ id, name: cities.get(id)!.name, fullName: "", lat: NaN, lon: NaN } as Place) : undefined),
    redirect: (id) => redirectMap.get(id),
    pages: [...places.values()],
    cities,
    redirectMap,
  };
}

export const getRedirect = async (id: string) => {
  const r = await docClient.send(new GetCommand({ TableName: TABLE(), Key: { entityType: "REDIRECT", entityId: id } }));
  return (r.Item?.to as string | undefined) ?? undefined;
};

// Server-side re-fetch of an OSM object (never trust what the browser sent).
// null = OSM no longer has it.
export const lookupOsm = unstable_cache(
  async (key: string): Promise<Place | null> => {
    if (!OSM_KEY.test(key)) return null;
    const res = await fetch(lookupUrl([key]), { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`Nominatim lookup ${key}: HTTP ${res.status}`);
    const [r] = await res.json();
    return toPlace(r);
  },
  ["osm-lookup"],
  { revalidate: 60 * 60 * 24 },
);

export async function writeRedirect(from: string, to: string, reason: string, existing: Map<string, string>) {
  const now = Date.now();
  for (const w of redirectWrites(from, to, existing))
    await docClient.send(
      new PutCommand({
        TableName: TABLE(),
        Item: { entityType: "REDIRECT", entityId: w.from, to: w.to, reason, createdAt: now },
      }),
    );
  revalidateTag("redirects");
}

export async function logSuspect(pickId: string, pageId: string, reason: string, username: string) {
  await docClient.send(
    new PutCommand({
      TableName: TABLE(),
      Item: { entityType: "SUSPECTED_DUPLICATE", entityId: `${pickId}|${pageId}`, pickId, pageId, reason, username, createdAt: Date.now() },
    }),
  );
}

export const placeToCity = (p: Place, createdAt: number, hackers = 0): City => ({
  id: p.id, name: p.name, fullName: p.fullName, country: p.country, countryCode: p.countryCode,
  hackers, createdAt, lat: p.lat, lon: p.lon, ...(p.bbox ? { bbox: p.bbox } : {}),
  ...(p.placeType ? { placeType: p.placeType } : {}), ...(p.state ? { state: p.state } : {}),
  ...(p.wikidata ? { wikidata: p.wikidata } : {}),
});

// A page whose OSM object is gone is re-keyed onto its proven successor:
// new CITY item, every user's cityId rewritten, old id redirected (one hop),
// old item deleted, counter recomputed from user rows. Each step is
// conditional/idempotent, so a crash midway is finished by simply re-running.
export async function rekeyPage(old: City, successor: Place, reason: string, redirects: Map<string, string>) {
  const newId = successor.id;
  await docClient
    .send(
      new PutCommand({
        TableName: TABLE(),
        Item: {
          entityType: "CITY", entityId: newId,
          ...placeToCity(successor, old.createdAt),
          ...(old.communityLinks ? { communityLinks: old.communityLinks } : {}),
        },
        ConditionExpression: "attribute_not_exists(entityId)",
      }),
    )
    .catch((e) => {
      if (e?.name !== "ConditionalCheckFailedException") throw e; // re-run: already created
    });
  const users = await docClient.send(
    new QueryCommand({
      TableName: TABLE(), IndexName: "cityId-updatedAt-index",
      KeyConditionExpression: "cityId = :c", ExpressionAttributeValues: { ":c": old.id },
    }),
  );
  for (const u of users.Items ?? [])
    await docClient
      .send(
        new UpdateCommand({
          TableName: TABLE(), Key: { entityType: "USER", entityId: u.entityId },
          UpdateExpression: "SET cityId = :n", ConditionExpression: "cityId = :o",
          ExpressionAttributeValues: { ":n": newId, ":o": old.id },
        }),
      )
      .catch((e) => {
        if (e?.name !== "ConditionalCheckFailedException") throw e; // moved meanwhile
      });
  await writeRedirect(old.id, newId, reason, redirects);
  await docClient.send(new DeleteCommand({ TableName: TABLE(), Key: { entityType: "CITY", entityId: old.id } }));
  await recountHackers(newId);
  for (const t of ["cities", encodeURIComponent(old.id), encodeURIComponent(newId), `${encodeURIComponent(old.id)}-users`, `${encodeURIComponent(newId)}-users`])
    revalidateTag(t);
}

export async function recountHackers(cityId: string) {
  const r = await docClient.send(
    new QueryCommand({
      TableName: TABLE(), IndexName: "cityId-updatedAt-index", Select: "COUNT",
      KeyConditionExpression: "cityId = :c", ExpressionAttributeValues: { ":c": cityId },
    }),
  );
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE(), Key: { entityType: "CITY", entityId: cityId },
      UpdateExpression: "SET hackers = :n", ConditionExpression: "attribute_exists(entityId)",
      ExpressionAttributeValues: { ":n": r.Count ?? 0 },
    }),
  );
}
