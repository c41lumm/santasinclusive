const atNoon = (day: string) => new Date(`${day}T12:00:00Z`);

/** "Saturday 12 December at 10:20" in UK time */
export function visitWhen(day: string, startsAt: string) {
  return `${dayName(day)} at ${startsAt.slice(0, 5)}`;
}

/** "Saturday 12 December" */
export function dayName(day: string) {
  return atNoon(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });
}

/** "Sat" and "12", for the date picker */
export function dayParts(day: string) {
  const d = atNoon(day);
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' }),
    date: d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Europe/London' }),
    month: d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'Europe/London' }),
  };
}

/** "1 to 24 December 2026" */
export function seasonDates(first: string, last: string) {
  const f = atNoon(first), l = atNoon(last);
  const opts = { day: 'numeric', month: 'long', timeZone: 'Europe/London' } as const;
  return `${f.toLocaleDateString('en-GB', f.getUTCMonth() === l.getUTCMonth() ? { day: 'numeric', timeZone: 'Europe/London' } : opts)} to ${l.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}
