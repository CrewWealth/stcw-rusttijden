// Draaien met:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyse, addDays, workPeriodsText } from '../js/rules.js';

// Maakt een dag van 48 vakjes met werk in de opgegeven uren, bijv. [[0, 4], [12, 16]]
function day(work) {
  const s = new Array(48).fill(0);
  for (const [a, b] of work) for (let i = a * 2; i < b * 2; i++) s[i] = 1;
  return s;
}

function fill(start, n, work) {
  const days = {};
  for (let i = 0; i < n; i++) days[addDays(start, i)] = day(work);
  return days;
}

test('wacht 00-04 / 12-16 is in orde', () => {
  const r = analyse(fill('2026-10-01', 14, [[0, 4], [12, 16]]), '2026-10-08', '2026-10-14');
  for (const d of Object.values(r)) {
    assert.equal(d.status, 'groen');
    assert.equal(d.restDay, 16);
    assert.equal(d.rest7, 112);
  }
});

test('dagwerker 08-12 / 13-17: lunchpauze geeft geen fout over rustblokken', () => {
  const r = analyse(fill('2026-10-01', 14, [[8, 12], [13, 17]]), '2026-10-08', '2026-10-14');
  for (const d of Object.values(r)) assert.equal(d.status, 'groen', JSON.stringify(d.issues));
});

test('16 uur werken (06-22) geeft te weinig rust en te lang doorwerken', () => {
  const days = fill('2026-10-01', 7, [[0, 4], [12, 16]]);
  days['2026-10-08'] = day([[6, 22]]);
  const r = analyse(days, '2026-10-08', '2026-10-08')['2026-10-08'];
  assert.equal(r.status, 'rood');
  assert.ok(r.issues.some(i => i.rule === 'rest24h'));
  assert.ok(r.issues.some(i => i.rule === 'work'));
});

test('genoeg uren maar in 3 korte blokken is niet toegestaan', () => {
  // rust 00-04, 08-12, 16-20 (12 u totaal), maar langste blok 4 u
  const pattern = [[4, 8], [12, 16], [20, 24]];
  const r = analyse(fill('2026-10-01', 8, pattern), '2026-10-08', '2026-10-08')['2026-10-08'];
  assert.ok(r.issues.some(i => i.rule === 'periods'));
});

test('77 uur per week: elke dag 13 u werk is te veel', () => {
  // 11 u rust per dag = 77 u per week: precies op de grens, dus nog net goed
  const ok = analyse(fill('2026-10-01', 8, [[6, 19]]), '2026-10-08', '2026-10-08')['2026-10-08'];
  assert.ok(!ok.issues.some(i => i.rule === 'rest7d'));
  // 10,5 u rust per dag = 73,5 u per week: te weinig
  const bad = analyse(fill('2026-10-01', 8, [[6, 19.5]]), '2026-10-08', '2026-10-08')['2026-10-08'];
  assert.ok(bad.issues.some(i => i.rule === 'rest7d'));
});

test('niet-ingevulde dagen geven geen valse waarschuwingen', () => {
  const r = analyse({ '2026-10-08': day([[0, 4], [12, 16]]) }, '2026-10-07', '2026-10-09');
  assert.equal(r['2026-10-07'].status, 'leeg');
  assert.equal(r['2026-10-08'].status, 'groen');
  assert.equal(r['2026-10-08'].rest7, null);
});

test('5/3-wachten: alle drie de ploegen zijn in orde', async () => {
  const { TEMPLATES, templateSlots } = await import('../js/templates.js');
  for (const t of TEMPLATES.filter(t => t.id.startsWith('v53'))) {
    const days = {};
    for (let i = 0; i < 14; i++) days[addDays('2026-10-01', i)] = templateSlots(t);
    for (const [iso, d] of Object.entries(analyse(days, '2026-10-08', '2026-10-14'))) {
      assert.equal(d.status, 'groen', `${t.name} op ${iso}: ${d.issues.map(x => x.text).join(' ')}`);
      assert.equal(d.restDay, 16);
    }
  }
});

test('werkperiodes als tekst', () => {
  assert.equal(workPeriodsText(day([[0, 4], [12, 16]])), '00:00-04:00 12:00-16:00');
  assert.equal(workPeriodsText(day([[20, 24]])), '20:00-24:00');
});
