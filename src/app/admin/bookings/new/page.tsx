import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { adminSeason, daySlots, openingDays } from '@/lib/admin/data';
import { dayName, dayParts, visitWhen } from '@/lib/dates';
import { BookingForm } from '../../../(site)/book/details/booking-form';
import { addBooking } from '../actions';

export const metadata: Metadata = { title: 'Add a booking' };

/** For example for a family who phones. The family gets the same messages as if they had booked online. */
export default async function AddBooking({ searchParams }: { searchParams: Promise<{ day?: string; slot?: string }> }) {
  await requireStaff(['admin', 'lead_elf']);
  const sp = await searchParams;
  const season = await adminSeason();
  if (!season) return <div className="admin-head"><h1>Add a booking</h1><p>There is no season set up yet.</p></div>;
  const days = await openingDays(season.year);
  const day = days.find((d) => d.day === sp.day)?.day ?? days[0]?.day;
  const slots = day ? await daySlots(day) : [];
  const slot = slots.find((s) => s.slot_id === sp.slot && !s.blocked && s.taken < s.capacity);
  return (
    <>
      <div className="admin-head">
        <div><h1>Add a booking</h1><p>{slot && day ? visitWhen(day, slot.t) : 'Choose a day and time'}</p></div>
        <Link className="btn btn-outline" href={`/admin/bookings?day=${day ?? ''}`}>Back to bookings</Link>
      </div>
      {!season.booking_open ? (
        <div className="a-note"><p><strong>Public booking is closed.</strong> Bookings can only be added once it is open (on Visit times).</p></div>
      ) : null}
      {slot && day ? (
        <div style={{ maxWidth: 820 }}>
          <p className="a-note" style={{ marginTop: 0 }}>Read the two agreements to the family and tick them only if they agree.</p>
          <BookingForm slotId={slot.slot_id} action={addBooking} submitLabel="Add this booking" />
        </div>
      ) : (
        <>
          <ul className="a-days" aria-label="Choose a day">
            {days.map((d) => {
              const p = dayParts(d.day);
              return <li key={d.day}><Link className="a-day" href={`/admin/bookings/new?day=${d.day}`} aria-current={d.day === day ? 'date' : undefined}
                aria-label={dayName(d.day)}><span className="wd">{p.weekday}</span><span className="n">{p.date}</span></Link></li>;
            })}
          </ul>
          {day ? (
            <section className="a-panel">
              <h2>Times on {dayName(day)}</h2>
              <ul className="times" style={{ maxWidth: 900 }}>
                {slots.map((s) => (
                  <li key={s.slot_id}>
                    {!s.blocked && s.taken < s.capacity
                      ? <Link className="time" href={`/admin/bookings/new?day=${day}&slot=${s.slot_id}`}>{s.t}</Link>
                      : <span className="time blocked"><span>{s.t}</span><small>{s.blocked ? 'Break' : 'Full'}</small></span>}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
