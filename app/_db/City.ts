import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./Client";
import { City } from "./schema";

export const saveCity = async (city: City) => {
  const command = new PutCommand({
    TableName: "CityUserTable",
    Item: {
      entityType: "CITY",
      entityId: city.id,
      ...city,
    },
  });

  const response = await docClient.send(command);
  return response;
};

export const getCities = async () => {
  const command = new QueryCommand({
    TableName: "CityUserTable",
    KeyConditionExpression: "entityType = :entityType",
    ExpressionAttributeValues: { ":entityType": "CITY" },
  });

  const response = await docClient.send(command);
  // TODO: find how to give type param to some func above instead of doing this?
  return response.Items as City[];
};
