import { parseAtHnUrl, parseSocials } from "@/components/Socials";
import { parseTags } from "@/components/Tags";
import { decode } from "he";
import { ClientUser, DbUser } from "./schema";

export const getClientUser = (user: DbUser): ClientUser => {
  const decodedAbout = decode(user.about);
  return {
    ...user,
    about: decodedAbout,
    tags: parseTags(decodedAbout),
    socials: parseSocials(decodedAbout),
    atHnUrl: parseAtHnUrl(decodedAbout, user.username),
  };
};
