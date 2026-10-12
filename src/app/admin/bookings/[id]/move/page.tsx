import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { adminSeason, bookingSummary, daySlots, isUuid, openingDays } from '@/lib/admin/data';
import { dayName, dayParts, visitWhen } from '@/lib/dates';
import { ActionForm } from '@/components/form';
import { moveBooking } from '../../actions';

export const metadata: Metadata = { title: 'Move a booking' };

export default async function Move({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string; to?: string }> }) {
  await requireStaff(['admin', 'lead_elf']);
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const b = await bookingSummary(id);
  const season = await adminSeason();
  if (!b || !season) notFound();
  const days = await openingDays(season.year);
  const day = days.find((d) => d.day === sp.day)?.day ?? b.day;
  const slots = await daySlots(day);
  const to = slots.find((s) => s.slot_id === sp.to && !s.blocked && s.taken < s.capacity);
  const back = `/admin/bookings?day=${b.day}&sel=${id}`;
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Move {b.names ?? b.contact_name ?? 'this booking'}</h1>
          <p>Now: {visitWhen(b.day, b.t)}</p>
        </div>
        <Link className="btn btn-outline" href={back}>Back to bookings</Link>
      </div>
      {to ? (
        <div className="a-panel" style={{ maxWidth: 560 }}>
          <h2>Move to {visitWhen(day, to.t)}?</h2>
          <p>The family will get a message with the new time, and the old time goes to the waitlist.</p>
          <ActionForm action={moveBooking.bind(null, id, to.slot_id, day)} submitLabel="Move the booking"
            secondary={<Link href={`/admin/bookings/${id}/move?day=${day}`} style={{ fontWeight: 700 }}>Choose another time</Link>}>{null}</ActionForm>
        </div>
      ) : (
        <>
          <ul className="a-days" aria-label="Choose a day">
            {days.map((d) => {
              const p = dayParts(d.day);
              return <li key={d.day}><Link className="a-day" href={`/admin/bookings/${id}/move?day=${d.day}`} aria-current={d.day === day ? 'date' : undefined}
                aria-label={dayName(d.day)}><span className="wd">{p.weekday}</span><span className="n">{p.date}</span></Link></li>;
            })}
          </ul>
          <section className="a-panel">
            <h2>Times on {dayName(day)}</h2>
            <ul className="times" style={{ maxWidth: 900 }}>
              {slots.map((s) => {
                const free = !s.blocked && s.taken < s.capacity && s.slot_id !== undefined;
                return (
                  <li key={s.slot_id}>
                    {free ? <Link className="time" href={`/admin/bookings/${id}/move?day=${day}&to=${s.slot_id}`} aria-label={`${s.t}, free`}>{s.t}</Link>
                      : <span className="time blocked" aria-label={`${s.t}, ${s.blocked ? 'break' : 'full'}`}><span>{s.t}</span><small>{s.blocked ? 'Break' : 'Full'}</small></span>}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
