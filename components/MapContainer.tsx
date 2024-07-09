"use client";

import {
  map,
  tileLayer,
  marker,
  icon,
  Marker,
  Map as LeafletMap,
} from "leaflet";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

import iconSrc from "@/static/y18.svg";

let MarkerIcon = icon({
  iconUrl: iconSrc.src,
  iconSize: [15, 15],
  // iconAnchor: [25, 25],
});

Marker.prototype.options.icon = MarkerIcon;

export type City = {
  name: string;
  lat: number;
  lon: number;
  community: number;
};

export default function MapContainer({ cities }: { cities: City[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<LeafletMap>();

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

    for (const city of cities) {
      const cityMarker = marker([city.lat, city.lon]);
      cityMarker
        .bindTooltip(
          `${city.name}, ${city.community} ${
            city.community > 1 ? "hackers" : "hacker"
          }`
        )
        .openTooltip();
      mapContainerRef.current;
      cityMarker.addTo(mapContainerRef.current);
    }
  }, [cities, mapContainerRef.current]);

  return <div ref={mapRef} className="w-full h-full" />;
}
