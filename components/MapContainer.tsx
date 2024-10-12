"use client";

import {
  icon,
  LatLngBounds,
  map as leafletMap,
  Map as LeafletMapClass,
  marker,
  Marker,
  tileLayer,
} from "leaflet";
import "leaflet/dist/leaflet.css";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { City } from "@/app/_db/schema";

import iconSrc from "@/public/logo.svg";

const maxMarkerSize = 40;
export default function MapContainer({
  cities,
  className,
}: {
  cities: City[];
  className: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<LeafletMapClass>();
  const router = useRouter();
  const { id } = useParams();
  const selectedCityId = id?.[0] ? decodeURIComponent(id?.[0]) : undefined;
  const selectedCity = cities.find((city) => city.id === selectedCityId);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !mapRef.current ||
      mapContainerRef.current !== undefined
    )
      return;

    const userCoord = getCoordinatesFromRegion();
    const worldBounds = new LatLngBounds([-88, -180], [88, 180]);
    const mapContainer = leafletMap(mapRef.current, {
      maxBounds: worldBounds,
    }).setView([userCoord.lat, userCoord.lon], 3);

    mapContainerRef.current = mapContainer;

    tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      noWrap: true,
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapContainer);

    return () => {
      mapContainer.remove();
      mapContainerRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (!selectedCity) return;

    const selectedCityCoords = getCityCoords(selectedCity.id);
    if (!selectedCityCoords) return;

    mapContainerRef.current?.setView(selectedCityCoords, 6);
    window.history.replaceState(
      null,
      "",
      `/city/${selectedCity.id}/${selectedCity.name.split(" ").join("-")}`,
    );
  }, [selectedCity]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const markers: (Marker & { hackers: number })[] = [];
    const cityHackers = cities.map((c) => c.hackers);
    const [min, max] = [Math.min(...cityHackers), Math.max(...cityHackers)];
    for (const city of cities) {
      const cityCoords = getCityCoords(city.id);
      if (!cityCoords) continue;

      // Compute icon sizes
      const initialZoom = mapContainerRef.current.getZoom();
      const minMarkerSize = getMinMarkerSize(initialZoom);
      const iconSize =
        minMarkerSize +
        (Math.log((city.hackers - min) * 0.1 + 1) /
          Math.log(2) /
          Math.log(max - min + 1)) *
          (maxMarkerSize - minMarkerSize);
      const MarkerIcon = icon({
        iconUrl: iconSrc.src,
        iconSize: [iconSize, iconSize],
      });

      const cityMarker = marker(cityCoords, { icon: MarkerIcon });
      cityMarker
        .bindTooltip(
          `${city.name}, ${city.hackers} ${
            city.hackers > 1 ? "hackers" : "hacker"
          }`,
        )
        .openTooltip();
      cityMarker.on("click", () =>
        router.push(`/city/${city.id}/${city.name.split(" ").join("-")}`),
      );
      cityMarker.addTo(mapContainerRef.current);
      markers.push(Object.assign(cityMarker, { hackers: city.hackers }));
    }

    mapContainerRef.current.addEventListener("zoom", () => {
      if (!mapContainerRef.current) return;

      for (const marker of markers) {
        // Compute icon sizes
        const zoomLevel = mapContainerRef.current.getZoom();
        const minMarkerSize = getMinMarkerSize(zoomLevel);
        const iconSize =
          minMarkerSize +
          (Math.log((marker.hackers - min) * 0.1 + 1) /
            Math.log(2) /
            Math.log(max - min + 1)) *
            (maxMarkerSize - minMarkerSize);
        const MarkerIcon = icon({
          iconUrl: iconSrc.src,
          iconSize: [iconSize, iconSize],
        });
        marker.setIcon(MarkerIcon);
      }
    });
    return () => {
      for (const marker of markers) {
        mapContainerRef.current?.removeLayer(marker);
      }
    };
  }, [cities, router]);

  return <div ref={mapRef} className={className} />;
}

function getCoordinatesFromRegion() {
  if (typeof window === "undefined") return regionCoordinates["Europe"];

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const region = timeZone.split("/")[0];
  return (
    regionCoordinates[region as keyof typeof regionCoordinates] ||
    regionCoordinates["Europe"]
  );
}

function getCityCoords(cityId?: string): [number, number] | undefined {
  if (!cityId) return;

  const [lat, lon] = cityId.split(",").map((n) => parseFloat(n));
  if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;

  return [lat, lon];
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

const getMinMarkerSize = (zoom: number) => {
  return Math.max(7.5, maxMarkerSize / Math.max((14 - zoom) / 2, 1.5));
};
