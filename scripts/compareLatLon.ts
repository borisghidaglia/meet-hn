// @ts-nocheck
import { writeFileSync } from "fs";

import osmResults from "./osm-results-with-new-query.json";
import notCities from "./notCities.json";

async function foo() {
  const res = [];
  for (const [idx, city] of notCities.entries()) {
    console.log(`${idx}/${notCities.length}`);
    if (city === null) continue;
    if (city?.display_name === undefined) {
      console.log({ city });
    }
    const citiesOsm = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${city?.display_name}&format=json&limit=5&addressdetails=1&accept-language=en-US`,
    ).then((res) => res.json());
    res.push({ [city.display_name]: citiesOsm });
  }

  writeFileSync(
    "./scripts//osm-results-with-new-query.json",
    JSON.stringify(res),
  );
}

function bar() {
  for (const result of osmResults) {
    if (Object.values(result)[0].length > 1) {
      console.log(Object.keys(result)[0]);
    }
  }
}

// foo();
