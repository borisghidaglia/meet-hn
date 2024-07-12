export type User = {
  username: string;
  cityId: string;
  createdAt: number;
  updatedAt: number;
};

export type UserWithoutMetadata = Omit<User, "createdAt" | "updatedAt">;

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
