import { cache } from "react";

import { CityWithoutMetadata } from "./schema";

export const fetchCity = cache(
  async (
    rawCity: string,
    rawCountry: string,
  ): Promise<CityWithoutMetadata | undefined> => {
    const matches = await fetch(
      `https://nominatim.openstreetmap.org/search?city=${rawCity}&country=${rawCountry}&format=json&place=city&limit=1&addressdetails=1&accept-language=en-US`,
    ).then((res) => res.json());

    const cityData: Record<string, any> | undefined = matches[0];
    if (!cityData) return undefined;

    const {
      lat,
      lon,
      address: {
        city: maybeCityName,
        country_code,
        country,
        municipality,
        province,
        town,
        village,
      },
    } = cityData;
    const cityName =
      maybeCityName || town || village || province || municipality;
    const cityId = `${country_code}-${cityName.split(" ").join("-")}`;
    return {
      id: cityId,
      name: cityName,
      country,
      countryCode: country_code,
      lat,
      lon,
      hackers: 0,
    };
  },
);
