// Everything stays on your own device (localStorage). Use "Download backup" under Profile to save it as a file.
// (Key and file format unchanged, so existing data and backups keep working.)

const KEY = 'stcw-rusttijden-v1';

const empty = () => ({ profile: { name: '', rank: 'Motorman', ship: '', imo: '', flag: '' }, days: {} });

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.days) return { ...empty(), ...raw, profile: { ...empty().profile, ...raw.profile } };
  } catch {}
  return empty();
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

// Dagen worden compact bewaard als tekst van 48 tekens: "0" rust, "1" werk.
export const pack = slots => slots.map(v => (v ? 1 : 0)).join('');
export const unpack = str => Array.from(str, c => (c === '1' ? 1 : 0));

export function daysAsSlots(state) {
  const out = {};
  for (const [iso, str] of Object.entries(state.days)) out[iso] = unpack(str);
  return out;
}

export function exportBackup(state) {
  return new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
}

export function importBackup(text) {
  const data = JSON.parse(text);
  if (!data || typeof data.days !== 'object') throw new Error('Geen geldig back-upbestand');
  for (const [iso, v] of Object.entries(data.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !/^[01]{48}$/.test(v)) throw new Error(`Ongeldige dag: ${iso}`);
  }
  return { ...empty(), ...data, profile: { ...empty().profile, ...data.profile } };
}
