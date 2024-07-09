import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./Client";
import { User } from "./schema";

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

export const getUsers = async () => {
  const command = new QueryCommand({
    TableName: "CityUserTable",
    KeyConditionExpression: "entityType = :entityType",
    ExpressionAttributeValues: { ":entityType": "USER" },
  });

  const response = await docClient.send(command);
  // TODO: find how to give type param to some func above instead of doing this?
  return response.Items as User[];
};
