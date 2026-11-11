import { cache } from "react";

import { pickerSearchUrl, toPlace } from "../_lib/nominatim";
import { debounce } from "../_lib/utils";
import { FormCity } from "./schema";

export type PickerResult = FormCity & { addresstype: string };

// Results carry the OSM object id (R71525, N…): a page IS an OSM object. The
// server re-fetches the pick and resolves it to an existing page (resolvePick).
const fetchCities = cache(async (searchValue: string): Promise<PickerResult[] | undefined> => {
  const matches = await fetch(pickerSearchUrl(searchValue)).then((res) => res.json());
  return (matches as any[]).flatMap((raw) => {
    const p = toPlace(raw);
    if (!p) return [];
    return [{
      id: p.id, pickId: p.id, name: p.name, fullName: p.fullName, country: p.country ?? "",
      countryCode: p.countryCode ?? "", addresstype: p.placeType ?? "", hackers: 0,
    }];
  });
});

export const debouncedFetchCities = debounce(fetchCities, 300);
