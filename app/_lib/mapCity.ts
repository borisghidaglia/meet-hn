import { City } from "@/app/_db/schema";

// Only what the map reads. Every page embeds this list (the map is in the root
// layout), so full records (bbox, fullName, …) would weigh on every page.
export type MapCity = Pick<City, "id" | "name" | "hackers" | "lat" | "lon">;

export const toMapCity = ({ id, name, hackers, lat, lon }: City): MapCity =>
  lat === undefined || lon === undefined ? { id, name, hackers } : { id, name, hackers, lat, lon };
