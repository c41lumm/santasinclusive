/** Same rule as regenerate_slots() in the database, used for previews in the admin. */
export type DayHours = { opensAt: string; closesAt: string; closed?: boolean };
export type SlotRules = { visitMinutes: number; gapMinutes: number };

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function slotTimes(day: DayHours, rules: SlotRules, blocked: string[] = []) {
  if (day.closed) return [];
  const out: { startsAt: string; endsAt: string; blocked: boolean }[] = [];
  const close = toMin(day.closesAt);
  for (let m = toMin(day.opensAt); m + rules.visitMinutes <= close; m += rules.visitMinutes + rules.gapMinutes) {
    const startsAt = toTime(m);
    out.push({ startsAt, endsAt: toTime(m + rules.visitMinutes), blocked: blocked.includes(startsAt) });
  }
  return out;
}
