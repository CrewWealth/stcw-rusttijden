// De schermen van de app. Alle rekenwerk zit in rules.js; dit bestand tekent alleen en verwerkt invoer.

import { analyse, addDays, daysBetween, fmt, workPeriodsText, RULES, MARGIN } from './rules.js';
import { TEMPLATES, templateSlots } from './templates.js';
import * as store from './storage.js';

const state = store.load();
const view = document.getElementById('view');
const printArea = document.getElementById('print-area');

const DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const STATUS_TEXT = { groen: 'In orde', oranje: 'Krap', rood: 'Overtreding', leeg: 'Niet ingevuld' };

const pad = n => String(n).padStart(2, '0');
const localIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => localIso(new Date());
const dateOf = iso => new Date(iso + 'T00:00:00Z');
const mondayOf = iso => addDays(iso, -((dateOf(iso).getUTCDay() + 6) % 7));
const shortDate = iso => `${DAYS[dateOf(iso).getUTCDay()]} ${dateOf(iso).getUTCDate()} ${MONTHS[dateOf(iso).getUTCMonth()].slice(0, 3)}`;

function isoWeek(iso) {
  const d = dateOf(iso);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

// klein hulpje om HTML-elementen te maken: h('div', {class: 'x'}, 'tekst', kind, ...)
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

const getDay = iso => (state.days[iso] ? store.unpack(state.days[iso]) : null);
function setDay(iso, slots) {
  if (slots) state.days[iso] = store.pack(slots);
  else delete state.days[iso];
  store.save(state);
}

let tab = 'week';
let weekStart = mondayOf(today());

function render() {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('subtitle').textContent = [state.profile.rank, state.profile.ship].filter(Boolean).join(' · ') || 'STCW / MLC';
  view.replaceChildren(({ week: weekView, rooster: rosterView, export: exportView, profiel: profileView })[tab]());
}

// ---------- rust tot nu toe (rollend, vanaf dit moment terug) ----------

function restBackFromNow(hours) {
  const now = new Date();
  let iso = today(), slot = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);
  let rest = 0;
  for (let n = 0; n < hours * 2; n++) {
    slot--;
    if (slot < 0) { iso = addDays(iso, -1); slot = 47; }
    const d = getDay(iso);
    if (!d) return null;
    if (d[slot] === 0) rest++;
  }
  return rest / 2;
}

// ---------- week ----------

function weekView() {
  const end = addDays(weekStart, 6);
  const res = analyse(store.daysAsSlots(state), weekStart, end);
  const r24 = restBackFromNow(24), r7 = restBackFromNow(168);
  const todayRes = analyse(store.daysAsSlots(state), today(), today())[today()];

  const card = (label, value, cls) => h('div', { class: `card ${cls || ''}` }, h('div', { class: 'card-label' }, label), h('div', { class: 'card-value' }, value));
  const cls24 = r24 == null ? '' : r24 < RULES.minRest24h ? 'rood' : r24 < MARGIN.rest24h ? 'oranje' : 'groen';
  const cls7 = r7 == null ? '' : r7 < RULES.minRest7d ? 'rood' : r7 < MARGIN.rest7d ? 'oranje' : 'groen';

  const wrap = h('section', {},
    h('div', { class: 'cards' },
      card('Rust afgelopen 24 u', r24 == null ? '–' : `${fmt(r24)} u`, cls24),
      card('Rust afgelopen 7 d', r7 == null ? '–' : `${fmt(r7)} u`, cls7),
      card('Vandaag', STATUS_TEXT[todayRes.status], todayRes.status),
    ),
    h('div', { class: 'week-nav' },
      h('button', { class: 'icon', 'aria-label': 'Vorige week', onclick: () => { weekStart = addDays(weekStart, -7); render(); } }, '‹'),
      h('div', { class: 'week-title' }, h('strong', {}, `Week ${isoWeek(weekStart)}`), ` · ${shortDate(weekStart)} – ${shortDate(end)}`),
      h('button', { class: 'icon', 'aria-label': 'Volgende week', onclick: () => { weekStart = addDays(weekStart, 7); render(); } }, '›'),
    ),
    h('div', { class: 'ruler' }, ...['00', '06', '12', '18', '24'].map((t, i) => h('span', { style: `left:${i * 25}%` }, t))),
  );

  for (let i = 0; i < 7; i++) {
    const iso = addDays(weekStart, i), r = res[iso], slots = getDay(iso);
    const select = h('select', { class: 'day-menu', 'aria-label': `Opties voor ${shortDate(iso)}`, onchange: e => dayAction(iso, e.target.value) },
      h('option', { value: '' }, '⋯'),
      ...TEMPLATES.map(t => h('option', { value: `t:${t.id}` }, t.name)),
      h('option', { value: 'copy' }, 'Kopieer vorige dag'),
      h('option', { value: 'clear' }, 'Leegmaken'),
    );
    wrap.append(h('div', { class: `day ${iso === today() ? 'is-today' : ''}` },
      h('div', { class: 'day-head' },
        h('span', { class: 'day-name' }, shortDate(iso)),
        h('span', { class: `chip ${r.status}` }, r.status === 'leeg' ? 'leeg' : `${fmt(r.restDay)} u rust`),
        select,
      ),
      dayBar(iso, slots),
      r.issues.length ? h('ul', { class: 'issues' }, r.issues.map(x => h('li', {}, x.text))) : null,
    ));
  }
  wrap.append(h('p', { class: 'hint' }, 'Sleep over een balk om werk (oranje) of rust (blauw) in te tekenen. Elk vakje is een half uur.'));
  return wrap;
}

function dayAction(iso, action) {
  if (action.startsWith('t:')) setDay(iso, templateSlots(TEMPLATES.find(t => `t:${t.id}` === action)));
  else if (action === 'copy') { const prev = getDay(addDays(iso, -1)); if (prev) setDay(iso, prev); }
  else if (action === 'clear') setDay(iso, null);
  render();
}

// Balk van 48 vakjes waarop je met vinger of muis werk/rust tekent.
function dayBar(iso, slots) {
  const bar = h('div', { class: `bar ${slots ? '' : 'empty'}`, role: 'group', 'aria-label': `Uren van ${shortDate(iso)}` });
  const cells = [];
  for (let i = 0; i < 48; i++) {
    const c = h('span', { class: `cell ${slots && slots[i] ? 'work' : ''} ${i % 12 === 0 ? 'tick' : ''}` });
    cells.push(c); bar.append(c);
  }
  if (!slots) bar.append(h('span', { class: 'bar-empty' }, 'Tik of sleep om in te vullen'));

  let paint = null, lastIdx = -1, current = slots ? [...slots] : null;
  const idxAt = e => {
    const r = bar.getBoundingClientRect();
    return Math.max(0, Math.min(47, Math.floor(((e.clientX - r.left) / r.width) * 48)));
  };
  const apply = idx => {
    const [a, b] = lastIdx < 0 ? [idx, idx] : [Math.min(lastIdx, idx), Math.max(lastIdx, idx)];
    for (let i = a; i <= b; i++) { current[i] = paint; cells[i].classList.toggle('work', paint === 1); }
    lastIdx = idx;
  };
  bar.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!current) { current = new Array(48).fill(0); bar.classList.remove('empty'); bar.querySelector('.bar-empty')?.remove(); }
    const idx = idxAt(e);
    paint = current[idx] ? 0 : 1;
    lastIdx = -1; apply(idx);
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', e => { if (paint !== null) apply(idxAt(e)); });
  const finish = () => { if (paint === null) return; paint = null; setDay(iso, current); render(); };
  bar.addEventListener('pointerup', finish);
  bar.addEventListener('pointercancel', finish);
  return bar;
}

// ---------- rooster ----------

function rosterView() {
  let chosen = TEMPLATES[0].id;
  const from = h('input', { type: 'date', value: today() });
  const to = h('input', { type: 'date', value: addDays(today(), 27) });
  const list = h('div', { class: 'templates' }, TEMPLATES.map(t => {
    const preview = h('div', { class: 'bar mini' }, templateSlots(t).map(v => h('span', { class: `cell ${v ? 'work' : ''}` })));
    return h('label', { class: 'template' },
      h('input', { type: 'radio', name: 'tpl', value: t.id, checked: t.id === chosen, onchange: () => { chosen = t.id; } }),
      h('span', { class: 'template-name' }, t.name), preview);
  }));
  const msg = h('p', { class: 'hint' });
  const applyBtn = h('button', { class: 'primary', onclick: () => {
    const a = from.value, b = to.value;
    if (!a || !b || daysBetween(a, b) < 0) { msg.textContent = 'Kies een geldige periode.'; return; }
    const n = daysBetween(a, b) + 1;
    let filled = 0;
    for (let i = 0; i < n; i++) if (state.days[addDays(a, i)]) filled++;
    if (filled && !confirm(`${filled} van de ${n} dagen zijn al ingevuld en worden overschreven. Doorgaan?`)) return;
    const slots = templateSlots(TEMPLATES.find(t => t.id === chosen));
    for (let i = 0; i < n; i++) state.days[addDays(a, i)] = store.pack(slots);
    store.save(state);
    msg.textContent = `✓ ${n} dagen ingevuld. Afwijkingen (drills, overwerk) teken je daarna per dag in bij Week.`;
  } }, 'Rooster toepassen');

  return h('section', {},
    h('h2', {}, 'Wachtrooster'),
    h('p', { class: 'hint' }, 'Kies je wacht en de periode. Daarna pas je losse dagen aan in het weekoverzicht.'),
    list,
    h('div', { class: 'row' }, h('label', {}, 'Van', from), h('label', {}, 'Tot en met', to)),
    applyBtn, msg,
    h('div', { class: 'rules' },
      h('h3', {}, 'Wat de app controleert'),
      h('ul', {},
        h('li', {}, `Minimaal ${RULES.minRest24h} uur rust in elke periode van 24 uur`),
        h('li', {}, `Minimaal ${RULES.minRest7d} uur rust in elke periode van 7 dagen`),
        h('li', {}, `Rust in hoogstens ${RULES.maxRestPeriods} blokken, waarvan één van minstens ${RULES.minLongestPeriod} uur`),
        h('li', {}, `Hoogstens ${RULES.maxWorkStretch} uur tussen twee rustperiodes`),
      ),
      h('p', { class: 'hint' }, 'Bron: STCW Code A-VIII/1 en MLC 2006 norm A2.3. Oranje = toegestaan maar krap (onder 11 u per 24 u of 80 u per week).'),
    ),
  );
}

// ---------- export ----------

function exportView() {
  const now = new Date();
  const month = h('input', { type: 'month', value: `${now.getFullYear()}-${pad(now.getMonth() + 1)}` });
  const preview = h('div', { class: 'table-scroll' });
  const update = () => { preview.replaceChildren(monthTable(month.value)); };
  month.addEventListener('change', update);
  update();
  const missing = ['name', 'ship', 'imo', 'flag'].filter(k => !state.profile[k]);
  return h('section', {},
    h('h2', {}, 'Export voor inspectie'),
    h('p', { class: 'hint' }, 'Maandoverzicht in de opzet van het IMO/ILO-register van rusturen. Laat het tekenen door jezelf en de kapitein.'),
    missing.length ? h('p', { class: 'warn' }, 'Vul eerst je gegevens in bij Profiel (naam, schip, IMO-nummer, vlag).') : null,
    h('div', { class: 'row' }, h('label', {}, 'Maand', month)),
    h('div', { class: 'row buttons' },
      h('button', { class: 'primary', onclick: () => { printArea.replaceChildren(monthTable(month.value, true)); window.print(); } }, 'Print / bewaar als PDF'),
      h('button', { onclick: () => downloadCsv(month.value) }, 'CSV downloaden'),
    ),
    preview,
  );
}

function monthDays(ym) {
  const [y, m] = ym.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${ym}-${pad(i + 1)}`);
}

function monthTable(ym, forPrint = false) {
  const days = monthDays(ym);
  const res = analyse(store.daysAsSlots(state), days[0], days[days.length - 1]);
  const [y, m] = ym.split('-').map(Number);
  const p = state.profile;
  const head = h('div', { class: 'reg-head' },
    h('h1', {}, 'Register van rusturen · Record of hours of rest'),
    h('div', { class: 'reg-fields' },
      ...[['Schip / Ship', p.ship], ['IMO', p.imo], ['Vlag / Flag', p.flag], ['Naam / Name', p.name], ['Functie / Rank', p.rank], ['Maand / Month', `${MONTHS[m - 1]} ${y}`]]
        .map(([k, v]) => h('div', {}, h('span', {}, k), h('strong', {}, v || '—'))),
    ),
  );
  const table = h('table', { class: 'register' });
  const hr = h('tr', {}, h('th', {}, 'Datum'));
  for (let hh = 0; hh < 24; hh++) hr.append(h('th', { colspan: 2, class: 'hr' }, pad(hh)));
  hr.append(h('th', {}, 'Rust 24 u'), h('th', {}, 'Rust 7 d'), h('th', {}, 'OK'), h('th', {}, 'Opmerkingen / Remarks'));
  table.append(h('thead', {}, hr));
  const body = h('tbody');
  for (const iso of days) {
    const slots = getDay(iso), r = res[iso];
    const tr = h('tr', { class: r.status }, h('td', { class: 'date' }, shortDate(iso)));
    for (let i = 0; i < 48; i++) tr.append(h('td', { class: `s ${slots ? (slots[i] ? 'work' : 'rest') : 'none'}` }));
    tr.append(
      h('td', { class: 'num' }, slots ? fmt(r.restDay) : ''),
      h('td', { class: 'num' }, r.rest7 != null ? fmt(r.rest7) : ''),
      h('td', { class: 'ok' }, r.status === 'leeg' ? '' : r.status === 'rood' ? '✗' : '✓'),
      h('td', { class: 'rem' }, r.issues.map(x => x.text).join(' ')),
    );
    body.append(tr);
  }
  table.append(body);
  const legend = h('p', { class: 'reg-legend' }, 'Gekleurd vakje = werk (hours of work), leeg vakje = rust (hours of rest). Elk vakje is 30 minuten. Gecontroleerd volgens STCW A-VIII/1 en MLC 2006.');
  const sign = forPrint ? h('div', { class: 'sign' },
    h('div', {}, 'Handtekening zeevarende / Seafarer'), h('div', {}, 'Handtekening kapitein of gemachtigde / Master or authorised person')) : null;
  return h('div', { class: 'register-wrap' }, head, table, legend, sign);
}

function downloadCsv(ym) {
  const days = monthDays(ym);
  const res = analyse(store.daysAsSlots(state), days[0], days[days.length - 1]);
  const rows = [['datum', 'rust_dag_u', 'rust_7_dagen_u', 'laagste_rust_24u', 'status', 'werkperiodes', 'opmerkingen']];
  for (const iso of days) {
    const r = res[iso], s = getDay(iso);
    rows.push([iso, s ? fmt(r.restDay) : '', r.rest7 != null ? fmt(r.rest7) : '', r.min24 != null ? fmt(r.min24) : '',
      STATUS_TEXT[r.status], s ? workPeriodsText(s) : '', r.issues.map(x => x.text).join(' ')]);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(new Blob(['﻿' + csv], { type: 'text/csv' }), `rusturen-${ym}.csv`);
}

function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- profiel ----------

function profileView() {
  const field = (key, label, attrs = {}) => h('label', {}, label,
    h('input', { value: state.profile[key] || '', ...attrs, oninput: e => { state.profile[key] = e.target.value; store.save(state); } }));
  const file = h('input', { type: 'file', accept: 'application/json', class: 'hidden', onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = store.importBackup(await f.text());
      if (!confirm(`Back-up met ${Object.keys(data.days).length} dagen terugzetten? Je huidige gegevens worden vervangen.`)) return;
      Object.assign(state, data); store.save(state); render();
    } catch (err) { alert(err.message); }
  } });
  return h('section', {},
    h('h2', {}, 'Profiel'),
    h('p', { class: 'hint' }, 'Deze gegevens komen bovenaan je export.'),
    field('name', 'Naam'), field('rank', 'Functie'), field('ship', 'Schip'),
    field('imo', 'IMO-nummer', { inputmode: 'numeric' }), field('flag', 'Vlag'),
    h('h3', {}, 'Gegevens'),
    h('p', { class: 'hint' }, `${Object.keys(state.days).length} dagen ingevuld. Alles staat alleen op dit toestel: maak af en toe een back-up.`),
    h('div', { class: 'row buttons' },
      h('button', { onclick: () => download(store.exportBackup(state), `rusttijden-backup-${today()}.json`) }, 'Back-up downloaden'),
      h('button', { onclick: () => file.click() }, 'Back-up terugzetten'), file,
    ),
    h('button', { class: 'danger', onclick: () => {
      if (confirm('Alle ingevulde dagen wissen? Dit kan niet ongedaan worden gemaakt.')) { state.days = {}; store.save(state); render(); }
    } }, 'Alle dagen wissen'),
  );
}

// ---------- start ----------

document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
render();
setInterval(() => { if (tab === 'week' && !document.querySelector('.bar:active')) render(); }, 5 * 60 * 1000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
