import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "dotenv";
import { resolve } from "path";

import { City, DbUser } from "@/app/_db/schema";

config({ path: resolve(process.cwd(), ".env.local") });

export const client = new DynamoDBClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
export const docClient = DynamoDBDocumentClient.from(client);

export async function scanItems<T>(entityType: "USER" | "CITY") {
  const items: T[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const command = new ScanCommand({
      TableName: process.env.DYNAMODB_TABLE!,
      FilterExpression: "entityType = :pk",
      ExpressionAttributeValues: { ":pk": entityType },
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await docClient.send(command);
    items.push(...(response.Items as T[]));
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

export const getAllUsers = () => scanItems<DbUser>("USER");
export const getAllCities = () => scanItems<City>("CITY");
