// All data are static files next to the page, so real pipeline output can replace the samples without touching the interface.
const TOOL = document.documentElement.dataset.tool;
const url = (p) => new URL(p, document.baseURI).href;
const cache = new Map();
async function raw(path) { const r = await fetch(url(path)); if (!r.ok) throw new Error(`${r.status}: ${path}`); return r.json(); }
export const get = (path) => { if (!cache.has(path)) cache.set(path, raw(path).catch((e) => { cache.delete(path); throw e; })); return cache.get(path); };
export const tool = TOOL;
export const dataUrl = (p) => url(`../data/${p}`);
export const shared = (f) => get(`../data/shared/${f}`);
export const own = (f) => get(`../data/${TOOL}/${f}`);
export const layerDay = (mode, id, date) => own(`layers/${mode}/${id}/${date}.json`);
