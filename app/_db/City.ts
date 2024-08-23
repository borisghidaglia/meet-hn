import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { revalidateTag, unstable_cache } from "next/cache";

import { docClient } from "./Client";
import { City, CityWithoutMetadata } from "./schema";

export const getCity = (cityId: string) =>
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
    ["city", cityId],
    { tags: ["city", cityId] },
  )(cityId);

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
  revalidateTag(`${city.id}`);
  revalidateTag("cities"); // just for the hacker count...
  return response;
};

export const getCities = unstable_cache(
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
  revalidateTag(cityId);
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
  revalidateTag(cityId);
  revalidateTag("cities"); // just for the hacker count...
}

export async function fetchCity(
  rawCity: string,
  rawCountry: string,
): Promise<CityWithoutMetadata | undefined> {
  const matches = await fetch(
    `https://nominatim.openstreetmap.org/search?city=${rawCity}&country=${rawCountry}&format=json&place=city&limit=1&addressdetails=1&accept-language=en-US`,
  ).then((res) => res.json());

  const cityData: Record<string, any> | undefined = matches[0];
  if (!cityData) return undefined;

  const {
    lat,
    lon,
    address: {
      city: maybeCityName,
      country_code,
      country,
      municipality,
      province,
      town,
      village,
    },
  } = cityData;
  const cityName = maybeCityName || town || village || province || municipality;
  const cityId = `${country_code}-${cityName}`;
  return {
    id: cityId,
    name: cityName,
    country,
    countryCode: country_code,
    lat,
    lon,
    hackers: 0,
  };
}
