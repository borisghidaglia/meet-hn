"use server";

import { readFileSync, writeFileSync } from "fs";

export async function addUser(formData: FormData) {
  const { username, location } = Object.fromEntries(formData);
  if (
    typeof location !== "string" ||
    typeof username !== "string" ||
    location === "" ||
    username === ""
  )
    return;
  const [rawCity, rawCountry] = location.split(",");
  const matches = await fetch(
    `https://nominatim.openstreetmap.org/search?city=${rawCity}&country=${rawCountry}&format=json&place=city&limit=1&addressdetails=1&accept-language=en-US`
  ).then((res) => res.json());
  const cityData = matches[0];
  console.log(cityData);

  const {
    lat,
    lon,
    address: { city, province, municipality, country, country_code },
  } = cityData;

  const user: User = {
    username,
    city: city || province || municipality,
    country,
    countryCode: country_code,
    lat,
    lon,
  };
  saveUser(user);
}

function saveUser(user: User) {
  const data = JSON.parse(
    readFileSync(process.cwd() + "/app/data.json", "utf8")
  );
  const newData = { ...data, [user.username]: user };
  writeFileSync(process.cwd() + "/app/data.json", JSON.stringify(newData));
}

export type User = {
  username: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
};
