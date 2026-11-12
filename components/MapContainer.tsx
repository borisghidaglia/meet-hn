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

import { markMapReady } from "@/app/_lib/mapReady";
import {
  CITY_ZOOM,
  getCoordinatesFromRegion,
  MAP_PREVIEW_ID,
  REGION_ZOOM,
  TILE_URL,
  WORLD_BOUNDS,
} from "@/app/_lib/mapView";
import { cityGeo } from "@/app/_lib/nearby";

import iconSrc from "@/public/logo.svg";

import { MapCity } from "@/app/_lib/mapCity";

const maxMarkerSize = 40;
export default function MapContainer({
  cities,
  className,
}: {
  cities: MapCity[];
  className: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<LeafletMapClass | undefined>(undefined);
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

    // On a city page, open the map on that city right away (the effect below
    // would move it there anyway). Starting on the region first made Leaflet
    // fetch a screenful of zoom-3 tiles that were thrown away a moment later,
    // in front of the tile that is the page's LCP on mobile.
    const userCoord = getCoordinatesFromRegion();
    const cityCoords = selectedCity && getCityCoords(selectedCity);
    const mapContainer = leafletMap(mapRef.current, {
      maxBounds: new LatLngBounds(WORLD_BOUNDS),
    }).setView(
      cityCoords ?? [userCoord.lat, userCoord.lon],
      cityCoords ? CITY_ZOOM : REGION_ZOOM,
    );

    mapContainerRef.current = mapContainer;

    // The static preview (components/MapPreview.tsx) already shows these
    // tiles: let it show through until Leaflet's own copies have loaded, so
    // the markers appear on top of it right away, then hide it.
    const preview = document.getElementById(MAP_PREVIEW_ID);
    const container = mapContainer.getContainer();
    if (preview?.querySelector("img")) {
      container.style.background = "transparent";
      preview.querySelector("[data-attribution]")?.remove();
    }

    tileLayer(TILE_URL, {
      noWrap: true,
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
      .once("load", () => {
        if (preview) preview.style.display = "none";
        container.style.background = "";
        markMapReady();
      })
      .addTo(mapContainer);

    return () => {
      mapContainer.remove();
      mapContainerRef.current = undefined;
    };
    // Creates the map once; later city changes are handled by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCity) return;

    const selectedCityCoords = getCityCoords(selectedCity);
    if (!selectedCityCoords) return;

    mapContainerRef.current?.setView(selectedCityCoords, CITY_ZOOM);
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
      const cityCoords = getCityCoords(city);
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

// OSM-keyed pages (R71525) store lat/lon as fields; legacy ids are "lat,lon".
function getCityCoords(city: MapCity): [number, number] | undefined {
  const g = cityGeo(city);
  if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) return;
  return [g.lat, g.lon];
}

const getMinMarkerSize = (zoom: number) => {
  return Math.max(7.5, maxMarkerSize / Math.max((14 - zoom) / 2, 1.5));
};
