"use client";

import dynamic from "next/dynamic";

const MapContainer = dynamic(() => import("@/components/MapContainer"), {
  ssr: false,
});

const MapContainerClient = MapContainer;

export default MapContainerClient;
