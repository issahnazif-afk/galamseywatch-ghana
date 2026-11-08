// All floating panels. Text goes in as text nodes through h(), never as HTML.
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { state, set } from './state.js';
import { fmtDate, fmtValue, num } from './fmt.js';
import { tool } from './data.js';
const NAME = { galamsey: ['Galamsey', 'Watch'], flood: ['Flood', 'Watch'] };

export function topbar(meta, cb) {
  const el = h('header', { class: 'topbar' });
  let badge, menu;
  const dated = (i) => {
    const d = meta.dates[i];
    if (meta.date_kind === 'forecast') return i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `Day +${i}`;
    return i === meta.dates.length - 1 ? 'Latest pass' : `${(meta.dates.length - 1 - i) * 6} days ago`;
  };
  const tabs = h('div', { class: 'dates', role: 'tablist', 'aria-label': meta.date_kind === 'forecast' ? 'Forecast day' : 'Satellite pass' },
    meta.dates.map((d, i) => h('button', { class: 'date-tab', role: 'tab', type: 'button', onClick: () => set({ dateIdx: i }) }, fmtDate(d), h('small', null, dated(i)))));
  const btn = (name, label, over) => h('button', { class: 'round-btn', type: 'button', 'aria-label': label, title: label, onClick: (e) => { e.stopPropagation(); set({ overlay: state.overlay === over ? null : over }); } }, icon(name));
  const bell = btn('bell', 'Alerts', 'alerts'); badge = h('span', { class: 'badge', hidden: true }); bell.append(badge);
  const layersBtn = btn('layers', 'Map layers', 'layers');
  menu = h('div', { class: 'menu panel', hidden: true, onClick: (e) => e.stopPropagation() });
  const modeBtn = tool === 'galamsey' ? h('button', { class: 'round-btn lang-btn mode-btn', type: 'button', title: 'Switch between public and agency views', onClick: () => cb.onMode() }) : null;
  const status = h('details', { class: 'status panel', open: !matchMedia('(max-width:760px)').matches && state.zoneId == null },
    h('summary', null, h('span', { class: 'dot' }), meta.dataset.kind === 'sample' ? 'Sample data, not a live service' : 'Open model data, not an official warning', h('span', { class: 'chev' }, icon('chevron'))),
    h('div', { class: 'status-body' }, h('p', null, meta.dataset.note), h('p', null, 'Updated ', new Date(meta.dataset.generated_at).toLocaleString('en-GB', { timeZone: 'Africa/Accra', dateStyle: 'medium', timeStyle: 'short' }), ' GMT'),
      tool === 'flood' ? h('p', null, 'In an emergency follow NADMO and GMet.') : h('p', null, 'A map signal is never proof of illegal mining.')));
  el.append(h('div', { class: 'left-stack' },
    h('div', { class: 'brand-row' },
      h('a', { class: 'brand', href: '../index.html', 'aria-label': 'Back to home' }, h('img', { class: 'brand-mark', src: `../assets/${tool}.svg`, alt: '' }), h('span', null, h('span', { class: 'brand-h' }, NAME[tool][0]), NAME[tool][1])),
      h('a', { class: 'tool-switch', href: tool === 'flood' ? '../galamsey/index.html' : '../flood/index.html' }, tool === 'flood' ? 'GalamseyWatch' : 'FloodWatch', ' ›')),
    status), tabs, h('div', { class: 'actions' }, layersBtn, bell, btn('info', 'About this tool', 'about'), modeBtn, menu));
  function buildMenu() {
    clear(menu);
    menu.append(h('div', { class: 'menu-label' }, 'Map layer'));
    for (const L of meta.layers) menu.append(h('button', { class: 'menu-item', type: 'button', role: 'menuitemradio', 'aria-checked': String(L.id === state.layerId), onClick: () => set({ layerId: L.id, overlay: null }) }, L.label_en, L.id === state.layerId ? icon('check') : null));
    menu.append(h('hr', { class: 'menu-sep' }), h('div', { class: 'menu-label' }, 'Background'),
      h('div', { class: 'seg' }, ['satellite', 'plain'].map((b) => h('button', { type: 'button', 'aria-pressed': String(state.basemap === b), onClick: () => set({ basemap: b }) }, b === 'satellite' ? 'Satellite' : 'Plain'))));
  }
  return { el, sync() {
    [...tabs.children].forEach((t, i) => t.setAttribute('aria-selected', String(i === state.dateIdx)));
    layersBtn.setAttribute('aria-expanded', String(state.overlay === 'layers'));
    menu.hidden = state.overlay !== 'layers'; if (!menu.hidden) buildMenu();
    if (modeBtn) { clear(modeBtn); modeBtn.append(icon('shield'), state.mode === 'agency' ? 'Agency' : 'Public'); modeBtn.setAttribute('aria-pressed', String(state.mode === 'agency')); }
    document.body.classList.toggle('has-overlay', ['alerts', 'about', 'subscribe', 'report', 'case'].includes(state.overlay));
  }, setCount(n) { badge.hidden = !n; badge.textContent = n > 99 ? '99+' : n; } };
}

export function legend(meta) {
  const el = h('aside', { class: 'legend panel', 'aria-label': 'Legend' });
  return { el, update(v) {
    clear(el);
    if (v.kind !== 'pixels') { el.hidden = true; return; }
    el.hidden = false;
    const L = v.layer;
    el.append(h('h2', { class: 'legend-title' }, L.legend_title_en));
    const body = h('div', { class: 'panel-body' }, h('ul', { class: 'legend-rows' }, L.classes.map((c, i) => h('li', { class: 'legend-row' }, h('span', { class: 'swatch', style: { background: c.color } }),
      h('span', { class: 'name' }, c.label_en, L.value_labels ? null : h('span', { class: 'range' }, c.min == null ? `under ${c.max}${L.unit ? ' ' + L.unit : ''}` : c.max == null ? `${c.min}${L.unit ? ' ' + L.unit : ''} or more` : `${c.min} to ${c.max}${L.unit ? ' ' + L.unit : ''}`)),
      h('span', { class: 'count' }, num(v.classCounts[i]))))));
    if (state.zoneId != null) {
      body.append(h('hr', { class: 'legend-sep' }), h('details', { class: 'types', open: !matchMedia('(max-width:760px)').matches }, h('summary', { class: 'types-title' }, meta.pixel_types_title),
        meta.pixel_types.map((n, i) => h('label', { class: 'type-row' }, h('input', { type: 'checkbox', checked: state.types[i], onChange: (e) => set({ types: { ...state.types, [i]: e.target.checked } }) }), h('span', { class: 'label' }, meta.pixel_types_short[i], h('span', null, n)), h('span', { class: 'count' }, num(v.typeCounts[i]))))));
    }
    body.append(h('p', { class: 'footnote' }, L.footnote_en));
    el.append(body);
  } };
}

const chips = { urban: 'Rain and drains', river: 'River overflow', dam: 'Dam spillage', coast: 'Sea and tide' };
const ACTION = ['No action needed. Keep drains clear.', 'Stay informed and clear gutters near your home.', 'Move valuables up. Know your route to high ground.', 'Prepare to leave. Keep away from rivers and drains. Follow NADMO instructions.', 'Move to high ground now if told to. Never cross moving water.'];

export function zonecard({ meta, districts, params, drivers }, cb) {
  const el = h('section', { class: 'zone-card panel' });
  const P = (i) => districts.features[i].properties;
  let query = '';
  function listView(v) {
    const input = h('input', { class: 'search', type: 'search', placeholder: 'Find your district', 'aria-label': 'Find your district', value: query, onInput: (e) => { query = e.target.value; paint(); } });
    const ul = h('ul', { class: 'zone-list' });
    function paint() {
      clear(ul);
      const q = query.trim().toLowerCase();
      const items = v.zoneStats.map((z, i) => ({ ...z, i })).filter((z) => !q || P(z.i).name.toLowerCase().includes(q) || P(z.i).region.toLowerCase().includes(q));
      items.sort((a, b) => b.rank - a.rank).slice(0, q ? 20 : (matchMedia('(max-width:760px)').matches ? 3 : 6)).forEach((z) => ul.append(h('li', null, h('button', { type: 'button', onClick: () => cb.onZone(z.i) }, h('span', { class: 'swatch', style: { background: z.color } }), h('span', null, P(z.i).name, h('small', { class: 'sub' }, P(z.i).region)), h('span', { class: 'val' }, z.text)))));
      if (!ul.children.length) ul.append(h('li', { class: 'empty' }, 'No district found.'));
    }
    paint();
    return [h('div', { class: 'panel-head' }, h('h2', { class: 'panel-title' }, 'All 260 districts'), h('span', { class: 'kpi' }, tool === 'flood' ? `${v.kpi} on warning` : `${v.kpi} high concern`)),
      h('div', { class: 'panel-body' }, h('p', { class: 'hint' }, tool === 'flood' ? 'Highest flood level first. Every district has its own limits.' : 'Highest concern first. Select a district for detail.'), input, ul,
        h('div', { class: 'btn-row' }, h('button', { class: 'btn grow primary', type: 'button', onClick: () => set({ overlay: 'subscribe' }) }, icon('send'), 'Get alerts'), tool === 'galamsey' ? h('button', { class: 'btn grow', type: 'button', onClick: () => set({ overlay: 'report' }) }, icon('flag'), 'Report safely') : null))];
  }
  function floodDetail(zi, v) {
    const p = params.items[zi];
    const z = drivers.zonesByDay[state.dateIdx][zi];
    const lvl = v.zoneStats[zi].level;
    const rows = [['Rain, next 24 h', `${z.rain24} mm`, `Warning at ${p.rain24[2]} mm`], ['Rain, 3 days', `${z.rain72} mm`, `Warning at ${Math.round(p.rain24[2] * 1.6)} mm`], ['Soil wetness', `${z.soil}%`, 'Wet ground counts rain higher']];
    if (p.q) rows.push([`${p.river} flow`, `${z.flow}× 2-yr flood`, `Warning at ${Math.round(p.q.q5).toLocaleString('en-GB')} m³/s`]);
    if (p.dam) { const dm = meta.dams.find((x) => x.id === p.dam); rows.push([dm.name, meta.dam_status[v.damStatus[p.dam]], dm.ref]); }
    if (p.wave) rows.push(['Wave height', `${drivers.wave[state.dateIdx]} m`, `Warning at ${p.wave[2]} m`]);
    return [
      h('div', { class: 'chip-row' }, p.mech.map((m) => h('span', { class: 'chip' }, chips[m]))),
      h('div', { class: 'level-banner', style: { '--c': v.zoneStats[zi].color } }, h('b', null, v.zoneStats[zi].text), h('span', null, ACTION[lvl])),
      h('table', { class: 'drivers' }, h('tbody', null, rows.map((r) => h('tr', null, h('th', null, r[0]), h('td', null, r[1], h('small', null, r[2])))))),
      h('p', { class: 'footnote' }, p.note ? `${p.note}. ` : '', p.status === 'regional default' ? `Limits use the ${p.belt} belt default.` : `Limits tuned for this district (factor ${p.drainage_factor}), awaiting calibration.`),
    ];
  }
  function galamseyDetail(zi, v) {
    const pr = meta.priority.find((p) => p.zone === zi);
    const intakes = meta.intakes.filter((x) => x.district === P(zi).name);
    return [
      pr ? h('div', { class: 'chip-row' }, h('span', { class: 'chip' }, icon('drop'), pr.river)) : h('p', { class: 'hint' }, 'Routine national screening. Not on the priority list.'),
      intakes.length ? h('p', { class: 'hint' }, 'Water intake here: ', intakes.map((x) => `${x.name} (${x.river})`).join(', ')) : null,
      state.mode === 'agency' ? h('p', { class: 'hint strong' }, v.caseCount ? `${v.caseCount} candidates to review. Select a marker on the map.` : 'No candidates here.') : h('p', { class: 'hint' }, 'Public view is deliberately coarse (5 km) to protect people and investigations.'),
    ];
  }
  function detail(zi, v) {
    const p = P(zi); const pr = meta.priority.find((x) => x.zone === zi); const L = v.layer;
    const s = v.sel;
    const total = v.classCounts ? v.classCounts.reduce((a, b) => a + b, 0) : 0;
    return [h('div', { class: 'panel-head zone-head-x' }, h('div', null, pr ? h('span', { class: 'code-pill' }, pr.code) : null, h('h2', { class: 'panel-title' }, p.name), h('p', { class: 'hint' }, `${p.region} Region`)), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to all districts', onClick: cb.onBack }, icon('close'))),
      h('div', { class: 'panel-body' },
        tool === 'flood' ? floodDetail(zi, v) : galamseyDetail(zi, v),
        v.kind === 'pixels' && s.n ? h('div', { class: 'stats' }, [['Lowest', s.min], ['Average', s.mean], ['Highest', s.max]].map(([n, x]) => h('div', { class: 'stat' }, h('b', null, fmtValue(L, x)), h('span', null, n)))) : null,
        v.kind === 'pixels' && total ? h('div', null, h('p', { class: 'share-label' }, 'Share of this district by level'), h('div', { class: 'share-bar' }, L.classes.map((c, i) => h('i', { style: { width: `${(100 * v.classCounts[i]) / total}%`, background: c.color } })))) : null,
        h('div', { class: 'btn-row' }, v.kind === 'pixels' ? h('button', { class: 'btn grow', type: 'button', 'aria-pressed': String(state.selecting), onClick: cb.onSelect }, icon('select'), 'Select area') : null,
          h('button', { class: 'btn grow primary', type: 'button', onClick: () => set({ overlay: 'subscribe' }) }, icon('send'), 'Get alerts')))];
  }
  return { el, update(v) { clear(el); el.append(...(state.zoneId == null ? listView(v) : detail(state.zoneId, v)).filter(Boolean)); } };
}

export function tablePanel(meta, districtsName) {
  const el = h('section', { class: 'closures panel', hidden: true });
  return { el, update(v) {
    if (v.kind !== 'table') { el.hidden = true; return; }
    clear(el); el.hidden = false;
    const flood = tool === 'flood';
    const rows = flood ? meta.dams : meta.intakes;
    const labels = flood ? meta.dam_status : meta.intake_status;
    const key = (r) => (flood ? r.id : r.name);
    const color = (s) => (flood ? { normal: '#34d058', watch: '#facc15', notice: '#f59e0b', spilling: '#f97316', major: '#ef4444' }[s] : ['#34d058', '#facc15', '#f59e0b', '#ef4444'][s]);
    el.append(h('div', { class: 'panel-head' }, h('h2', { class: 'panel-title' }, v.layer.label_en)), h('div', { class: 'panel-body' },
      h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, flood ? 'Dam' : 'Intake'), meta.dates.map((d, i) => h('th', { class: i === state.dateIdx ? 'today' : '' }, fmtDate(d, { day: 'numeric', month: 'short' }))))),
        h('tbody', null, rows.map((r) => h('tr', null, h('td', null, r.name, h('small', { class: 'sub' }, flood ? r.ref : `${r.river} River`)), v.days.map((d, i) => { const s = d.status[key(r)]; return h('td', { class: i === state.dateIdx ? 'today' : '' }, h('span', { class: 'stat-dot', style: { background: color(s) }, title: labels[s] })); }))))),
      h('div', { class: 'table-key' }, (flood ? Object.keys(labels) : labels.map((_, i) => i)).map((k) => h('span', null, h('i', { class: 'stat-dot', style: { background: color(k) } }), labels[k]))),
      h('p', { class: 'footnote' }, v.layer.footnote_en)));
  } };
}

export function overlays({ meta, districts, params, candidates }, cb) {
  const el = h('aside', { class: 'overlay panel', hidden: true });
  let alerts = []; let selectedDistrict = null;
  const close = () => set({ overlay: null });
  const head = (t) => h('div', { class: 'panel-head' }, h('h2', { class: 'panel-title', tabindex: '-1' }, t), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onClick: close }, icon('close')));
  const names = districts.features.map((f) => f.properties.name);
  const districtSelect = (id) => h('select', { id, class: 'field' }, names.map((n, i) => h('option', { value: i, selected: i === (state.zoneId ?? selectedDistrict ?? names.indexOf(tool === 'flood' ? 'Accra Metropolis' : 'Amansie Central')) }, n)));
  const views = {
    alerts: () => [head('Alerts'), h('div', { class: 'panel-body' }, alerts.length ? alerts.slice(0, 40).map((a) => h('article', { class: 'alert-card', style: { '--c': a.color } }, h('div', { class: 'alert-top' }, h('span', { class: 'pill' }, a.level), a.name), h('p', null, a.text), h('button', { class: 'btn', type: 'button', onClick: () => cb.onViewZone(a.zone, a.dateIdx) }, 'View on map'))) : h('p', { class: 'empty' }, 'No alerts.'), h('p', { class: 'footnote' }, 'Alerts are worked out from the sample data shown.'))],
    subscribe: () => {
      const dist = districtSelect('sub-d'); const out = h('div', { class: 'sms' }); let ch = 'SMS';
      const seg = h('div', { class: 'seg flat' }, ['SMS', 'WhatsApp', 'Voice call', 'App'].map((c) => h('button', { type: 'button', 'aria-pressed': String(c === ch), onClick: (e) => { ch = c; [...seg.children].forEach((b) => b.setAttribute('aria-pressed', String(b === e.target))); paint(); } }, c)));
      const paint = () => { const n = names[+dist.value]; const a = alerts.find((x) => x.zone === +dist.value); clear(out); out.append(h('small', null, `${ch} preview`), h('p', null, tool === 'flood' ? (a ? `FloodWatch: ${a.level} for ${n}. ${a.sms} Follow NADMO. Sample message.` : `FloodWatch: no flood alert for ${n} now. Sample message.`) : (a ? `GalamseyWatch: new land disturbance signal in ${n}. Check drinking water sources. Do not approach sites. Sample message.` : `GalamseyWatch: no new signal for ${n} in the latest pass. Sample message.`))); };
      dist.addEventListener('change', paint); paint();
      return [head('Get alerts for your area'), h('div', { class: 'panel-body form' }, h('label', { for: 'sub-d' }, 'District'), dist, h('label', null, 'How to reach you'), seg, out, h('p', { class: 'footnote' }, 'Preview only. No number is collected and nothing is sent. Live alerts would carry official NADMO, GMet or EPA sign-off. Twi, Ewe, Ga, Dagbani and Hausa versions are planned with human translators.'))];
    },
    report: () => {
      const dist = districtSelect('rep-d'); const done = h('p', { class: 'hint strong', hidden: true }, 'Demo only: nothing was stored or sent.');
      return [head('Report safely'), h('div', { class: 'panel-body form' }, h('p', { class: 'warn' }, 'Your safety comes first. Do not go near a site, confront anyone or take photos if it puts you at risk.'), h('label', { for: 'rep-d' }, 'District'), dist, h('label', { for: 'rep-w' }, 'What did you notice?'), h('select', { id: 'rep-w', class: 'field' }, ['Muddy or changed river', 'Excavators or pits', 'Forest being cleared', 'Fish or animals dying', 'Other'].map((o) => h('option', null, o))), h('label', { for: 'rep-n' }, 'Details, without names'), h('textarea', { id: 'rep-n', class: 'field', rows: 3 }), h('button', { class: 'btn primary', type: 'button', onClick: () => { done.hidden = false; } }, 'Send anonymously'), done, h('p', { class: 'footnote' }, 'A live version would strip phone metadata and keep reporter details apart from map evidence. Reports add to satellite checks and are never published as allegations.'))];
    },
    case: () => {
      const c = candidates.items.find((x) => x.id === state.caseId); if (!c) return [head('Case')];
      const line = (vals, col, lab) => { const min = Math.min(...vals), max = Math.max(...vals); const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(' '); const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 100 30'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'spark'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); p.setAttribute('points', pts); p.setAttribute('fill', 'none'); p.setAttribute('stroke', col); p.setAttribute('stroke-width', '1.6'); p.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(p); return h('div', { class: 'spark-row' }, h('span', null, lab), svg); };
      const stat = h('b', null, c.status);
      return [head(c.id), h('div', { class: 'panel-body' }, h('p', { class: 'warn' }, 'Synthetic record. This point does not mark a real site.'),
        h('div', { class: 'stats' }, [['Evidence score', `${c.score}%`], ['Uncertainty', `±${c.uncertainty}`], ['Area', `${c.area_ha} ha`]].map(([a, b]) => h('div', { class: 'stat' }, h('b', null, b), h('span', null, a)))),
        h('dl', { class: 'facts' }, [['District', c.district], ['River system', c.river], ['First seen', fmtDate(c.first_seen, { day: 'numeric', month: 'short', year: 'numeric' })], ['Sensors', c.sensors], ['To nearest water', `${c.dist_water_km} km`], ['Licence check', c.licence], ['Forest reserve', c.forest], ['Status', stat]].map(([a, b]) => [h('dt', null, a), h('dd', null, b)])),
        h('h3', { class: 'sub-h' }, 'Signal over the last 12 passes'), line(c.series.ndvi, '#4ade80', 'Greenness'), line(c.series.bare, '#fbbf24', 'Bare soil'), line(c.series.vh, '#60a5fa', 'Radar'),
        h('div', { class: 'btn-row' }, ['Send field team', 'Confirm', 'Dismiss'].map((a) => h('button', { class: 'btn grow', type: 'button', onClick: () => { c.status = { 'Send field team': 'Field team sent', Confirm: 'Confirmed', Dismiss: 'Dismissed' }[a]; stat.textContent = c.status; cb.onCaseChange(); } }, a))),
        h('p', { class: 'footnote' }, 'A live agency view would sit behind sign-in with an audit trail. Changes here last for this session only.'))];
    },
    about: () => [head(tool === 'flood' ? 'About FloodWatch' : 'About GalamseyWatch'), h('div', { class: 'panel-body about' }, ...(tool === 'flood' ? [
      h('p', null, 'FloodWatch judges all 260 districts against their own limits, then explains which driver is responsible: rain and drains, river overflow, dam spillage, or sea and tide.'),
      h('h3', null, 'What is real here'), h('ul', null, h('li', null, 'District boundaries and the list of flood-prone places.'), h('li', null, 'Published reference levels for Bagre and Akosombo.'), h('li', null, 'The rule engine that produces the alert.')),
      h('h3', null, 'What is not real yet'), h('ul', null, h('li', null, 'Every value and alert on the map.'), h('li', null, 'District limits, until calibrated against past floods with NADMO, GMet and Hydro.')),
      h('p', null, 'The repository includes a script that replaces samples with open GloFAS and rainfall forecasts.'),
    ] : [
      h('p', null, 'GalamseyWatch looks for new land disturbance and muddy rivers using free radar and optical satellites, then routes each signal to a person to check.'),
      h('h3', null, 'How often can it see?'), h('p', null, 'Each new satellite image is processed after it arrives, which gives near-real-time alerts, not a live video. Radar works through cloud.'),
      h('h3', null, 'What a signal means'), h('p', null, 'A signal means the ground has changed in a way that looks like mining. Satellites cannot tell legal from illegal. That takes licence records and field checks.'),
      h('h3', null, 'Public and agency views'), h('p', null, 'The public sees coarse 5 km patterns. Agencies see 1.5 km detail and individual cases. This prototype has no sign-in, so the agency view holds invented records only.'),
      h('h3', null, 'What is not real yet'), h('p', null, 'All scores, dates, cases and water-intake statuses are synthetic.'),
    ]), h('p', { class: 'footnote' }, 'Boundaries: geoBoundaries, Ghana Statistical Service, CC BY 4.0.'))],
  };
  return { el, update() {
    const o = state.overlay;
    if (!views[o]) { el.hidden = true; return; }
    if (state.zoneId != null) selectedDistrict = state.zoneId;
    clear(el); el.hidden = false; el.append(...views[o]());
  }, setAlerts(a) { alerts = a; if (state.overlay === 'alerts') this.update(); } };
}

export function trend() {
  const el = h('div', { class: 'trend panel', hidden: true, role: 'dialog' });
  const hide = () => { el.hidden = true; clear(el); };
  function chart(L, dates, values) {
    const S = 'http://www.w3.org/2000/svg'; const s = (t, a) => { const e = document.createElementNS(S, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
    const W = 360, H = 170, l = 26, r = 26, top = 30, bot = 34; const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const x = (i) => l + (i * (W - l - r)) / (values.length - 1); const y = (v) => top + ((max - v) / span) * (H - top - bot);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    svg.append(s('polyline', { points: values.map((v, i) => `${x(i)},${y(v)}`).join(' '), fill: 'none', stroke: '#fff', 'stroke-width': 2 }));
    values.forEach((v, i) => { svg.append(s('circle', { cx: x(i), cy: y(v), r: 4.5, fill: '#fff', stroke: '#0f1a28', 'stroke-width': 2 }));
      const a = i === 0 ? 'start' : i === values.length - 1 ? 'end' : 'middle';
      const t = s('text', { x: x(i), y: y(v) - 10, 'text-anchor': a, fill: '#eaf0f8', 'font-size': 11, 'font-weight': 600 }); t.textContent = fmtValue({ ...L, value_labels: null, decimals: L.value_labels ? 1 : L.decimals }, v); svg.append(t);
      const d = s('text', { x: x(i), y: H - 12, 'text-anchor': 'middle', fill: '#a4b5ca', 'font-size': 11 }); d.textContent = fmtDate(dates[i]); svg.append(d); });
    return svg;
  }
  function show({ layer, dates, values, n, rect }) {
    clear(el); el.hidden = false;
    el.append(h('div', { class: 'panel-head' }, h('h2', { class: 'panel-title' }, `${layer.label_en} trend`), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onClick: hide }, icon('close'))),
      h('div', { class: 'panel-body' }, n ? [h('p', { class: 'hint' }, `${num(n)} cells selected`), chart(layer, dates, values)] : h('p', { class: 'empty' }, 'No cells in that box.')));
    const w = el.offsetWidth, ht = el.offsetHeight; let left = Math.max(12, Math.min(rect.x + rect.w / 2 - w / 2, innerWidth - w - 12)); let top = rect.y - ht - 10; if (top < 70) top = rect.y + rect.h + 10;
    el.style.left = `${left}px`; el.style.top = `${Math.max(70, Math.min(top, innerHeight - ht - 12))}px`;
  }
  return { el, show, hide, isOpen: () => !el.hidden };
}

export function tooltip() {
  const el = h('div', { class: 'tip', hidden: true });
  return { el, show(a, b, x, y) { clear(el); el.append(h('b', null, a), b ? h('small', null, b) : null); el.hidden = false; el.style.left = `${Math.min(x + 14, innerWidth - el.offsetWidth - 8)}px`; el.style.top = `${Math.max(8, y - 44)}px`; }, hide() { el.hidden = true; } };
}
