import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { cache } from "react";
import { docClient } from "./Client";
import { City } from "./schema";

export const getCity = cache(async (cityId: string) => {
  const getCommand = new GetCommand({
    TableName: "CityUserTable",
    Key: {
      entityType: "CITY",
      entityId: cityId,
    },
  });

  const response = await docClient.send(getCommand);
  const city = response.Item as City | undefined;
  return city;
});

export const saveCity = async (city: City) => {
  const command = new PutCommand({
    TableName: "CityUserTable",
    Item: {
      entityType: "CITY",
      entityId: city.id,
      ...city,
    },
    ConditionExpression: "attribute_not_exists(entityId)",
  });

  const response = await docClient.send(command);
  return response;
};

export const getCities = cache(async () => {
  const command = new QueryCommand({
    TableName: "CityUserTable",
    KeyConditionExpression: "entityType = :entityType",
    FilterExpression: "hackers > :num",
    ExpressionAttributeValues: { ":entityType": "CITY", ":num": 0 },
  });

  const response = await docClient.send(command);
  // TODO: find how to give type param to some func above instead of doing this?
  return response.Items as City[];
});

export async function incrementCityHackerCount(cityId: string) {
  const command = new UpdateCommand({
    TableName: "CityUserTable",
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
}

export async function decrementCityHackerCount(cityId: string) {
  const command = new UpdateCommand({
    TableName: "CityUserTable",
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
}

export async function fetchCity(
  rawCity: string,
  rawCountry: string
): Promise<City | undefined> {
  const matches = await fetch(
    `https://nominatim.openstreetmap.org/search?city=${rawCity}&country=${rawCountry}&format=json&place=city&limit=1&addressdetails=1&accept-language=en-US`
  ).then((res) => res.json());
  const cityData = matches[0];
  const {
    lat,
    lon,
    address: {
      city: maybeCityName,
      province,
      municipality,
      country,
      country_code,
    },
  } = cityData;
  const cityName = maybeCityName || province || municipality;
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
