import {
  DeleteCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { City, DbUser } from "@/app/_db/schema";
import { docClient, getAllCities, getAllUsers } from "./common";
import { writeFileSync } from "fs";

const updateCity = async (city: City) => {
  // @ts-ignore - .lat .lon were available in the legacy city schema
  const newCityId = `${city.lat},${city.lon}`;
  // @ts-ignore - .lat .lon were available in the legacy city schema
  const { lat, lon, ...cityWithoutLatLon } = city;

  const putCommand = new PutCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Item: { ...cityWithoutLatLon, entityId: newCityId, id: newCityId },
  });

  const deleteCommand = new DeleteCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Key: { entityType: "CITY", entityId: city.id },
  });

  await docClient.send(putCommand).then(() => docClient.send(deleteCommand));
};

const updateUser = async (user: DbUser, cityId: string) => {
  const command = new UpdateCommand({
    TableName: process.env.DYNAMODB_TABLE!,
    Key: { entityType: "USER", entityId: user.username },
    UpdateExpression: "SET cityId = :cityId",
    ExpressionAttributeValues: { ":cityId": cityId },
  });

  await docClient.send(command);
};

async function main() {
  const cities = await getAllCities();

  writeFileSync("./scripts/migrationCities.json", JSON.stringify(cities));

  const erroredCities = [];
  for (const [idx, city] of cities.entries()) {
    console.log(`City ${idx}/${cities.length - 1}`);

    try {
      await updateCity(city);
    } catch (error) {
      console.log(`City ${city.fullName} errored with error, `, error);
      erroredCities.push(city);
    }
  }
  writeFileSync("./scripts/erroredCities.json", JSON.stringify(erroredCities));

  const users = await getAllUsers();

  const erroredUsers = [];
  for (const [idx, user] of users.entries()) {
    console.log(`User ${idx}/${users.length - 1}`);

    try {
      const userCity = cities.find((city) => city.id === user.cityId);
      if (!userCity) {
        console.log("City not found for user: ", { user });
        continue;
      }
      // @ts-ignore - .lat .lon were available in the legacy city schema
      await updateUser(user, `${userCity.lat},${userCity.lon}`);
    } catch (error) {
      console.log(`User ${user.username} errored with error, `, error);
      erroredUsers.push(user);
    }
  }
  writeFileSync("./scripts/erroredUsers.json", JSON.stringify(erroredUsers));
}

main();
