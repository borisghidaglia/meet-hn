// The map's initial view, shared by Leaflet (components/MapContainer.tsx) and
// the static preview drawn before any JS has loaded (components/MapPreview.tsx).
// Both must agree, or the preview would not line up with the map it precedes.

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const REGION_ZOOM = 3;
export const CITY_ZOOM = 6;
// [[south, west], [north, east]]
export const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-88, -180],
  [88, 180],
];

// The map opens on the visitor's region, guessed from their time zone.
export const REGION_COORDINATES = {
  Africa: { lat: 0, lon: 20 },
  America: { lat: 20, lon: -75 },
  Asia: { lat: 50, lon: 100 },
  Atlantic: { lat: 20, lon: -30 },
  Australia: { lat: -30, lon: 135 },
  Europe: { lat: 50, lon: 15 },
  Indian: { lat: 20, lon: 80 },
  Pacific: { lat: 20, lon: 160 },
};

export function getCoordinatesFromRegion() {
  if (typeof window === "undefined") return REGION_COORDINATES["Europe"];

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const region = timeZone.split("/")[0];
  return (
    REGION_COORDINATES[region as keyof typeof REGION_COORDINATES] ||
    REGION_COORDINATES["Europe"]
  );
}

export const MAP_PREVIEW_ID = "map-preview";
// A city page puts "lat,lon" in this attribute (its HTML comes before the
// map's), so the preview opens on the city like the map does.
export const MAP_PREVIEW_CITY_ATTR = "data-map-preview-city";

// Inline script that runs while the HTML is parsed, right after the empty
// preview element: it computes the tiles Leaflet will show for the initial
// view (same projection, rounding and max-bounds clamp as Leaflet 1.9's
// Map/GridLayer) and adds them as plain <img>s at the same positions. The
// browser then fetches the tiles in parallel with the page's JS instead of
// after it, and Leaflet later gets the same URLs from the HTTP cache.
export const mapPreviewScript = `(function(){try{
var el=document.getElementById(${JSON.stringify(MAP_PREVIEW_ID)});
var W=el.clientWidth,H=el.clientHeight;if(!W||!H)return;
var ce=document.querySelector("[${MAP_PREVIEW_CITY_ATTR}]"),c=ce&&ce.getAttribute(${JSON.stringify(MAP_PREVIEW_CITY_ATTR)}).split(",").map(Number),z;
if(c&&c.length===2&&isFinite(c[0])&&isFinite(c[1])){z=${CITY_ZOOM}}else{
var R=${JSON.stringify(REGION_COORDINATES)},r=R[Intl.DateTimeFormat().resolvedOptions().timeZone.split("/")[0]]||R.Europe;
c=[r.lat,r.lon];z=${REGION_ZOOM}}
var S=256*Math.pow(2,z),E=6378137,d=Math.PI/180,k=0.5/(Math.PI*E);
function p(lat,lon){var l=Math.max(Math.min(85.0511287798,lat),-85.0511287798),s=Math.sin(l*d);
return[S*(k*E*lon*d+0.5),S*(-k*E*Math.log((1+s)/(1-s))/2+0.5)]}
var B=${JSON.stringify(WORLD_BOUNDS)},a=p(B[1][0],B[1][1]),b=p(B[0][0],B[0][1]);
var bx=[Math.min(a[0],b[0]),Math.max(a[0],b[0])],by=[Math.min(a[1],b[1]),Math.max(a[1],b[1])];
function rb(l,r){return l+r>0?Math.round(l-r)/2:Math.max(0,Math.ceil(l))-Math.max(0,Math.floor(r))}
var q=p(c[0],c[1]),hx=W/2,hy=H/2;
var dx=rb(bx[0]-(q[0]-hx),-(bx[1]-(q[0]+hx))),dy=rb(by[0]-(q[1]-hy),-(by[1]-(q[1]+hy)));
if(Math.abs(dx)>1||Math.abs(dy)>1){q=[q[0]+dx,q[1]+dy]}
var ox=Math.round(q[0]-hx),oy=Math.round(q[1]-hy),fx=Math.floor(q[0]),fy=Math.floor(q[1]),n=Math.pow(2,z);
var x0=Math.max(0,Math.floor((fx-hx)/256)),x1=Math.min(n-1,Math.ceil((fx+hx)/256)-1);
var y0=Math.max(0,Math.floor((fy-hy)/256)),y1=Math.min(n-1,Math.ceil((fy+hy)/256)-1);
var t=${JSON.stringify(TILE_URL)};
for(var y=y0;y<=y1;y++)for(var x=x0;x<=x1;x++){var i=document.createElement("img");i.alt="";
i.style.cssText="position:absolute;width:256px;height:256px;max-width:none;left:"+(x*256-ox)+"px;top:"+(y*256-oy)+"px";
i.src=t.replace("{z}",z).replace("{x}",x).replace("{y}",y);el.appendChild(i)}
var at=document.createElement("div");at.setAttribute("data-attribution","");
at.style.cssText="position:absolute;right:0;bottom:0;padding:0 5px;font-size:12px;line-height:1.4;color:#333;background:rgba(255,255,255,.8)";
at.innerHTML='Leaflet | &copy; <a href="http://www.openstreetmap.org/copyright" style="color:#0078a8">OpenStreetMap</a>';
el.appendChild(at)}catch(e){}})()`;
