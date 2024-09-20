"use server";

import { decode } from "he";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { getHnUserAboutSection } from "@/app/_actions/common/hn";
import {
  decrementCityHackerCount,
  getCity,
  incrementCityHackerCount,
  saveCity,
} from "@/app/_db/City";
import { fetchCity } from "@/app/_db/City.client";
import { CityWithoutMetadata, UserWithoutMetadata } from "@/app/_db/schema";
import { getUser, saveUser } from "@/app/_db/User";
import { notifyTelegramChannel } from "@/app/_lib/telegram";

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
    /meet\.hn\/city\/(\S+)<p>([\s\S]*?)---/,
  );
  const cityOnlyMeetHnData = decodedAbout.match(
    /meet\.hn\/city\/([^\n]+)\s*\n?/,
  );

  if (!fullMeetHnData && !cityOnlyMeetHnData)
    return {
      success: false,
      message: (
        <p>
          No meet.hn data found for this HN user.{" "}
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

  // Hotfix
  // That's dumb but it's because I'm using the registration as a form to switch cities I guess
  const userCityIdMatch = decodedAbout.match(/meet\.hn\/city\/([^<\s]+)/);

  if (
    userCityIdMatch === null ||
    userCityIdMatch.length < 2 ||
    city.id !== userCityIdMatch[1]
  )
    return {
      success: false,
      message: `City in HN user profile does not match the one given in the form. On HN: ${userCityIdMatch?.[1]}, in the form: ${city.id}`,
    };

  const user: UserWithoutMetadata = {
    username,
    cityId: userCityIdMatch[1],
    about,
  };

  // Saves data to db
  await saveUserAndCity(user, city);
  // Ideally we would want something not blocking like waitUntil
  // https://vercel.com/changelog/waituntil-is-now-available-for-vercel-functions
  try {
    await notifyTelegramChannel(user, city);
  } catch {}

  redirect(`/city/${encodeURIComponent(city.id)}`);
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
    await incrementCityHackerCount(city.id);
    // City hackers attribute changes, cache update required
    revalidateTag("cities"); // just for the hacker count...
    revalidateTag(encodeURIComponent(city.id));
    revalidateTag(`${encodeURIComponent(city.id)}-users`);
    return;
  } else {
    // updates user
    await saveUser({ ...user, updatedAt: currentDate });
    // User changes, cache update required
    revalidateTag(encodeURIComponent(user.username));
  }

  // User exists but it does not switch cities
  if (existingUser && existingUser.cityId == city.id) {
    revalidateTag(`${encodeURIComponent(city.id)}-users`);
    return;
  }

  // If user switches to a new city
  await Promise.all([
    decrementCityHackerCount(existingUser.cityId),
    incrementCityHackerCount(city.id),
  ]);

  // Two cities are impacted, cache update required
  revalidateTag("cities"); // just for the hacker count...
  revalidateTag(encodeURIComponent(city.id));
  revalidateTag(encodeURIComponent(existingUser.cityId));
  revalidateTag(`${encodeURIComponent(existingUser.cityId)}-users`);
  revalidateTag(`${encodeURIComponent(city.id)}-users`);
}
