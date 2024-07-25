import { getCities } from "@/app/_db/City";
import { City } from "@/app/_db/schema";
import dynamic from "next/dynamic";

const MapContainer = dynamic(() => import("@/components/MapContainer"), {
  ssr: false,
});

export default async function MapPage() {
  const cities: City[] = await getCities();

  return (
    <MapContainer cities={cities} className="h-[400px] w-full md:h-full" />
  );
}
