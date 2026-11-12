"use server";

import { decode } from "he";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { getHnUserAboutSection } from "@/app/_actions/common/hn";
import {
  citiesChanged,
  decrementCityHackerCount,
  getCity,
  incrementCityHackerCount,
  saveCity,
} from "@/app/_db/City";
import { logSuspect, rekeyPage, writeRedirect } from "@/app/_db/Place";
import { CityWithoutMetadata, FormCity, UserWithoutMetadata } from "@/app/_db/schema";
import { planSignUp, SignUpPlan } from "@/app/_db/signUpPlan";
import { getUser, saveUser } from "@/app/_db/User";
import { landsOn } from "@/app/_lib/resolvePlace";
import { notifySuspects, notifyUserAddition } from "@/app/_lib/telegram";
import { ExternalLink } from "@/components/ui/ExternalLink";

export const addUser = async (
  formCity: FormCity | undefined,
  prevState: unknown,
  formData: FormData,
) => {
  const { username } = Object.fromEntries(formData);

  if (typeof username !== "string" || username === "")
    return {
      success: false,
      message: "Username field is missing.",
    };
  if (!formCity) return { success: false, message: "City not found." };

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

  // Resolve the pick again, server-side and authoritatively: never trust the
  // page id the browser sent (see app/_lib/resolvePlace.ts).
  const plan = await planSignUp(formCity.pickId ?? formCity.id);
  if (!plan)
    return {
      success: false,
      message: "This place couldn't be verified on OpenStreetMap. Please search for it again.",
    };
  const city = plan.city;

  // The pasted link may be the page id, the picked OSM id, or any old id that
  // redirects to the page (profiles pasted before a merge or a re-key).
  const userCityId = userCityParts[0];
  const accepted = new Set([plan.pageId, plan.pickId, plan.matchedPageId].filter(Boolean));
  if (userCityId === undefined || !accepted.has(landsOn(userCityId, plan.dir)))
    return {
      success: false,
      message: `City in HN user profile does not match the one given in the form. On HN: ${userCityId}, in the form: ${plan.pageId}`,
    };

  const user: UserWithoutMetadata = {
    username,
    cityId: plan.pageId,
    about,
  };

  // Saves data to db
  await applyPlan(plan, username);
  await saveUserAndCity(user, city, plan.rekey?.old.id);
  // Ideally we would want something not blocking like waitUntil
  // https://vercel.com/changelog/waituntil-is-now-available-for-vercel-functions
  try {
    await notifyUserAddition(user, city);
  } catch {}

  redirect(`/city/${encodeURIComponent(city.id)}`);
};

// Writes that make the pick land on its page, before the user is saved.
async function applyPlan(plan: SignUpPlan, username: string) {
  if (plan.rekey) await rekeyPage(plan.rekey.old, plan.rekey.successor, plan.rekey.reason, plan.dir.redirectMap);
  if (plan.redirect) await writeRedirect(plan.redirect.from, plan.redirect.to, plan.redirect.reason, plan.dir.redirectMap);
  if (plan.create) {
    await saveCity(plan.city).catch((e) => {
      if (e?.name !== "ConditionalCheckFailedException") throw e; // created meanwhile
    });
    citiesChanged();
    if (plan.suspects.length > 0) {
      for (const s of plan.suspects) await logSuspect(plan.pickId, s.pageId, s.reason, username);
      try {
        await notifySuspects(plan.city, plan.suspects);
      } catch {}
    }
  }
}

async function saveUserAndCity(
  user: UserWithoutMetadata,
  city: CityWithoutMetadata,
  rekeyedFrom?: string, // page id just re-keyed onto city.id (its users already moved)
) {
  const currentDate = Date.now();

  const existingCity = await getCity(city.id);
  if (!existingCity) {
    await saveCity({ ...city, createdAt: currentDate }).catch((e) => {
      // Already created by applyPlan (getCity may still serve a cached miss).
      if (e?.name !== "ConditionalCheckFailedException") throw e;
    });
  }

  const cachedUser = await getUser(user.username);
  const existingUser =
    cachedUser && rekeyedFrom && cachedUser.cityId === rekeyedFrom
      ? { ...cachedUser, cityId: city.id }
      : cachedUser;
  if (!existingUser) {
    // creates user
    await saveUser({ ...user, createdAt: currentDate, updatedAt: currentDate });
    await incrementCityHackerCount(city.id);
    // City hackers attribute changes, cache update required
    citiesChanged(); // just for the hacker count...
    updateTag(encodeURIComponent(city.id));
    updateTag(encodeURIComponent(user.username));
    updateTag(`${encodeURIComponent(city.id)}-users`);
    return;
  } else {
    // updates user
    await saveUser({ ...user, updatedAt: currentDate });
    // User changes, cache update required
    updateTag(encodeURIComponent(user.username));
  }

  // User exists but it does not switch cities
  if (existingUser && existingUser.cityId == city.id) {
    updateTag(`${encodeURIComponent(city.id)}-users`);
    return;
  }

  // If user switches to a new city
  await Promise.all([
    decrementCityHackerCount(existingUser.cityId),
    incrementCityHackerCount(city.id),
  ]);

  // Two cities are impacted, cache update required
  citiesChanged(); // just for the hacker count...
  updateTag(encodeURIComponent(city.id));
  updateTag(encodeURIComponent(existingUser.cityId));
  updateTag(`${encodeURIComponent(existingUser.cityId)}-users`);
  updateTag(`${encodeURIComponent(city.id)}-users`);
}
