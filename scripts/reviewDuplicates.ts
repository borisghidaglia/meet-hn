// Local, human-in-the-loop review UI for deciding city-duplicate canonicals.
// Reads ./cityOsm.json (from backfillOsm.ts), clusters likely duplicates with a
// generous net, then groups each cluster's records by their resolved OSM object.
//
// Key idea: canonical identity = osm_type+osm_id. So:
//   - If every record in a cluster resolves to ONE osm object (e.g. Berlin, all
//     R62422), it's AUTO-resolved — nothing to decide.
//   - You only decide clusters with MULTIPLE distinct osm objects (e.g. Paris:
//     city R71525 vs suburb R7444 vs city_district R1641193): pick the canonical
//     osm object, or mark "keep separate" (genuinely different places).
//
// Every change auto-saves to ./cityDecisions.tmp.json (resumable). Read-only on
// DynamoDB.  npm run script scripts/reviewDuplicates.ts

import { createServer } from "http";
import { existsSync, readFileSync, writeFileSync } from "fs";

const OSM = "./cityOsm.json";
const REVIEW = "./cityResolutionReview.json";
const DECISIONS = "./cityDecisions.tmp.json";
const PORT = 5173;

type Row = {
  originalId: string;
  scheme: string;
  name?: string;
  country?: string;
  countryCode?: string;
  storedHackers: number;
  realUsers: number;
  storedCoords: [number, number] | null;
  osm: {
    osmType: string;
    osmId: number;
    addresstype: string;
    fullName: string;
    lat: number;
    lon: number;
  } | null;
  matchDistanceKm: number | null;
  note?: string;
};

class UF {
  parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a: string, b: string) {
    this.parent.set(this.find(a), this.find(b));
  }
}

const osmKey = (r: Row) => (r.osm ? `${r.osm.osmType}/${r.osm.osmId}` : `noosm/${r.originalId}`);
const osmShort = (r: Row) =>
  r.osm ? `${r.osm.osmType.charAt(0).toUpperCase()}${r.osm.osmId}` : "NO-OSM";

function buildClusters(rows: Row[]) {
  const uf = new UF();
  const byName = new Map<string, string>();
  const byOsm = new Map<string, string>();
  for (const r of rows) {
    uf.find(r.originalId);
    if (r.name) {
      const k = `${r.name.trim().toLowerCase()}|${(r.countryCode ?? "").toLowerCase()}`;
      if (byName.has(k)) uf.union(r.originalId, byName.get(k)!);
      else byName.set(k, r.originalId);
    }
    if (r.osm) {
      const k = osmKey(r);
      if (byOsm.has(k)) uf.union(r.originalId, byOsm.get(k)!);
      else byOsm.set(k, r.originalId);
    }
  }
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const root = uf.find(r.originalId);
    (groups.get(root) ?? groups.set(root, []).get(root)!).push(r);
  }

  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((members) => {
      const first = members.find((m) => m.name) ?? members[0]!;
      // Group records by their osm object.
      const osmMap = new Map<string, any>();
      for (const m of members) {
        const k = osmKey(m);
        if (!osmMap.has(k))
          osmMap.set(k, {
            osmKey: k,
            short: osmShort(m),
            addresstype: m.osm?.addresstype ?? "?",
            fullName: m.osm?.fullName ?? m.note ?? m.originalId,
            lat: m.osm?.lat ?? m.storedCoords?.[0] ?? null,
            lon: m.osm?.lon ?? m.storedCoords?.[1] ?? null,
            users: 0,
            memberIds: [] as string[],
            maxDist: 0,
          });
        const o = osmMap.get(k);
        o.users += m.realUsers;
        o.memberIds.push(m.originalId);
        o.maxDist = Math.max(o.maxDist, m.matchDistanceKm ?? 0);
      }
      const osmObjects = [...osmMap.values()].sort((a, b) => b.users - a.users);
      // Per-record markers (original pin of each record) for the map.
      const markers = members
        .map((m) => ({
          originalId: m.originalId,
          osmKey: osmKey(m),
          short: osmShort(m),
          addresstype: m.osm?.addresstype ?? "?",
          users: m.realUsers,
          // Prefer the record's own stored coord (the original pin); else osm.
          lat: m.storedCoords?.[0] ?? m.osm?.lat ?? null,
          lon: m.storedCoords?.[1] ?? m.osm?.lon ?? null,
          matchDist: m.matchDistanceKm ?? 0,
        }))
        .filter((m) => m.lat != null);
      return {
        category: "duplicate",
        id: members.map((m) => m.originalId).sort().join("__"),
        label: `${first.name ?? "(no name)"} / ${first.countryCode ?? "?"}`,
        totalUsers: members.reduce((s, m) => s + m.realUsers, 0),
        recordCount: members.length,
        osmObjects,
        markers,
        needsDecision: osmObjects.length > 1,
      };
    })
    .sort(
      (a, b) =>
        Number(b.needsDecision) - Number(a.needsDecision) ||
        b.osmObjects.length - a.osmObjects.length ||
        b.totalUsers - a.totalUsers,
    );
}

// Build "resolution" review items from cityResolutionReview.json: records whose
// forward match landed far from the pin. Two candidates — the forward match and
// what's actually at the pin — for you to choose between on the map.
function buildResolutionItems(review: Record<string, any>) {
  const osmObj = (o: any, users: number, oid: string) => ({
    osmKey: `${o.osmType}/${o.osmId}`,
    short: `${o.osmType.charAt(0).toUpperCase()}${o.osmId}`,
    addresstype: o.addresstype,
    fullName: o.fullName,
    lat: o.lat,
    lon: o.lon,
    users,
    memberIds: [oid],
    maxDist: 0,
  });
  return Object.values(review)
    .map((r: any) => {
      const objs = (r.candidates ?? []).map((c: any) => ({
        ...osmObj(c, c.source === "name" ? r.realUsers : 0, r.originalId),
        role: c.source === "name" ? "name" : "pin",
        maxDist: c.source === "name" ? r.matchDistanceKm ?? 0 : 0,
      }));
      return {
        category: "resolution",
        id: `resolve::${r.originalId}`,
        label: `${r.name ?? "(no name)"} — ${Math.round(r.matchDistanceKm)}km off`,
        totalUsers: r.realUsers,
        recordCount: 1,
        osmObjects: objs,
        markers: [{ originalId: r.originalId, lat: r.pin[0], lon: r.pin[1], osmKey: "pin", addresstype: "pin", users: r.realUsers, matchDist: 0 }],
        needsDecision: true,
      };
    })
    .sort((a, b) => b.totalUsers - a.totalUsers || (b.osmObjects[0]?.maxDist ?? 0) - (a.osmObjects[0]?.maxDist ?? 0));
}

function page(clusters: any[], decisions: any) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>City duplicate review</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  body{margin:0;font:14px/1.4 system-ui,sans-serif;display:grid;grid-template-columns:360px 1fr 400px;height:100vh}
  #list{overflow:auto;border-right:1px solid #ddd}
  #list .item{padding:8px 12px;border-bottom:1px solid #eee;cursor:pointer}
  #list .item:hover{background:#f6f6ef}
  #list .item.active{background:#e8e8df;font-weight:600}
  #list .badge{float:right;font-weight:400;color:#888;font-size:12px}
  #list .auto{color:#2a8}
  #list .pending{color:#c80}
  #map{height:100vh}
  #panel{padding:16px;overflow:auto;border-left:1px solid #ddd}
  .obj{border:1px solid #ddd;border-radius:6px;padding:8px;margin:6px 0}
  .obj.canon{border-color:#2a8;background:#f0faf5}
  .obj label{display:block;cursor:pointer}
  .meta{color:#666;font-size:12px}
  .warn{color:#c33}
  textarea{width:100%;box-sizing:border-box;min-height:48px}
  .opt{margin:8px 0}
  h2{margin:.2em 0}
  .pct{padding:8px 12px;background:#fafafa;border-bottom:1px solid #ddd;position:sticky;top:0;z-index:5}
  .note{background:#eef6ff;border:1px solid #cde;border-radius:6px;padding:8px;margin:6px 0;font-size:13px}
</style></head><body>
<div id="list"></div>
<div id="map"></div>
<div id="panel"><p>Select a cluster on the left.</p></div>
<script>
const CLUSTERS = ${JSON.stringify(clusters)};
let DEC = ${JSON.stringify(decisions)};
let active = null, map, layer;
const listEl = document.getElementById('list');
const panelEl = document.getElementById('panel');

function save(){ fetch('/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(DEC)}); renderList(); }
// Auto clusters (one osm object) are decided by definition. Multi-osm need input.
function decided(c){ if(!c.needsDecision) return true; const d=DEC[c.id]; return !!(d && (d.decision==='separate' || d.canonicalOsm)); }

function itemRow(c){
  const i=CLUSTERS.indexOf(c);
  const tag = c.category==='resolution'
      ? (decided(c) ? '<span class="badge auto">✓ fixed</span>' : '<span class="badge pending">● verify</span>')
      : !c.needsDecision ? '<span class="badge auto">✓ auto · 1 osm</span>'
      : (decided(c) ? '<span class="badge auto">✓ '+c.osmObjects.length+' osm</span>'
                    : '<span class="badge pending">● '+c.osmObjects.length+' osm · decide</span>');
  return '<div class="item '+(active===i?'active':'')+'" id="item-'+i+'" onclick="select('+i+')">'+tag+c.label+
    ' <span class="meta">'+c.totalUsers+'👤</span></div>';
}
function renderList(){
  const dups = CLUSTERS.filter(c=>c.category==='duplicate');
  const res = CLUSTERS.filter(c=>c.category==='resolution');
  const dupPending = dups.filter(c=>c.needsDecision && !decided(c)).length;
  const resPending = res.filter(c=>!decided(c)).length;
  let html = '<div class="pct"><b>'+dupPending+'</b> duplicate decisions · <b>'+resPending+'</b> far-match reviews left</div>';
  html += '<div class="pct" style="background:#eef">DUPLICATES</div>' + dups.map(itemRow).join('');
  if(res.length) html += '<div class="pct" style="background:#fee">FAR-MATCH REVIEW (forward vs pin)</div>' + res.map(itemRow).join('');
  listEl.innerHTML = html;
}

// Which osm object is canonical right now? Auto → the single osm. Decision →
// the chosen one (null until picked / if "keep separate").
function canonicalOsmKey(c){
  if(!c.needsDecision) return c.osmObjects[0].osmKey;
  const d=DEC[c.id];
  return (d && d.decision==='merge') ? d.canonicalOsm : null;
}

function drawMap(c){
  if(layer) layer.remove();
  layer = L.layerGroup().addTo(map);
  const canonKey = canonicalOsmKey(c);
  const sep = DEC[c.id] && DEC[c.id].decision==='separate';
  const pts=[];
  // Small grey dots = each record's ORIGINAL pin (provenance / spread).
  c.markers.forEach(m=>{
    pts.push([m.lat,m.lon]);
    L.circleMarker([m.lat,m.lon],{radius:4,color:'#888',weight:1,fillColor:'#bbb',fillOpacity:0.9})
      .addTo(layer).bindPopup('record · '+m.users+' users<br><small>'+m.originalId+'</small>'+
        (m.matchDist>30?'<br><span style="color:#c33">⚠ '+Math.round(m.matchDist)+'km from its osm match</span>':''));
  });
  // Big markers = the distinct OSM places. Green = canonical, orange = alias.
  c.osmObjects.forEach(o=>{
    if(o.lat==null) return;
    pts.push([o.lat,o.lon]);
    const isCanon = !sep && o.osmKey===canonKey;
    L.circleMarker([o.lat,o.lon],{
      radius:10, weight:2,
      color:isCanon?'#1a8a4a':(sep?'#3667c9':'#d2691e'),
      fillColor:isCanon?'#2ecc71':(sep?'#5b8def':'#f0a050'), fillOpacity:0.85
    }).addTo(layer).bindPopup(
      '<b>'+o.addresstype+'</b> '+o.short+(isCanon?' <span style="color:#1a8a4a">★ canonical</span>':'')+
      '<br>'+o.users+' users · '+o.memberIds.length+' record(s)<br><small>'+o.fullName+'</small>');
  });
  if(pts.length) map.fitBounds(pts,{padding:[60,60],maxZoom:12});
}

function select(i){
  active=i; const c=CLUSTERS[i]; renderList();
  document.getElementById('item-'+i)?.scrollIntoView({block:'nearest'});
  drawMap(c);

  if(!c.needsDecision){
    const o=c.osmObjects[0];
    const d=DEC[c.id]||{};
    const sep=d.decision==='separate';
    panelEl.innerHTML='<h2>'+c.label+'</h2>'+
      '<div class="note">All <b>'+c.recordCount+' record(s)</b> resolved to one OSM place — <b>'+o.short+'</b> ('+o.addresstype+'), shown in '+(sep?'blue':'green')+'. '+
      (sep?'You marked this as NOT a real merge.':'Auto-merged: these are the same place, so all records redirect to '+o.short+'.')+
      (o.maxDist>30?'<br><span class="warn">⚠ a record was '+Math.round(o.maxDist)+'km from its osm match — check the pins.</span>':'')+'</div>'+
      '<div class="meta">'+o.fullName+'</div>'+
      '<div style="margin:10px 0"><b>Records merged here:</b>'+
        c.markers.concat(c.recordCount>c.markers.length?[{originalId:'(legacy id, no coordinate)',users:0}]:[])
          .map(m=>'<div class="meta">• '+m.originalId+' · '+m.users+' users</div>').join('')+'</div>'+
      '<div class="opt"><label><input type="checkbox" '+(sep?'checked':'')+' onchange="toggleSep(this.checked)"> '+
        'Override: these are <b>not</b> the same place (keep separate)</label></div>'+
      '<div class="opt"><b>Comment</b><textarea oninput="setComment(this.value)" placeholder="optional">'+(d.comment||'')+'</textarea></div>';
    return;
  }

  const d = DEC[c.id] || {};
  const isRes = c.category==='resolution';
  const note = isRes
    ? 'The user typed a name and dropped a pin (grey dot). Searching by that <b>name</b> landed <b>'+Math.round(c.osmObjects[0].maxDist||0)+'km</b> away from where they actually <b>pinned</b>. Which represents this user — the place matched by the typed name, or the place under their pin?'
    : c.osmObjects.length+' different OSM places share this name. Pick the canonical one (others redirect into it), or keep them separate if they are genuinely different places.';
  const role = o => o.role==='name' ? ' <span class="meta">(matched by typed name)</span>' : o.role==='pin' ? ' <span class="meta">(at the pin)</span>' : '';
  panelEl.innerHTML = '<h2>'+c.label+'</h2>'+
    '<div class="note">'+note+'</div>'+
    (isRes ? '' : '<div class="opt"><label><input type="radio" name="dec" '+(d.decision==='separate'?'checked':'')+' onchange="setSep()"> Keep separate (not duplicates)</label></div>')+
    '<div><b>'+(isRes?'Pick the correct location:':'Or pick the canonical:')+'</b></div>'+
    c.osmObjects.map(o=>{
      const checked = d.canonicalOsm===o.osmKey;
      const warn = (!isRes && o.maxDist>30) ? ' <span class="warn">⚠ '+Math.round(o.maxDist)+'km off</span>' : '';
      return '<div class="obj '+(checked?'canon':'')+'"><label>'+
        '<input type="radio" name="dec" '+(checked?'checked':'')+' onchange="setCanon(\\''+o.osmKey+'\\')"> '+
        '<b>'+o.addresstype+'</b>'+role(o)+' · '+o.short+(isRes?'':' · '+o.users+' users')+warn+
        '<div class="meta">'+o.fullName+(isRes?'':'<br>records: '+o.memberIds.join(', '))+'</div>'+
        '</label></div>';
    }).join('')+
    '<div class="opt"><b>Comment</b><textarea oninput="setComment(this.value)" placeholder="optional">'+(d.comment||'')+'</textarea></div>';
}

function ensure(){ const c=CLUSTERS[active]; if(!DEC[c.id]) DEC[c.id]={label:c.label}; return DEC[c.id]; }
function setSep(){ const d=ensure(); d.decision='separate'; d.canonicalOsm=null; save(); select(active); }
function toggleSep(on){ const c=CLUSTERS[active]; if(on){ const d=ensure(); d.decision='separate'; d.canonicalOsm=null; } else { delete DEC[c.id]; } save(); select(active); }
function setCanon(k){ const d=ensure(); d.decision='merge'; d.canonicalOsm=k; save(); select(active); }
function setComment(v){ const d=ensure(); d.comment=v; save(); }

// Arrow keys navigate the list (ignored while typing in the comment box).
document.addEventListener('keydown',e=>{
  if(e.target && (e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT')) return;
  if(e.key!=='ArrowDown'&&e.key!=='ArrowUp') return;
  e.preventDefault();
  const n = active==null ? 0 : active + (e.key==='ArrowDown'?1:-1);
  select(Math.max(0, Math.min(CLUSTERS.length-1, n)));
});

map = L.map('map').setView([30,10],2);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OSM'}).addTo(map);
renderList();
</script></body></html>`;
}

function main() {
  if (!existsSync(OSM)) {
    console.error(`Missing ${OSM} — run scripts/backfillOsm.ts first.`);
    process.exit(1);
  }
  const rows: Row[] = Object.values(JSON.parse(readFileSync(OSM, "utf8")));
  const review = existsSync(REVIEW) ? JSON.parse(readFileSync(REVIEW, "utf8")) : {};
  const clusters = [...buildClusters(rows), ...buildResolutionItems(review)];
  let decisions = existsSync(DECISIONS)
    ? JSON.parse(readFileSync(DECISIONS, "utf8"))
    : {};

  const pending = clusters.filter((c) => c.needsDecision && c.category === "duplicate").length;
  const resolutionN = clusters.filter((c) => c.category === "resolution").length;
  console.log(
    `${rows.length} cities → ${pending} duplicate decisions, ${resolutionN} resolution reviews (far matches).`,
  );

  createServer((req, res) => {
    if (req.method === "POST" && req.url === "/save") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        decisions = JSON.parse(body);
        writeFileSync(DECISIONS, JSON.stringify(decisions, null, 2));
        res.writeHead(200).end("ok");
      });
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(page(clusters, decisions));
  }).listen(PORT, () =>
    console.log(`\n  Review UI →  http://localhost:${PORT}\n  Auto-saves to ${DECISIONS}\n  Ctrl+C when done.`),
  );
}

main();
