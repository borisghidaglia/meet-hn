import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { decode } from "he";
import { revalidateTag, unstable_cache } from "next/cache";

import { docClient } from "@/app/_db/Client";
import { ClientUser, DbUser } from "@/app/_db/schema";
import { parseAtHnUrl, parseSocials } from "@/components/Socials";
import { parseTags } from "@/components/Tags";

export const getUser = (username: string) =>
  unstable_cache(
    async (username: string) => {
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
    [username],
    { tags: [username] },
  )(username);

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
  revalidateTag(user.username);
  revalidateTag(`${user.cityId}-users`);
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
  revalidateTag(user.username);
  revalidateTag(user.cityId);
  revalidateTag("cities"); // just for the hacker count...
  return response;
};

export const getUsers = (cityId: string) =>
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
    [`${cityId}-users`],
    { tags: [`${cityId}-users`] },
  )(cityId);

export const getClientUser = (user: DbUser): ClientUser => {
  const decodedAbout = decode(user.about);
  return {
    ...user,
    about: decodedAbout,
    tags: parseTags(decodedAbout),
    socials: parseSocials(decodedAbout),
    atHnUrl: parseAtHnUrl(decodedAbout, user.username),
  };
};
