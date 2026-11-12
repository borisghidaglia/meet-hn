// DynamoDB writes for city re-keying, with a journal and a rollback. Shared by
// scripts/migrateCityIdentity.ts (the OSM migration) and
// scripts/fixPlaceLabels.ts (pages created from addresses or postcodes).

import { DeleteCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { readFileSync, writeFileSync } from "fs";

import { docClient } from "./common";

export type Item = Record<string, any> & { entityType: string; entityId: string };
export type Ops = {
  cityPuts: { item: Item; before: Item | null; why: string }[];
  redirectPuts: { item: Item; before: Item | null }[];
  userMoves: { username: string; from: string; to: string }[];
  cityDeletes: { before: Item }[];
};

export function tableOps(TABLE: string, MODE: "dry-run" | "apply" | "rollback") {
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

  return { send, scanAll, usersOn, apply, rollback };
}
