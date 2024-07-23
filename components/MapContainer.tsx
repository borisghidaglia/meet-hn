"use client";

import {
  icon,
  Map as LeafletMapClass,
  map as leafletMap,
  marker,
  Marker,
  tileLayer,
} from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

import { City } from "@/app/_db/schema";
import iconSrc from "@/static/y18.svg";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MarkerIcon = icon({
  iconUrl: iconSrc.src,
  iconSize: [15, 15],
});

Marker.prototype.options.icon = MarkerIcon;

export default function MapContainer({
  cities,
  className,
}: {
  cities: City[];
  className: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<LeafletMapClass>();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  function handleCitySelection(city: City) {
    const params = new URLSearchParams(searchParams);
    if (city) {
      params.set("city", `${city.countryCode}-${city.name}`);
    } else {
      params.delete("city");
    }
    replace(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    const userCoord = getCoordinatesFromRegion();
    const mapContainer = leafletMap(mapRef.current).setView(
      [userCoord.lat, userCoord.lon],
      3,
    );

    mapContainerRef.current = mapContainer;

    tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapContainer);

    return () => {
      mapContainer.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const markers: Marker[] = [];
    for (const city of cities) {
      const cityMarker = marker([city.lat, city.lon]);
      cityMarker
        .bindTooltip(
          `${city.name}, ${city.hackers} ${
            city.hackers > 1 ? "hackers" : "hacker"
          }`,
        )
        .openTooltip();
      cityMarker.on("click", () => handleCitySelection(city));
      cityMarker.addTo(mapContainerRef.current);
      markers.push(cityMarker);
    }
    return () => {
      for (const marker of markers) {
        mapContainerRef.current?.removeLayer(marker);
      }
    };
  }, [cities, mapContainerRef.current]);

  return <div ref={mapRef} className={className} />;
}

function getCoordinatesFromRegion() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const region = timeZone.split("/")[0];
  return (
    regionCoordinates[region as keyof typeof regionCoordinates] ||
    regionCoordinates["Europe"]
  );
}

const regionCoordinates = {
  Africa: { lat: 0, lon: 20 },
  America: { lat: 20, lon: -75 },
  Asia: { lat: 50, lon: 100 },
  Atlantic: { lat: 20, lon: -30 },
  Australia: { lat: -30, lon: 135 },
  Europe: { lat: 50, lon: 15 },
  Indian: { lat: 20, lon: 80 },
  Pacific: { lat: 20, lon: 160 },
};
