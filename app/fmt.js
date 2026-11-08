const D = (s) => new Date(`${s}T12:00:00Z`);
export const fmtDate = (s, o = { month: 'short', day: 'numeric' }) => D(s).toLocaleDateString('en-GB', { timeZone: 'UTC', ...o });
export const num = (n) => Number(n).toLocaleString('en-GB');
export function fmtValue(L, v) {
  if (v == null || Number.isNaN(v)) return '–';
  if (L.value_labels) return L.value_labels[Math.round(v)] ?? '–';
  return `${Number(v).toFixed(L.decimals)}${L.unit ? (L.unit === '%' || L.unit === '×' ? L.unit : ` ${L.unit}`) : ''}`;
}
export function classIndex(L, v) {
  if (v == null) return -1;
  return L.classes.findIndex((c) => (c.min == null || v >= c.min) && (c.max == null || v < c.max));
}
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
export function summarize(vals, how) {
  const a = vals.filter((v) => v != null).sort((x, y) => x - y);
  if (!a.length) return null;
  if (how === 'max') return a[a.length - 1];
  if (how === 'mean') return mean(a);
  return a[Math.min(a.length - 1, Math.floor(a.length * 0.9))];
}
