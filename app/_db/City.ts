import "server-only";

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";

import { docClient } from "@/app/_db/Client";
import { City } from "@/app/_db/schema";

export const getCity = cache((cityId: string) =>
  unstable_cache(
    async (cityId: string) => {
      const getCommand = new GetCommand({
        TableName: process.env.DYNAMODB_TABLE!,
        Key: {
          entityType: "CITY",
          entityId: cityId,
        },
      });

      const response = await docClient.send(getCommand);
      const city = response.Item as City | undefined;
      return city;
    },
    ["city", encodeURIComponent(cityId)],
    { tags: ["city", encodeURIComponent(cityId)] },
  )(cityId),
);

export const saveCity = async (city: City) => {
  const command = new PutCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Item: {
      entityType: "CITY",
      entityId: city.id,
      ...city,
    },
    ConditionExpression: "attribute_not_exists(entityId)",
  });
  const response = await docClient.send(command);
  revalidateTag(encodeURIComponent(city.id));
  revalidateTag("cities"); // just for the hacker count...
  return response;
};

export const getCities = cache(
  unstable_cache(
    async () => {
      const command = new QueryCommand({
        TableName: process.env.DYNAMODB_TABLE!,
        KeyConditionExpression: "entityType = :entityType",
        FilterExpression: "hackers > :num",
        ExpressionAttributeValues: { ":entityType": "CITY", ":num": 0 },
      });

      const response = await docClient.send(command);
      // TODO: find how to give type param to some func above instead of doing this?
      return response.Items as City[];
    },
    ["cities"],
    { tags: ["cities"] },
  ),
);

export async function incrementCityHackerCount(cityId: string) {
  const command = new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Key: {
      entityType: "CITY",
      entityId: cityId,
    },
    UpdateExpression: "ADD hackers :inc",
    ExpressionAttributeValues: {
      ":inc": 1,
    },
  });
  await docClient.send(command);
  revalidateTag(encodeURIComponent(cityId));
  revalidateTag("cities"); // just for the hacker count...
}

export async function decrementCityHackerCount(cityId: string) {
  const command = new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Key: {
      entityType: "CITY",
      entityId: cityId,
    },
    UpdateExpression: "ADD hackers :dec",
    ExpressionAttributeValues: {
      ":dec": -1,
    },
  });
  await docClient.send(command);
  revalidateTag(encodeURIComponent(cityId));
  revalidateTag("cities"); // just for the hacker count...
}
