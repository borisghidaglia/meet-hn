import { Social } from "@/components/Socials";

export type DbUser = {
  username: string;
  cityId: string;
  about: string;
  createdAt: number;
  updatedAt: number;
};

export type SafeUrl = URL & { [SafeUrl]: true };
export const SafeUrl = Symbol("safeUrl");

export type ClientUser = DbUser & {
  socials?: (Social & { url?: SafeUrl; value: string })[];
  tags?: string[];
};

export type UserSocials = {
  [k in keyof typeof defaultSocialUrls]?: string;
};

export const defaultSocialUrls = {
  bluesky: undefined,
  instagram: undefined,
  linkedin: undefined,
  reddit: undefined,
  soundcloud: undefined,
  spotify: undefined,
  twitter: undefined,
  youtubeMusic: undefined,
};

export type UserWithoutMetadata = Omit<DbUser, "createdAt" | "updatedAt">;

export type City = {
  id: string; // `${lat},${lon}`
  name: string;
  fullName: string;
  hackers: number;
  country?: string;
  countryCode?: string;
  createdAt: number;
};

export type CityWithoutMetadata = Omit<City, "createdAt">;
