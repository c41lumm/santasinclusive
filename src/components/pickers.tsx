import Link from 'next/link';
import type { Day, Slot } from '@/lib/public-data';
import { dayName, dayParts } from '@/lib/dates';

/** The days of the season as large links. Full days still show, so families can join the waitlist for them. */
export function DayPicker({ days, selected, href }: { days: Day[]; selected?: string; href: (day: string) => string }) {
  let month = '';
  return (
    <ul className="days" aria-label="Days">
      {days.map((d) => {
        const p = dayParts(d.day);
        const heading = p.month !== month ? (month = p.month) : null;
        const full = d.spaces_left === 0;
        return (
          <li key={d.day}>
            <Link href={href(d.day)} className={`day${d.day === selected ? ' selected' : ''}${full ? ' full' : ''}`}
              aria-current={d.day === selected ? 'date' : undefined} aria-label={`${dayName(d.day)}: ${full ? 'full' : `${d.spaces_left} ${d.spaces_left === 1 ? 'time' : 'times'} left`}`}>
              <span className="weekday">{p.weekday}{heading ? ` · ${heading}` : ''}</span>
              <span className="date">{p.date}</span>
              <span className="spaces">{full ? 'Full' : `${d.spaces_left} left`}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The times on one day. Open times are links; breaks and full times are shown but cannot be chosen. */
export function TimeList({ slots, href }: { slots: Slot[]; href: (slot: Slot) => string }) {
  const shown = slots.filter((s) => s.state !== 'break');
  if (!shown.length) return <p>There are no times left on this day.</p>;
  return (
    <ul className="times">
      {shown.map((s) => (
        <li key={s.slot_id}>
          {s.state === 'open' ? (
            <Link className="time" href={href(s)}>{s.starts_at}<small>until {s.ends_at}</small></Link>
          ) : (
            <span className="time unavailable">{s.starts_at}<small>Booked</small></span>
          )}
        </li>
      ))}
    </ul>
  );
}
