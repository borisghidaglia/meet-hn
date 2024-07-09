"use server";

import { saveCity } from "@/app/_db/City";
import { City, User } from "@/app/_db/schema";
import { saveUser } from "@/app/_db/User";
import { revalidatePath } from "next/cache";

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
  const city: City = {
    id: cityId,
    name: cityName,
    country,
    countryCode: country_code,
    lat,
    lon,
    hackers: 0,
  };
  const user: User = { username, cityId };
  await Promise.all([saveCity(city), saveUser(user)]);
  revalidatePath("/");
};

async function checkIsHashSetInAccountDescription(
  username: string,
  hash: string
) {
  return true;
  const hnUser = await fetch(
    `https://hacker-news.firebaseio.com/v0/user/${username}.json`
  ).then((res) => res.json());
  return hnUser.about === hash;
}
