import Link from 'next/link';
import type { Day, Slot } from '@/lib/public-data';
import { dayName, dayParts } from '@/lib/dates';

/** The days of the season as large links, as in the homepage design. Full days still show, for the waitlist. */
export function DayPicker({ days, selected, href, label = 'Choose a day' }: {
  days: Day[]; selected?: string; href: (day: string) => string; label?: string;
}) {
  return (
    <ul className="days" aria-label={label}>
      {days.map((d) => {
        const p = dayParts(d.day);
        const full = d.spaces_left === 0;
        const on = d.day === selected;
        return (
          <li key={d.day}>
            <Link href={href(d.day)} scroll={false} className={`day${on ? ' selected' : ''}${full ? ' full' : ''}`}
              aria-current={on ? 'date' : undefined}
              aria-label={`${dayName(d.day)}, ${full ? 'full, join the waitlist' : `${d.spaces_left} ${d.spaces_left === 1 ? 'time' : 'times'} left`}`}>
              <span className="wd">{p.weekday}</span>
              <span className="n">{p.date}</span>
              {full ? <span className="left">Full</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The times on one day. Open times are links; breaks and booked times show but cannot be chosen. */
export function TimeList({ slots, href }: { slots: Slot[]; href: (slot: Slot) => string }) {
  if (!slots.some((s) => s.state === 'open')) return <p>There are no times left on this day.</p>;
  return (
    <ul className="times" aria-label="Choose a time">
      {slots.map((s) => (
        <li key={s.slot_id}>
          {s.state === 'open' ? (
            <Link className="time" href={href(s)} aria-label={`${s.starts_at} to ${s.ends_at}`}>{s.starts_at}</Link>
          ) : (
            <span className="time blocked" aria-label={`${s.starts_at}, ${s.state === 'break' ? 'break' : 'booked'}, not available`}>
              <span>{s.starts_at}</span><small>{s.state === 'break' ? 'Break' : 'Booked'}</small>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
