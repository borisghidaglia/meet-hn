"use server";

import { deleteUser as deleteUserFromDb, getUser } from "@/app/_db/User";

import { decode } from "he";
import { decrementCityHackerCount } from "@/app/_db/City";
import { fetchHnUser } from "@/app/_actions/common/hn";

export const deleteUser = async (
  prevState: unknown,
  formData: FormData,
): Promise<{
  success: boolean;
  message: JSX.Element | string;
  wait?: boolean;
}> => {
  const { username } = Object.fromEntries(formData);

  if (typeof username !== "string" || username === "")
    return {
      success: false,
      message:
        "Can't remove your account if you don't give me your username 🤷",
    };

  const about = await fetchHnUser(username);

  if (!about) return await deleteUserAndUpdateCity(username);

  const decodedAbout = decode(about);

  const fullMeetHnData = decodedAbout.match(
    /meet\.hn\/city\/(\S+)<p>([\s\S]*?)---/,
  );
  const cityOnlyMeetHnData = decodedAbout.match(
    /meet\.hn\/city\/([^\n]+)\s*\n?/,
  );

  if (fullMeetHnData !== null || cityOnlyMeetHnData !== null)
    return {
      success: false,
      message: (
        <p>
          Some meet.hn data still exists in the user HN description.{" "}
          <b>Waiting a minute to let HN API update.</b>
        </p>
      ),
      wait: true,
    };

  return await deleteUserAndUpdateCity(username);
};

const deleteUserAndUpdateCity = async (username: string) => {
  const user = await getUser(username);
  if (!user)
    return {
      success: false,
      message: (
        <p>
          <b>{username}</b> isn&apos;t registered on meet.hn
        </p>
      ),
    };

  // Delete user
  await deleteUserFromDb(user);

  // Update its city count
  decrementCityHackerCount(user.cityId);

  return {
    success: true,
    message: (
      <p>
        <b>{username}</b> has been deleted successfully ✅
      </p>
    ),
  };
};
