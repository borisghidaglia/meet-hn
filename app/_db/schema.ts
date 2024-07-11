export type User = {
  username: string;
  cityId: string;
  createdAt: number;
};

export type City = {
  id: string; // `${countryCode}-${name}`
  name: string;
  lat: number;
  lon: number;
  hackers: number;
  country: string;
  countryCode: string;
};
