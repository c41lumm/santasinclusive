/** "Saturday 12 December at 10:20" in UK time */
export function visitWhen(day: string, startsAt: string) {
  const d = new Date(`${day}T12:00:00Z`);
  const date = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });
  return `${date} at ${startsAt.slice(0, 5)}`;
}
