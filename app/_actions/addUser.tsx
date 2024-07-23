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
import { isValidUuidInHnUserAbout } from "@/lib/hnAboutParsing";

export const addUser = async (
  uuid: string,
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
    return {
      success: false,
      message: "Username and/or location fields are missing.",
    };

  const about = await getHnUserAboutSection(username);

  // Checks account ownership
  if (!about || !isValidUuidInHnUserAbout(about, uuid))
    return {
      success: false,
      message: (
        <p>
          No about section for this HN user, or UUID found does not match the
          requested one: {uuid}.<br />
          <b>Waiting a minute to let HN API update.</b>
        </p>
      ),
      wait: true,
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
  if (!existingUser) {
    // creates user
    await saveUser({ ...user, createdAt: currentDate, updatedAt: currentDate });
  } else {
    // updates user
    await saveUser({ ...user, updatedAt: currentDate });
  }

  // If user does not exist
  if (!existingUser) return incrementCityHackerCount(city.id);

  // If the user exists but it does not switch cities, do nothing more
  if (existingUser && existingUser.cityId == city.id) return;

  // If user switches to a new city
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