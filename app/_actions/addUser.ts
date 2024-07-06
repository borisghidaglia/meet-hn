"use server";

import { readFileSync, writeFileSync } from "fs";

export const addUser = async (
  hash: string,
  prevState: any,
  formData: FormData
) => {
  const { username, location } = Object.fromEntries(formData);
  if (
    typeof location !== "string" ||
    typeof username !== "string" ||
    location === "" ||
    username === ""
  )
    return { success: false, message: "Username or location are empty." };

  const isHashSetInAccountDescription =
    await checkIsHashSetInAccountDescription(username, hash);

  if (!isHashSetInAccountDescription)
    return {
      success: false,
      message: `Hash set in HN account does not match the requested one: ${hash}`,
    };

  const [rawCity, rawCountry] = location.split(",");
  const matches = await fetch(
    `https://nominatim.openstreetmap.org/search?city=${rawCity}&country=${rawCountry}&format=json&place=city&limit=1&addressdetails=1&accept-language=en-US`
  ).then((res) => res.json());
  const cityData = matches[0];
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
};

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

async function checkIsHashSetInAccountDescription(
  username: string,
  hash: string
) {
  const hnUser = await fetch(
    `https://hacker-news.firebaseio.com/v0/user/${username}.json`
  ).then((res) => res.json());
  console.log(hnUser.about, hash, hnUser.about === hash);
  return hnUser.about === hash;
}
