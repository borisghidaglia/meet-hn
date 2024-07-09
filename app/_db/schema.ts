export type User = {
  username: string;
  cityId: string;
};

export type City = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  hackers: number;
  country: string;
  countryCode: string;
};
