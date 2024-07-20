"use server";

import { revalidatePath } from "next/cache";

import {
  decrementCityHackerCount,
  fetchCity,
  getCity,
  incrementCityHackerCount,
  saveCity,
} from "@/app/_db/City";
import { CityWithoutMetadata, UserWithoutMetadata } from "@/app/_db/schema";
import { getUser, saveUser } from "@/app/_db/User";
import { isValidHashInHnUserAbout } from "@/lib/hnAboutParsing";

export const addUser = async (
  hash: string,
  prevState: any,
  formData: FormData,
) => {
  // Basic check that username and location are valid
  const { username, location } = Object.fromEntries(formData);
  if (
    typeof location !== "string" ||
    typeof username !== "string" ||
    location === "" ||
    username === ""
  )
    return { success: false, message: "Username or location are empty." };

  const about = await getHnUserAboutSection(username);

  // Checks account ownership
  if (!about || !isValidHashInHnUserAbout(about, hash))
    return {
      success: false,
      message: `No about section for this HN user, or hash found does not match the requested one: ${hash}`,
    };

  // Builds city and user from user input
  const [rawCity, rawCountry] = location.split(",");
  const city = await fetchCity(rawCity, rawCountry);
  if (!city) return { success: false, message: "City not found." };
  const user: UserWithoutMetadata = { username, cityId: city.id, about };

  // Saves data to db
  await saveUserAndCity(user, city);

  // Revalidates data
  revalidatePath("/");
};

async function saveUserAndCity(
  user: UserWithoutMetadata,
  city: CityWithoutMetadata,
) {
  const currentDate = Date.now();

  const existingCity = await getCity(city.id);
  if (!existingCity) {
    await saveCity({ ...city, createdAt: currentDate });
  }

  const existingUser = await getUser(user.username);
  if (existingUser) {
    // updates user
    await saveUser({ ...user, updatedAt: currentDate });
  } else {
    // creates user
    await saveUser({ ...user, createdAt: currentDate, updatedAt: currentDate });
  }

  // If city or user did not exist
  if (!existingCity || !existingUser) return incrementCityHackerCount(city.id);

  // If user switches to a new city
  // we save the user with a new createAt
  await Promise.all([
    decrementCityHackerCount(existingUser.cityId),
    incrementCityHackerCount(city.id),
  ]);
}

async function getHnUserAboutSection(username: string) {
  const hnUser: null | { about: string } = await fetch(
    `https://hacker-news.firebaseio.com/v0/user/${username}.json`,
  ).then((res) => res.json());

  return hnUser?.about;
}
