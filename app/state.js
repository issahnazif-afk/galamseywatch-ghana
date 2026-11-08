export const state = { layerId: null, dateIdx: 0, zoneId: null, types: { 0: true, 1: true, 2: true, 3: true }, selecting: false, overlay: null, basemap: 'satellite', mode: 'public', caseId: null };
const fns = new Set();
export function set(p) { Object.assign(state, p); for (const f of fns) f(p); }
export const on = (f) => fns.add(f);
