import "server-only";

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";

import { docClient } from "@/app/_db/Client";
import { DbUser } from "@/app/_db/schema";

export const getUser = cache((username: string) =>
  unstable_cache(
    async (username: string) => {
      if (username === "") return;
      const getCommand = new GetCommand({
        TableName: process.env.DYNAMODB_TABLE!,
        Key: {
          entityType: "USER",
          entityId: username,
        },
      });

      const response = await docClient.send(getCommand);
      const user = response.Item as DbUser | undefined;
      return user;
    },
    [encodeURIComponent(username)],
    { tags: [encodeURIComponent(username)] },
  )(username),
);

export const saveUser = async (
  user: Omit<DbUser, "createdAt"> & { createdAt?: number },
) => {
  const command = new PutCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Item: {
      entityType: "USER",
      entityId: user.username,
      ...user,
    },
  });

  const response = await docClient.send(command);
  revalidateTag(encodeURIComponent(user.username));
  revalidateTag(`${encodeURIComponent(user.cityId)}-users`);
  revalidateTag("cities"); // just for the hacker count...
  return response;
};

export const deleteUser = async (user: DbUser) => {
  const command = new DeleteCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Key: {
      entityType: "USER",
      entityId: user.username,
    },
  });

  const response = await docClient.send(command);
  revalidateTag(encodeURIComponent(user.username));
  revalidateTag(encodeURIComponent(user.cityId));
  revalidateTag("cities"); // just for the hacker count...
  return response;
};

export const getUsers = cache((cityId: string) =>
  unstable_cache(
    async (cityId: string) => {
      const command = new QueryCommand({
        TableName: process.env.DYNAMODB_TABLE!,
        IndexName: "cityId-updatedAt-index",
        KeyConditionExpression: "cityId = :cityId",
        ExpressionAttributeValues: { ":cityId": cityId },
      });
      const response = await docClient.send(command);
      // TODO: find how to give type param to some func above instead of doing this?
      return response.Items as DbUser[];
    },
    [`${encodeURIComponent(cityId)}-users`],
    { tags: [`${encodeURIComponent(cityId)}-users`] },
  )(cityId),
);
