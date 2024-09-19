import { cache } from "react";

import { debounce } from "../_lib/utils";
import { CityWithoutMetadata } from "./schema";

const fetchCities = cache(
  async (
    searchValue: string,
  ): Promise<(CityWithoutMetadata & { addresstype: string })[] | undefined> => {
    const matches = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${searchValue}&format=json&limit=5&addressdetails=1&accept-language=en-US`,
    ).then((res) => res.json());

    const cities = matches.map((cityData: any) => {
      const {
        lat,
        lon,
        name,
        display_name,
        addresstype,
        address: { country_code, country },
      } = cityData;
      const cityId = `${lat},${lon}`;
      return {
        id: cityId,
        name,
        fullName: display_name,
        country,
        countryCode: country_code,
        addresstype,
        hackers: 0,
      };
    });
    return cities;
  },
);

export const debouncedFetchCities = debounce(fetchCities, 300);
