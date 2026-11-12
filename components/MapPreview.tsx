import { MAP_PREVIEW_ID, mapPreviewScript } from "@/app/_lib/mapView";

// Static picture of the map's first view, drawn from the HTML before any JS
// has loaded; Leaflet mounts on top of it and hides it once its own tiles
// (the same images, from the cache) have loaded. On mobile a map tile is the
// LCP element: this way it no longer waits for React and Leaflet.
// The <img>s are added by the inline script, inside an element React treats
// as opaque HTML, so hydration leaves them alone. A city page marks itself
// with MAP_PREVIEW_CITY_ATTR so the preview opens on the city.
export function MapPreview() {
  return (
    <>
      <div
        id={MAP_PREVIEW_ID}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: "" }}
      />
      <script dangerouslySetInnerHTML={{ __html: mapPreviewScript }} />
    </>
  );
}
