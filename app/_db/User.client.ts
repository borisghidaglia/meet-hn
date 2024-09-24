import { parseSocials } from "@/components/Socials";
import { parseTags } from "@/components/Tags";
import { decode } from "he";
import { ClientUser, DbUser } from "./schema";

export const getClientUser = (user: DbUser): ClientUser => {
  const decodedAbout = decode(user.about);
  const sortedSocials = parseSocials(decodedAbout)?.sort(
    ({ name: nameA }, { name: nameB }) =>
      nameA.toLowerCase() > nameB.toLowerCase() ? 1 : -1,
  );
  const sortedTags = parseTags(decodedAbout)?.sort();

  return {
    ...user,
    about: decodedAbout,
    tags: sortedTags,
    socials: sortedSocials,
  };
};
