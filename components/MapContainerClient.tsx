"use client";

import dynamic from "next/dynamic";

const loadMapContainer = () => import("@/components/MapContainer");

// Leaflet touches window when it is imported, so the map only renders in the
// browser. Start downloading its chunk as soon as this module runs there,
// instead of waiting for hydration to reach the map: on mobile a map tile is
// the LCP element, and every request in front of it delays it.
if (typeof window !== "undefined") void loadMapContainer();

const MapContainer = dynamic(loadMapContainer, { ssr: false });

const MapContainerClient = MapContainer;

export default MapContainerClient;
