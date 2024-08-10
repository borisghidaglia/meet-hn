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
import { decode } from "he";
import { redirect } from "next/navigation";

export const addUser = async (prevState: unknown, formData: FormData) => {
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

  if (!about)
    return {
      success: false,
      message: (
        <p>
          No about section for this HN user.{" "}
          <b>Waiting a minute to let HN API update.</b>
        </p>
      ),
      wait: true,
    };

  const decodedAbout = decode(about);

  const fullMeetHnData = decodedAbout.match(
    /### meet\.hn\/\?city=(\S+)<p>([\s\S]*?)---/,
  );
  const cityOnlyMeetHnData = decodedAbout.match(
    /meet\.hn\/\?city=([^\n]+)\s*\n?/,
  );

  if (!fullMeetHnData && !cityOnlyMeetHnData)
    return {
      success: false,
      message: (
        <p>
          No meet HN data found for this HN user.{" "}
          <b>Waiting a minute to let HN API update.</b>
        </p>
      ),
      wait: true,
    };

  // Builds city and user from user input
  const [rawCity, rawCountry] = location.split(",");
  if (!rawCity || !rawCountry)
    return {
      success: false,
      message:
        "City or country missing. Make sure to split them using a comma. Example: Paris, France",
    };

  const city = await fetchCity(rawCity, rawCountry);
  if (!city) return { success: false, message: "City not found." };

  const user: UserWithoutMetadata = { username, cityId: city.id, about };

  // Saves data to db
  await saveUserAndCity(user, city);

  // Revalidates data
  revalidatePath("/");
  redirect(`/?city=${city.countryCode}-${city.name}`);
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
