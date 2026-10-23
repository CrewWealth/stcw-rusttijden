// Common watch schedules. `work` = work blocks in hours [from, to).

export const TEMPLATES = [
  // 5/3 system: 6 watches (00–05, 05–10, 10–13, 13–16, 16–19, 19–24) over 3 crews;
  // each crew stands one 5-hour and one 3-hour watch = 8 hours per day.
  { id: 'v53a', name: '5/3 watch 1: 00–05 + 13–16', work: [[0, 5], [13, 16]] },
  { id: 'v53b', name: '5/3 watch 2: 05–10 + 16–19', work: [[5, 10], [16, 19]] },
  { id: 'v53c', name: '5/3 watch 3: 10–13 + 19–24', work: [[10, 13], [19, 24]] },
  { id: 'w04', name: 'Watch 00–04 / 12–16', work: [[0, 4], [12, 16]] },
  { id: 'w48', name: 'Watch 04–08 / 16–20', work: [[4, 8], [16, 20]] },
  { id: 'w812', name: 'Watch 08–12 / 20–24', work: [[8, 12], [20, 24]] },
  { id: 'day', name: 'Day worker 08–17 (lunch 12–13)', work: [[8, 12], [13, 17]] },
  { id: 's6a', name: '6 on / 6 off (00–06 / 12–18)', work: [[0, 6], [12, 18]] },
  { id: 's6b', name: '6 on / 6 off (06–12 / 18–24)', work: [[6, 12], [18, 24]] },
  { id: 'off', name: 'Day off / leave', work: [] },
];

export function templateSlots(t) {
  const s = new Array(48).fill(0);
  for (const [a, b] of t.work) for (let i = a * 2; i < b * 2; i++) s[i] = 1;
  return s;
}
