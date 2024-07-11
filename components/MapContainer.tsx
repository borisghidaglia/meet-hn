"use client";

import {
  icon,
  Map as LeafletMap,
  map,
  marker,
  Marker,
  tileLayer,
} from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

import { City } from "@/app/_db/schema";
import iconSrc from "@/static/y18.svg";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

let MarkerIcon = icon({
  iconUrl: iconSrc.src,
  iconSize: [15, 15],
});

Marker.prototype.options.icon = MarkerIcon;

export default function MapContainer({ cities }: { cities: City[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<LeafletMap>();
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

    const mapContainer = map(mapRef.current).setView(
      [48.8588897, 2.3200410217200766],
      3
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
          }`
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

  return <div ref={mapRef} className="w-full h-full" />;
}
