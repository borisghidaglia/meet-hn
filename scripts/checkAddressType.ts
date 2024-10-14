// @ts-nocheck

import { writeFileSync } from "fs";
import { getAllCities } from "./common";

import cities from "./cities.json";

async function main() {
  // const cities = await getAllCities();

  // writeFileSync("./scripts/cities.json", JSON.stringify(cities));

  const notCities: any[] = [];
  for (const [idx, city] of cities.entries()) {
    console.log(`${idx}/${cities.length}`);

    const osmCity = (
      await fetch(
        `https://nominatim.openstreetmap.org/search?city=${city.name}&country=${city.country}&format=json&place=city&limit=1&addressdetails=1&accept-language=en-US`,
      ).then((res) => res.json())
    )[0];

    if (osmCity?.addresstype !== "city") {
      console.log(city.id, osmCity?.addresstype);
      notCities.push(osmCity);
    }
    await wait(2000);
  }

  writeFileSync("./scripts/notCities.json", JSON.stringify(notCities));
}

// main();

const wait = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));
