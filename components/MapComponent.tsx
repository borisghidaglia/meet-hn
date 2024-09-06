import { getCities } from "@/app/_actions/getCities";
import MapContainerClient from "./MapContainerClient";
import MapError from "./MapError";

export default async function MapComponent() {
  try {
    const cities = await getCities();
    return (
      <MapContainerClient
        cities={cities}
        className="h-[400px] w-full md:h-full"
      />
    );
  } catch (error) {
    return <MapError />;
  }
}
