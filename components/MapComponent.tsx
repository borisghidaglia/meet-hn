import { getCities } from "@/app/_actions/getCities";
import { MapCity, toMapCity } from "@/app/_lib/mapCity";
import MapContainerClient from "./MapContainerClient";
import MapError from "./MapError";
import { MapPreview } from "./MapPreview";

export default async function MapComponent() {
  let cities: MapCity[];
  try {
    cities = (await getCities()).map(toMapCity);
  } catch (error) {
    return <MapError />;
  }
  return (
    <div className="relative h-[400px] w-full md:h-full">
      <MapPreview />
      <MapContainerClient cities={cities} className="h-full w-full" />
    </div>
  );
}
