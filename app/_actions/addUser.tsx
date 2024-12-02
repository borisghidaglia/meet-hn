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
import { CityWithoutMetadata, UserWithoutMetadata } from "@/app/_db/schema";
import { getUser, saveUser } from "@/app/_db/User";
import { notifyUserAddition } from "@/app/_lib/telegram";
import { ExternalLink } from "@/components/ui/ExternalLink";

export const addUser = async (
  city: CityWithoutMetadata | undefined,
  prevState: unknown,
  formData: FormData,
) => {
  const { username } = Object.fromEntries(formData);

  if (typeof username !== "string" || username === "")
    return {
      success: false,
      message: "Username field is missing.",
    };
  if (!city) return { success: false, message: "City not found." };

  const about = await getHnUserAboutSection(username);

  if (about === undefined)
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

  const userCityParams = decodedAbout.match(/meet\.hn\/city\/([^<\s]+)/);
  if (!userCityParams || userCityParams.length < 2)
    return {
      success: false,
      message:
        "City info couldn't be parsed from the meet.hn link found in the user HN about section.",
    };
  const userCityParts = userCityParams[1]?.split("/");
  if (userCityParts === undefined)
    return {
      success: false,
      message:
        "City info couldn't be parsed from the meet.hn link found in the user HN about section.",
    };
  // Can there be a "/" in a city name?
  // Throwing this just in case
  if (userCityParts.length > 2)
    return {
      success: false,
      message: (
        <p>
          More than one &apos;/&apos; was found in the meet.hn link from the
          user HN about section. Please make{" "}
          <ExternalLink
            href="https://x.com/borisfyi"
            target="_blank"
            className="font-medium"
          >
            @borisfyi
          </ExternalLink>{" "}
          know your city and username on twitter, or by email at{" "}
          <span className="font-medium">hi@meet.hn</span>
        </p>
      ),
    };

  const userCityId = userCityParts[0];
  if (userCityId === undefined || city.id !== userCityId)
    return {
      success: false,
      message: `City in HN user profile does not match the one given in the form. On HN: ${userCityId}, in the form: ${city.id}`,
    };

  const user: UserWithoutMetadata = {
    username,
    cityId: userCityId,
    about,
  };

  // Saves data to db
  await saveUserAndCity(user, city);
  // Ideally we would want something not blocking like waitUntil
  // https://vercel.com/changelog/waituntil-is-now-available-for-vercel-functions
  try {
    await notifyUserAddition(user, city);
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
    revalidateTag(encodeURIComponent(user.username));
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
