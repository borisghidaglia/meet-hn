export type DbUser = {
  username: string;
  cityId: string;
  about: string;
  createdAt: number;
  updatedAt: number;
};

export type ClientUser = DbUser & { socialLinks?: UserSocials };

export type UserSocials = {
  bluesky?: string;
  instagram?: string;
  linkedin?: string;
  soundcloud?: string;
  twitter?: string;
};

export const defaultSocialLinks: UserSocials = {
  twitter: undefined,
  bluesky: undefined,
  linkedin: undefined,
  instagram: undefined,
  soundcloud: undefined,
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
