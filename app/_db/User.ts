import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { decode } from "he";
import { cache } from "react";

import { parseAtHnUrl, parseSocials } from "@/components/Socials";
import { docClient } from "./Client";
import { City, ClientUser, DbUser } from "./schema";

export const getUser = cache(async (username: string) => {
  const getCommand = new GetCommand({
    TableName: "CityUserTable",
    Key: {
      entityType: "USER",
      entityId: username,
    },
  });

  const response = await docClient.send(getCommand);
  const user = response.Item as DbUser | undefined;
  return user;
});

export const saveUser = async (
  user: Omit<DbUser, "createdAt"> & { createdAt?: number },
) => {
  const command = new PutCommand({
    TableName: "CityUserTable",
    Item: {
      entityType: "USER",
      entityId: user.username,
      ...user,
    },
  });

  const response = await docClient.send(command);
  return response;
};

export const getUsers = cache(async (city?: City) => {
  const command = city
    ? new QueryCommand({
        TableName: "CityUserTable",
        IndexName: "cityId-updatedAt-index",
        KeyConditionExpression: "cityId = :cityId",
        ExpressionAttributeValues: {
          ":cityId": `${city.countryCode}-${city.name}`,
        },
      })
    : new QueryCommand({
        TableName: "CityUserTable",
        KeyConditionExpression: "entityType = :entityType",
        ExpressionAttributeValues: { ":entityType": "USER" },
      });

  const response = await docClient.send(command);
  // TODO: find how to give type param to some func above instead of doing this?
  return response.Items as DbUser[];
});

export const getClientUser = (user: DbUser): ClientUser => {
  const decodedAbout = user.about && decode(user.about);
  return {
    ...user,
    about: decodedAbout,
    socials: decodedAbout ? parseSocials(decodedAbout) : undefined,
    atHnUrl: decodedAbout
      ? parseAtHnUrl(decodedAbout, user.username)
      : undefined,
  };
};
