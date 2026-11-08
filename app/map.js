// MapLibre wrapper: imagery, district polygons, value dots, water intakes, agency candidates and decluttered pills.
import { h, isNarrow, prefersReducedMotion } from './dom.js';
import { dataUrl } from './data.js';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const REF = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const ringBounds = (g) => { let w = 180, s = 90, e = -180, n = -90; const walk = (c) => { if (typeof c[0] === 'number') { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); } else c.forEach(walk); }; walk(g.coordinates); return [[w, s], [e, n]]; };
const fc = (features) => ({ type: 'FeatureCollection', features });
const toPixels = (g) => fc(g.lon.map((lo, i) => ({ type: 'Feature', id: i, properties: { i, show: 0, c: '#888', t: 0 }, geometry: { type: 'Point', coordinates: [lo, g.lat[i]] } })));

export function createMap({ meta, districts, priority }, cb) {
  const zoneFC = structuredClone(districts);
  const zoneBounds = zoneFC.features.map((f) => ringBounds(f.geometry));
  let pixelFC = fc([]);
  const pxRadius = (m, extra = 0) => { const k = (m * 0.4) / 77688; return ['interpolate', ['exponential', 2], ['zoom'], 5, k * 32 + extra, 15, k * 32768 + extra]; };
  const map = new maplibregl.Map({
    container: 'map',
    style: { version: 8, sources: {
      ghana: { type: 'geojson', data: dataUrl('shared/ghana.geojson') }, water: { type: 'geojson', data: dataUrl('shared/water.geojson') },
      regions: { type: 'geojson', data: dataUrl('shared/regions.geojson') },
      esri: { type: 'raster', tiles: [ESRI], tileSize: 256, maxzoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
      ref: { type: 'raster', tiles: [REF], tileSize: 256, maxzoom: 15 },
      zones: { type: 'geojson', data: zoneFC }, pixels: { type: 'geojson', data: pixelFC }, points: { type: 'geojson', data: fc([]) }, cands: { type: 'geojson', data: fc([]) },
    }, layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0c2238' } },
      { id: 'land', type: 'fill', source: 'ghana', paint: { 'fill-color': '#47603a' } },
      { id: 'lake', type: 'fill', source: 'water', paint: { 'fill-color': '#154a72' } },
      { id: 'imagery', type: 'raster', source: 'esri', paint: { 'raster-brightness-max': 0.88 } },
      { id: 'zone-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['get', 'fill'], 'fill-opacity': ['get', 'fillOpacity'] } },
      { id: 'zone-line', type: 'line', source: 'zones', paint: { 'line-color': ['get', 'stroke'], 'line-width': ['get', 'strokeWidth'] } },
      { id: 'region-line', type: 'line', source: 'regions', paint: { 'line-color': 'rgba(255,255,255,0.55)', 'line-width': 1.1 } },
      { id: 'ref', type: 'raster', source: 'ref', minzoom: 7, paint: { 'raster-opacity': 0.85 } },
      { id: 'pixels', type: 'circle', source: 'pixels', filter: ['==', ['get', 'show'], 1], paint: { 'circle-color': ['get', 'c'], 'circle-radius': pxRadius(5000), 'circle-opacity': 0.95, 'circle-stroke-width': 0.6, 'circle-stroke-color': 'rgba(0,0,0,0.35)' } },
      { id: 'pixel-hover', type: 'circle', source: 'pixels', filter: ['==', ['get', 'i'], -1], paint: { 'circle-color': 'rgba(255,255,255,0)', 'circle-radius': pxRadius(5000, 2), 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } },
      { id: 'points', type: 'circle', source: 'points', paint: { 'circle-color': ['get', 'c'], 'circle-radius': 8, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } },
      { id: 'cands', type: 'circle', source: 'cands', paint: { 'circle-color': ['get', 'c'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4.5, 11, 10], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.6 } },
    ] },
    center: meta.map.center, zoom: meta.map.zoom, minZoom: 4.4, maxZoom: 16, maxBounds: [[-9, 1], [6.5, 14.5]],
    attributionControl: false, boxZoom: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Boundaries: geoBoundaries (CC BY 4.0)' }), 'bottom-right');
  map.touchZoomRotate.disableRotation();
  const ready = new Promise((res) => map.once('style.load', res));
  const canvasEl = map.getCanvasContainer();
  canvasEl.setAttribute('role', 'application');

  // pills: one per priority district, thinned on screen so the national view stays readable
  const pills = priority.map((p) => {
    const f = zoneFC.features[p.zone];
    const el = h('button', { class: 'zone-pill', type: 'button', 'aria-label': f.properties.name, title: f.properties.name, onClick: () => cb.onZone(p.zone) }, p.code);
    new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(f.properties.label).addTo(map);
    return { el, zone: p.zone, pt: f.properties.label, rank: 0 };
  });
  let selectedZone = null;
  function declutter() {
    const placed = [];
    const minD = isNarrow() ? 50 : 54;
    [...pills].sort((a, b) => (b.zone === selectedZone) - (a.zone === selectedZone) || b.rank - a.rank).forEach((p) => {
      const q = map.project(p.pt);
      const clash = placed.some((o) => Math.abs(o.x - q.x) < minD && Math.abs(o.y - q.y) < 30);
      p.el.style.display = clash ? 'none' : '';
      if (!clash) placed.push(q);
    });
  }
  map.on('zoomend', declutter); map.on('moveend', declutter);

  let hover = -1;
  const setHover = (id) => { if (id !== hover) { hover = id; map.setFilter('pixel-hover', ['==', ['get', 'i'], id]); } };
  map.on('mousemove', 'pixels', (e) => { if (selecting || !e.features?.[0]) return; setHover(e.features[0].properties.i); cb.onPixel(e.features[0].properties.i, e.originalEvent); });
  map.on('mouseleave', 'pixels', () => { setHover(-1); cb.onPixel(null); });
  for (const l of ['cands', 'points']) { map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; }); }
  map.on('click', (e) => {
    if (selecting || performance.now() - lastArea < 400) return;
    const c = map.queryRenderedFeatures(e.point, { layers: ['cands'] });
    if (c.length) return cb.onCase(c[0].properties.id);
    const ip = map.queryRenderedFeatures(e.point, { layers: ['points'] });
    if (ip.length) return cb.onPoint(ip[0].properties, e.originalEvent);
    const px = map.queryRenderedFeatures(e.point, { layers: ['pixels'] });
    if (px.length) { setHover(px[0].properties.i); return cb.onPixel(px[0].properties.i, e.originalEvent); }
    const z = map.queryRenderedFeatures(e.point, { layers: ['zone-fill'] });
    if (z.length) cb.onZone(z[0].properties.id);
  });
  map.on('movestart', () => cb.onPixel(null));

  let selecting = false, lastArea = -1e9, rect = null, start = null;
  const local = (ev) => { const r = canvasEl.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  canvasEl.addEventListener('pointerdown', (ev) => { if (!selecting || ev.button !== 0) return; ev.preventDefault(); canvasEl.setPointerCapture(ev.pointerId); start = local(ev); rect = h('div', { class: 'select-rect' }); canvasEl.append(rect); });
  canvasEl.addEventListener('pointermove', (ev) => { if (!selecting || !start) return; const [x, y] = local(ev); Object.assign(rect.style, { left: `${Math.min(x, start[0])}px`, top: `${Math.min(y, start[1])}px`, width: `${Math.abs(x - start[0])}px`, height: `${Math.abs(y - start[1])}px` }); });
  canvasEl.addEventListener('pointerup', (ev) => {
    if (!selecting || !start) return;
    const [x, y] = local(ev); const box = [[Math.min(x, start[0]), Math.min(y, start[1])], [Math.max(x, start[0]), Math.max(y, start[1])]];
    start = null; rect?.remove(); rect = null; lastArea = performance.now();
    if (box[1][0] - box[0][0] < 6 && box[1][1] - box[0][1] < 6) return;
    const idx = [...new Set(map.queryRenderedFeatures(box, { layers: ['pixels'] }).map((f) => f.properties.i))];
    const r = canvasEl.getBoundingClientRect();
    cb.onArea(idx, { x: r.left + box[0][0], y: r.top + box[0][1], w: box[1][0] - box[0][0], h: box[1][1] - box[0][1] });
  });

  const padding = () => (isNarrow() ? { top: 150, bottom: Math.round(innerHeight * 0.42), left: 16, right: 16 } : { top: 110, bottom: 60, left: 380, right: 280 });
  const cam = (x) => ({ padding: padding(), duration: prefersReducedMotion() ? 0 : 900, essential: true, ...x });
  return {
    map, ready,
    setGrid(g, metres) { pixelFC = toPixels(g); map.getSource('pixels').setData(pixelFC); map.setPaintProperty('pixels', 'circle-radius', pxRadius(metres)); map.setPaintProperty('pixel-hover', 'circle-radius', pxRadius(metres, 2)); },
    setView(v) {
      pixelFC.features.forEach((f, i) => Object.assign(f.properties, v.pixels[i]));
      map.getSource('pixels').setData(pixelFC);
      zoneFC.features.forEach((f, i) => Object.assign(f.properties, v.zones[i]));
      map.getSource('zones').setData(zoneFC);
      selectedZone = v.zoneId;
      pills.forEach((p) => { p.rank = v.rank[p.zone] ?? 0; p.el.classList.toggle('is-selected', p.zone === v.zoneId); });
      declutter();
    },
    setPoints(items) { map.getSource('points').setData(fc(items.map((p) => ({ type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })))); },
    setCands(items) { map.getSource('cands').setData(fc(items.map((p) => ({ type: 'Feature', properties: { id: p.id, c: p.c }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })))); },
    flyToZone(i) { map.fitBounds(zoneBounds[i], cam({ maxZoom: 11.5 })); },
    flyToPoint(lon, lat) { map.flyTo(cam({ center: [lon, lat], zoom: 12 })); },
    flyToAll() { map.fitBounds(meta.map.bounds, cam({})); },
    setBasemap(m) { for (const l of ['imagery', 'ref']) map.setLayoutProperty(l, 'visibility', m === 'plain' ? 'none' : 'visible'); },
    setSelecting(on) { selecting = on; document.getElementById('map').classList.toggle('is-selecting', on); if (on) { map.dragPan.disable(); setHover(-1); cb.onPixel(null); } else { map.dragPan.enable(); start = null; rect?.remove(); rect = null; } },
  };
}
