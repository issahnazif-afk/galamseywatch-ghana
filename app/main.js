// Controller: state change -> load files for the active layer -> build one view -> push to map and panels.
import { h, announce } from './dom.js';
import { state, set, on } from './state.js';
import { shared, own, layerDay, tool } from './data.js';
import { classIndex, summarize, mean, fmtValue, fmtDate } from './fmt.js';
import { createMap } from './map.js';
import { topbar, legend, zonecard, tablePanel, overlays, trend, tooltip } from './panels.js';
const NO_DATA = '#8b95a5';
const hash = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
function fatal(msg) { document.body.append(h('div', { class: 'toast', role: 'alert' }, msg, h('button', { class: 'btn', type: 'button', onClick: () => location.reload() }, 'Reload'))); }
const CASE_COLOR = { New: '#ef4444', 'In review': '#f59e0b', 'Field team sent': '#60a5fa', Confirmed: '#c026d3', Dismissed: '#94a3b8' };

async function boot() {
  let meta, grid, districts, params = null, drivers = null, candidates = null;
  try {
    [meta, grid, districts] = await Promise.all([own('meta.json'), own('grid.json'), shared('districts.geojson')]);
    if (tool === 'flood') { [params, drivers] = await Promise.all([own('parameters.json'), own('drivers.json')]); drivers.zonesByDay = drivers.zones; }
    else candidates = await own('candidates.json');
  } catch (e) { console.error(e); fatal('The data could not be loaded.'); return; }
  const q = hash();
  state.layerId = meta.layers.some((l) => l.id === q.layer) ? q.layer : meta.default_layer;
  state.dateIdx = meta.dates.includes(q.date) ? meta.dates.indexOf(q.date) : (meta.date_kind === 'forecast' ? 0 : meta.dates.length - 1);
  if (q.zone && districts.features[+q.zone]) state.zoneId = +q.zone;
  if (q.mode === 'agency' && tool === 'galamsey') state.mode = 'agency';
  if (q.basemap === 'plain') state.basemap = 'plain';

  const layerOf = (id) => meta.layers.find((l) => l.id === id);
  const nZ = districts.features.length;
  const groupBy = (g) => { const a = Array.from({ length: nZ }, () => []); g.zone.forEach((z, i) => a[z].push(i)); return a; };
  const pubCells = groupBy(grid);
  let fineGrid = null, fineCells = null, activeGrid = grid;

  const tip = tooltip(); const tr = trend();
  const top = topbar(meta, { onMode: () => set({ mode: state.mode === 'agency' ? 'public' : 'agency', caseId: null, overlay: null }) });
  const leg = legend(meta);
  const card = zonecard({ meta, districts, params, drivers }, { onZone: selectZone, onBack: clearZone, onSelect: () => set({ selecting: !state.selecting }) });
  const table = tablePanel(meta);
  const over = overlays({ meta, districts, params, candidates }, {
    onViewZone: (z, d) => { set({ overlay: null, layerId: meta.alert_layer, dateIdx: d }); selectZone(z); },
    onCaseChange: () => { paintCases(); },
  });
  document.getElementById('ui').append(top.el, h('div', { class: 'dock' }, card.el, leg.el), table.el, over.el, tr.el, tip.el);

  let data = null;
  const mapApi = createMap({ meta, districts, priority: meta.priority }, {
    onZone: selectZone,
    onCase: (id) => set({ caseId: id, overlay: 'case' }),
    onPoint: (p, ev) => tip.show(p.title, p.sub, ev.clientX, ev.clientY),
    onPixel(i, ev) {
      if (i == null || !data?.fine) { tip.hide(); return; }
      const L = data.layer; tip.show(`${L.tooltip_en}: ${fmtValue(L, data.fine.v[i])}`, meta.pixel_types[data.fine.t[i]], ev.clientX, ev.clientY);
    },
    onArea(idx, rect) {
      if (!data?.fines) return;
      const values = data.fines.map((d) => mean(idx.map((i) => d.v[i]).filter((v) => v != null)) ?? 0);
      tr.show({ layer: data.layer, dates: meta.dates, values, n: idx.length, rect }); set({ selecting: false });
    },
  });
  window.__gw = { map: mapApi.map, state };

  function paintCases() {
    if (tool !== 'galamsey') return;
    mapApi.setCands(state.mode === 'agency' ? candidates.items.filter((c) => c.status !== 'Dismissed').map((c) => ({ ...c, c: CASE_COLOR[c.status] })) : []);
  }
  function paintPoints() {
    if (tool === 'galamsey' && state.layerId === 'intakes') {
      const cur = data?.days?.[state.dateIdx]?.status ?? {};
      mapApi.setPoints(meta.intakes.map((x) => ({ lon: x.lon, lat: x.lat, c: ['#34d058', '#facc15', '#f59e0b', '#ef4444'][cur[x.name] ?? 0], title: `${x.name} intake`, sub: `${x.river} River: ${meta.intake_status[cur[x.name] ?? 0]}` })));
    } else mapApi.setPoints([]);
  }

  function zoneRank(L, s) { return s == null ? -1 : s; }
  function view() {
    const zid = state.zoneId; const L = data.layer; const kind = data.kind;
    const v = { kind, layer: L, zoneStats: [], classCounts: null };
    const mapZones = new Array(nZ); let mapPixels;
    if (kind === 'pixels') {
      const pv = data.day.v;
      v.zoneStats = pubCells.map((idx) => { const s = summarize(idx.map((i) => pv[i]), L.summary); const c = classIndex(L, s); return { color: c >= 0 ? L.classes[c].color : NO_DATA, text: fmtValue(L, s), rank: zoneRank(L, s), level: Math.round(s ?? 0) }; });
      const fine = data.fine; const fv = fine.v, ft = fine.t; const cls = fv.map((x) => classIndex(L, x));
      const cells = activeGrid === grid ? pubCells : fineCells;
      const scope = zid == null ? (activeGrid === grid ? null : null) : cells[zid];
      v.classCounts = new Array(L.classes.length).fill(0); v.typeCounts = [0, 0, 0, 0];
      const vals = [];
      const iter = scope ?? fv.map((_, i) => i);
      for (const i of iter) { v.typeCounts[ft[i]]++; if (!state.types[ft[i]]) continue; if (cls[i] >= 0) v.classCounts[cls[i]]++; vals.push(fv[i]); }
      v.sel = { n: vals.length, min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null, mean: mean(vals) };
      mapPixels = fv.map((_, i) => ({ c: cls[i] >= 0 ? L.classes[cls[i]].color : NO_DATA, t: ft[i], show: zid != null && activeGrid.zone[i] === zid && state.types[ft[i]] ? 1 : 0 }));
      v.kpi = tool === 'flood' ? v.zoneStats.filter((z) => z.level >= 3).length : v.zoneStats.filter((z) => z.rank >= (L.classes[1].min ?? 0)).length;
    } else {
      v.days = data.days;
      v.damStatus = data.days[state.dateIdx].status;
      v.zoneStats = data.base.zoneStats; v.kpi = data.base.kpi;
      mapPixels = activeGrid.zone.map(() => ({ c: NO_DATA, t: 0, show: 0 }));
      v.classCounts = null;
    }
    if (tool === 'flood' && !v.damStatus) v.damStatus = data.damDay.status;
    if (tool === 'galamsey') v.caseCount = zid == null ? 0 : candidates.items.filter((c) => c.zone === zid && c.status !== 'Dismissed').length;
    v.zoneStats.forEach((z, i) => { const sel = zid === i; mapZones[i] = { fill: z.color, fillOpacity: sel ? 0.06 : zid == null ? 0.58 : 0.14, stroke: sel ? '#ffffff' : 'rgba(255,255,255,0.28)', strokeWidth: sel ? 2.5 : 0.5 }; });
    v.map = { pixels: mapPixels, zones: mapZones, zoneId: zid, rank: v.zoneStats.map((z) => z.rank) };
    return v;
  }
  function render() { if (!data) return; const v = view(); mapApi.setView(v.map); leg.update(v); card.update(v); table.update(v); paintPoints(); }

  async function ensureGrid() {
    if (state.mode === 'agency') {
      if (!fineGrid) { fineGrid = await own('grid_agency.json'); fineCells = groupBy(fineGrid); }
      if (activeGrid !== fineGrid) { activeGrid = fineGrid; mapApi.setGrid(fineGrid, meta.pixel_m_agency); }
    } else if (activeGrid !== grid) { activeGrid = grid; mapApi.setGrid(grid, meta.pixel_m); }
    paintCases();
  }
  let req = 0;
  async function refresh() {
    const mine = ++req; const L = layerOf(state.layerId); const d = meta.dates;
    try {
      await ensureGrid();
      let next;
      if (L.type === 'pixels') {
        const fm = state.mode === 'agency' ? 'agency' : 'public';
        const [day, fine, fines, damDay] = await Promise.all([layerDay('public', L.id, d[state.dateIdx]), layerDay(fm, L.id, d[state.dateIdx]), Promise.all(d.map((x) => layerDay(fm, L.id, x))), tool === 'flood' ? layerDay('public', 'dams', d[state.dateIdx]) : null]);
        next = { kind: 'pixels', layer: L, day, fine, fines, damDay };
      } else {
        const A = layerOf(meta.alert_layer); const [days, day] = await Promise.all([Promise.all(d.map((x) => layerDay('public', L.id, x))), layerDay('public', A.id, d[state.dateIdx])]);
        const zoneStats = pubCells.map((idx) => { const s = summarize(idx.map((i) => day.v[i]), A.summary); const c = classIndex(A, s); return { color: c >= 0 ? A.classes[c].color : NO_DATA, text: fmtValue(A, s), rank: s ?? -1, level: Math.round(s ?? 0) }; });
        next = { kind: 'table', layer: L, days, base: { zoneStats, kpi: tool === 'flood' ? zoneStats.filter((z) => z.level >= 3).length : zoneStats.filter((z) => z.rank >= 60).length } };
      }
      if (mine !== req) return;
      data = next; render(); announce(`${L.label_en}, ${fmtDate(d[state.dateIdx], { weekday: 'long', month: 'long', day: 'numeric' })}`);
    } catch (e) { console.error(e); fatal('The data could not be loaded.'); }
  }
  function selectZone(i) { document.querySelector('.status')?.removeAttribute('open'); set({ zoneId: i, selecting: false }); tr.hide(); mapApi.flyToZone(i); }
  function clearZone() { set({ zoneId: null, selecting: false }); tr.hide(); mapApi.flyToAll(); }
  function syncHash() { const p = new URLSearchParams({ layer: state.layerId, date: meta.dates[state.dateIdx] }); if (state.zoneId != null) p.set('zone', state.zoneId); if (state.mode === 'agency') p.set('mode', 'agency'); if (state.basemap === 'plain') p.set('basemap', 'plain'); history.replaceState(null, '', `#${p}`); }

  on((p) => {
    if ('basemap' in p) mapApi.setBasemap(state.basemap);
    if ('selecting' in p) mapApi.setSelecting(state.selecting);
    top.sync();
    if ('overlay' in p || 'caseId' in p) over.update();
    if ('layerId' in p) { tr.hide(); if (layerOf(state.layerId).type !== 'pixels') state.selecting = false; }
    if ('layerId' in p || 'dateIdx' in p || 'mode' in p) refresh();
    else if ('zoneId' in p || 'types' in p || 'selecting' in p) render();
    syncHash();
  });
  document.addEventListener('click', () => { if (state.overlay === 'layers') set({ overlay: null }); });
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (state.overlay) set({ overlay: null }); else if (state.selecting) set({ selecting: false }); else if (tr.isOpen()) tr.hide(); else if (state.zoneId != null) clearZone(); });

  top.sync();
  await mapApi.ready;
  mapApi.setGrid(grid, meta.pixel_m);
  mapApi.setBasemap(state.basemap);
  if (state.zoneId != null) mapApi.flyToZone(state.zoneId); else mapApi.map.fitBounds(meta.map.bounds, { padding: innerWidth < 760 ? { top: 150, bottom: Math.round(innerHeight * 0.42), left: 16, right: 16 } : { top: 80, bottom: 50, left: 370, right: 270 }, duration: 0 });
  await refresh();
  syncHash();

  // alerts
  const A = layerOf(meta.alert_layer);
  Promise.all(meta.dates.map((d) => layerDay('public', A.id, d))).then((days) => {
    const out = [];
    if (tool === 'flood') {
      pubCells.forEach((idx, z) => {
        let best = 0, when = -1;
        days.forEach((day, t) => { const s = summarize(idx.map((i) => day.v[i]), 'max'); if (s > best) { best = s; when = t; } });
        if (best >= 3 && (params.items[z].tier === 1 || best >= 4)) { const c = A.classes[classIndex(A, best)]; const p = params.items[z]; const drv = ['rain and drains', 'river overflow', 'dam spillage', 'sea and tide'][days[when].t[idx.find((i) => days[when].v[i] === best)]];
          out.push({ zone: z, dateIdx: when, level: c.label_en, color: c.color, rank: best * 10 + (p.tier === 1 ? 1 : 0), name: p.district, sms: `Expected ${fmtDate(meta.dates[when], { weekday: 'short' })} from ${drv}. Move valuables up, avoid drains and rivers.`, text: `${c.label_en} level expected on ${fmtDate(meta.dates[when], { weekday: 'long', day: 'numeric', month: 'short' })}. Main driver: ${drv}.` }); }
      });
    } else {
      const last = days[days.length - 1], prev = days[days.length - 2];
      pubCells.forEach((idx, z) => {
        const s = summarize(idx.map((i) => last.v[i]), 'p90'), s0 = summarize(idx.map((i) => prev.v[i]), 'p90');
        if (s >= 60 && meta.priority.some((p) => p.zone === z)) { const c = A.classes[classIndex(A, s)]; const pr = meta.priority.find((p) => p.zone === z); out.push({ zone: z, dateIdx: meta.dates.length - 1, level: c.label_en, color: c.color, rank: s, name: districts.features[z].properties.name, text: `Disturbance signal ${s > s0 ? 'rising' : 'steady'} in the ${pr.river} system. Needs checking on the ground.` }); }
      });
    }
    out.sort((a, b) => b.rank - a.rank);
    top.setCount(out.length); over.setAlerts(out);
  }).catch((e) => console.error(e));
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('../sw.js').catch(() => {});
}
boot();
