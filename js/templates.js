// Veelgebruikte wachtroosters. `work` = werkblokken in uren [van, tot).

export const TEMPLATES = [
  { id: 'w04', name: 'Wacht 00–04 / 12–16', work: [[0, 4], [12, 16]] },
  { id: 'w48', name: 'Wacht 04–08 / 16–20', work: [[4, 8], [16, 20]] },
  { id: 'w812', name: 'Wacht 08–12 / 20–24', work: [[8, 12], [20, 24]] },
  { id: 'day', name: 'Dagwerker 08–17 (lunch 12–13)', work: [[8, 12], [13, 17]] },
  { id: 's6a', name: '6 op / 6 af (00–06 / 12–18)', work: [[0, 6], [12, 18]] },
  { id: 's6b', name: '6 op / 6 af (06–12 / 18–24)', work: [[6, 12], [18, 24]] },
  { id: 'off', name: 'Vrije dag / verlof', work: [] },
];

export function templateSlots(t) {
  const s = new Array(48).fill(0);
  for (const [a, b] of t.work) for (let i = a * 2; i < b * 2; i++) s[i] = 1;
  return s;
}
