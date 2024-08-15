import { Social } from "@/components/Socials";

export type DbUser = {
  username: string;
  cityId: string;
  about: string;
  createdAt: number;
  updatedAt: number;
};

export type ClientUser = DbUser & {
  socials?: Social[];
  tags?: string[];
  atHnUrl?: string;
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
  id: string; // `${countryCode}-${name}`
  name: string;
  lat: number;
  lon: number;
  hackers: number;
  country: string;
  countryCode: string;
  createdAt: number;
};

export type CityWithoutMetadata = Omit<City, "createdAt">;
