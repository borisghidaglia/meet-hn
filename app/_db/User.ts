import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { cache } from "react";
import { docClient } from "./Client";
import { City, User } from "./schema";

export const getUser = cache(async (username: string) => {
  const getCommand = new GetCommand({
    TableName: "CityUserTable",
    Key: {
      entityType: "USER",
      entityId: username,
    },
  });

  const response = await docClient.send(getCommand);
  const user = response.Item as User | undefined;
  return user;
});

export const saveUser = async (user: User) => {
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
        IndexName: "cityId-createdAt-index",
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
  return response.Items as User[];
});
