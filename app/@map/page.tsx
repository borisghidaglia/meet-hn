import dynamic from "next/dynamic";

import { getCities } from "@/app/_db/City";
import { City } from "@/app/_db/schema";

const MapContainer = dynamic(() => import("@/components/MapContainer"), {
  ssr: false,
});

export default async function MapPage({
  searchParams,
}: {
  searchParams?: {
    city?: string;
  };
}) {
  const cities: City[] = await getCities();
  const selectedCity = searchParams?.city
    ? cities.find((city) => city.id == searchParams.city)
    : undefined;

  return (
    <MapContainer
      cities={cities}
      selectedCity={selectedCity}
      className="h-[400px] w-full md:h-full"
    />
  );
}
