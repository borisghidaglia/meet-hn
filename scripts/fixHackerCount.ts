import {
  QueryCommand,
  UpdateCommand,
  UpdateCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { docClient, getAllCities } from "./common";
import { City } from "@/app/_db/schema";
import { writeFileSync } from "fs";

// @ts-ignore
async function main() {
  const cities = await getAllCities();
  const citiesWithTooMuchUsers: City[] = [];
  const citiesWithNoCount: City[] = [];
  const citiesError: { city: City; res: UpdateCommandOutput }[] = [];
  for (const city of cities) {
    const command = new QueryCommand({
      TableName: process.env.DYNAMODB_TABLE!,
      KeyConditionExpression: "entityType = :entityType",
      FilterExpression: "cityId = :cityId",
      ExpressionAttributeValues: { ":entityType": "USER", ":cityId": city.id },
      Select: "COUNT",
    });
    const response = await docClient.send(command);
    const lastEvaluatedKey = response.LastEvaluatedKey;
    if (lastEvaluatedKey !== undefined) {
      citiesWithTooMuchUsers.push(city);
      continue;
    }
    const count = response.Count;
    if (count === undefined) {
      citiesWithNoCount.push(city);
      continue;
    }

    const updateCommand = new UpdateCommand({
      TableName: process.env.DYNAMODB_TABLE!,
      Key: {
        entityType: "CITY",
        entityId: city.id,
      },
      UpdateExpression: "SET hackers = :count",
      ExpressionAttributeValues: {
        ":count": count,
      },
    });

    const updateResponse = await docClient.send(updateCommand);
    if (updateResponse.$metadata.httpStatusCode !== 200) {
      citiesError.push({ city, res: updateResponse });
    }
  }

  writeFileSync(
    "./scripts/citiesWithTooMuchUsers.json",
    JSON.stringify(citiesWithTooMuchUsers),
  );
  writeFileSync(
    "./scripts/citiesWithNoCount.json",
    JSON.stringify(citiesWithNoCount),
  );
  writeFileSync("./scripts/citiesError.json", JSON.stringify(citiesError));
}

// main();
