"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

import { onMapReady } from "@/app/_lib/mapReady";

// The same tag as @next/third-parties' <GoogleAnalytics>, but started once the
// map has drawn its first tiles (or after 10 s) instead of preloaded in
// <head>. gtag.js is ~180 KB: on a slow phone it competed with the map's JS
// and tiles and delayed mobile LCP, which is a map tile. (lazyOnload is not
// enough: the window load event fires before Leaflet requests any tile.)
// GA4 still counts client-side navigations from history events.
export function GoogleAnalytics({ gaId }: { gaId: string }) {
  const [load, setLoad] = useState(false);
  useEffect(() => onMapReady(() => setLoad(true), 10_000), []);
  if (!load) return null;

  return (
    <>
      <Script id="_next-ga-init">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
      </Script>
      <Script
        id="_next-ga"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
    </>
  );
}
