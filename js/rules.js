// Rekenregels voor rusttijden volgens STCW Code A-VIII/1 en MLC 2006 (norm A2.3).
//
// Een dag bestaat uit 48 vakjes van een half uur: 0 = rust, 1 = werk.
// Dagen zonder invoer tellen niet mee: een controlevenster dat zo'n dag raakt slaan we over,
// zodat je geen valse waarschuwingen krijgt voor dagen die je nog niet hebt ingevuld.

export const SLOTS_PER_DAY = 48;
export const SLOT_HOURS = 0.5;

export const RULES = {
  minRest24h: 10, // uur rust in elke periode van 24 uur
  minRest7d: 77, // uur rust in elke periode van 7 dagen
  maxRestPeriods: 2, // die 10 uur mag in hoogstens 2 blokken...
  minLongestPeriod: 6, // ...waarvan één blok minstens 6 uur
  maxWorkStretch: 14, // hoogstens 14 uur tussen twee rustperiodes
};

// Onder deze grenzen is het nog toegestaan, maar krap: dan kleurt de dag oranje.
export const MARGIN = { rest24h: 11, rest7d: 80 };

const DAY = SLOTS_PER_DAY;
const WEEK = 7 * DAY;

// ---------- datums (altijd in UTC rekenen, dan heeft zomertijd geen invloed) ----------

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000);
}

export function slotToTime(slot) {
  const s = ((slot % DAY) + DAY) % DAY;
  return `${String(Math.floor(s / 2)).padStart(2, '0')}:${s % 2 ? '30' : '00'}`;
}

// "00:00-04:00 12:00-16:00" voor de werkblokken van één dag
export function workPeriodsText(slots) {
  const parts = [];
  for (let i = 0; i < DAY; i++) {
    if (slots[i] === 1 && (i === 0 || slots[i - 1] !== 1)) {
      let j = i;
      while (j < DAY && slots[j] === 1) j++;
      parts.push(`${slotToTime(i)}-${j === DAY ? '24:00' : slotToTime(j)}`);
    }
  }
  return parts.join(' ');
}

// ---------- analyse ----------

/**
 * Controleert alle dagen van `fromIso` t/m `toIso`.
 * @param {Record<string, number[]>} days  datum (YYYY-MM-DD) -> 48 vakjes (0 rust / 1 werk)
 * @returns {Record<string, DayResult>}
 */
export function analyse(days, fromIso, toIso) {
  // Tijdlijn van 7 dagen vóór tot 1 dag ná de periode, zodat rollende vensters
  // over middernacht en over de week heen kunnen kijken. -1 = niet ingevuld.
  const start = addDays(fromIso, -7);
  const nDays = daysBetween(start, toIso) + 2;
  const line = new Int8Array(nDays * DAY).fill(-1);
  for (let d = 0; d < nDays; d++) {
    const slots = days[addDays(start, d)];
    if (slots) for (let i = 0; i < DAY; i++) line[d * DAY + i] = slots[i] ? 1 : 0;
  }

  // Prefix-sommen: rust en "niet ingevuld" in elk venster in één stap optellen.
  const rest = new Int32Array(line.length + 1);
  const unknown = new Int32Array(line.length + 1);
  for (let i = 0; i < line.length; i++) {
    rest[i + 1] = rest[i] + (line[i] === 0 ? 1 : 0);
    unknown[i + 1] = unknown[i] + (line[i] === -1 ? 1 : 0);
  }
  const restIn = (a, b) => rest[b] - rest[a];
  const complete = (a, b) => a >= 0 && b <= line.length && unknown[b] - unknown[a] === 0;

  const results = {};
  for (let iso = fromIso; daysBetween(iso, toIso) >= 0; iso = addDays(iso, 1)) {
    const d0 = daysBetween(start, iso) * DAY;
    if (!days[iso]) {
      results[iso] = { status: 'leeg', issues: [] };
      continue;
    }
    const issues = [];

    // 1) Rust in de kalenderdag zelf (zo staat het ook in het officiële register).
    const restDay = restIn(d0, d0 + DAY) * SLOT_HOURS;

    // 2) Elke periode van 24 uur die in deze dag begint.
    let min24 = Infinity, min24At = d0, blocksIssue = null;
    for (let s = d0; s < d0 + DAY; s++) {
      if (!complete(s, s + DAY)) continue;
      const r = restIn(s, s + DAY) * SLOT_HOURS;
      if (r < min24) { min24 = r; min24At = s; }
      // Rustblokken binnen dit venster: de 10 uur moet passen in de 2 langste,
      // en het langste blok moet minstens 6 uur zijn.
      const blocks = [];
      let run = 0;
      for (let i = s; i < s + DAY; i++) {
        if (line[i] === 0) run++;
        else if (run) { blocks.push(run); run = 0; }
      }
      if (run) blocks.push(run);
      blocks.sort((a, b) => b - a);
      const longest = (blocks[0] || 0) * SLOT_HOURS;
      const twoLongest = ((blocks[0] || 0) + (blocks[1] || 0)) * SLOT_HOURS;
      if (r >= RULES.minRest24h && (twoLongest < RULES.minRest24h || longest < RULES.minLongestPeriod) && !blocksIssue) {
        blocksIssue = { from: s, longest, twoLongest, count: blocks.length };
      }
    }
    if (min24 < RULES.minRest24h) {
      issues.push({ rule: 'rest24h', text: `Minder dan ${RULES.minRest24h} uur rust in 24 uur: ${fmt(min24)} u ${windowText(min24At)}.` });
    }
    if (blocksIssue) {
      issues.push({
        rule: 'periods',
        text: `Rust niet in hoogstens ${RULES.maxRestPeriods} blokken met één van minstens ${RULES.minLongestPeriod} uur ${windowText(blocksIssue.from)}: twee langste blokken samen ${fmt(blocksIssue.twoLongest)} u, langste ${fmt(blocksIssue.longest)} u.`,
      });
    }

    // 3) Elke periode van 7 dagen die in deze dag eindigt.
    let min7 = Infinity;
    for (let e = d0 + 1; e <= d0 + DAY; e++) {
      if (complete(e - WEEK, e)) min7 = Math.min(min7, restIn(e - WEEK, e) * SLOT_HOURS);
    }
    const rest7 = complete(d0 + DAY - WEEK, d0 + DAY) ? restIn(d0 + DAY - WEEK, d0 + DAY) * SLOT_HOURS : null;
    if (min7 < RULES.minRest7d) {
      issues.push({ rule: 'rest7d', text: `Minder dan ${RULES.minRest7d} uur rust in 7 dagen: ${fmt(min7)} u.` });
    }

    // 4) Langste aaneengesloten werkperiode die deze dag raakt.
    let maxWork = 0;
    for (let i = d0; i < d0 + DAY; i++) {
      if (line[i] !== 1 || (i > 0 && line[i - 1] === 1 && i !== d0)) continue;
      let a = i, b = i;
      while (a > 0 && line[a - 1] === 1) a--;
      while (b < line.length && line[b] === 1) b++;
      maxWork = Math.max(maxWork, (b - a) * SLOT_HOURS);
    }
    if (maxWork > RULES.maxWorkStretch) {
      issues.push({ rule: 'work', text: `Meer dan ${RULES.maxWorkStretch} uur zonder rustperiode: ${fmt(maxWork)} u.` });
    }

    const tight = min24 < MARGIN.rest24h || (Number.isFinite(min7) && min7 < MARGIN.rest7d);
    results[iso] = {
      status: issues.length ? 'rood' : tight ? 'oranje' : 'groen',
      restDay,
      min24: Number.isFinite(min24) ? min24 : null,
      rest7,
      min7: Number.isFinite(min7) ? min7 : null,
      maxWork,
      issues,
    };
  }
  return results;
}

// "in de 24 uur van 14:30 tot 14:30 de volgende dag" of "op deze dag (00:00-24:00)"
function windowText(slot) {
  return slot % DAY ? `in de 24 uur van ${slotToTime(slot)} tot ${slotToTime(slot)} de volgende dag` : 'op deze dag (00:00-24:00)';
}

export function fmt(h) {
  return Number.isInteger(h) ? String(h) : h.toFixed(1).replace('.', ',');
}
