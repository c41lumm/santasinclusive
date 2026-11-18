import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { adminSeason, daySlots, openingDays } from '@/lib/admin/data';
import { dayName, dayParts, visitWhen } from '@/lib/dates';
import { BookingForm } from '../../../(site)/book/details/booking-form';
import { asStaff } from '@/lib/db';
import { isUuid } from '@/lib/admin/data';
import { addBooking, addGroupBooking } from '../actions';
import { GroupBookingForm, type GroupPrefill } from './group-booking-form';

export const metadata: Metadata = { title: 'Add a booking' };

/** For example for a family who phones. The family gets the same messages as if they had booked online. */
export default async function AddBooking({ searchParams }: { searchParams: Promise<{ day?: string; slot?: string; type?: string; enquiry?: string }> }) {
  await requireStaff(['admin', 'lead_elf']);
  const sp = await searchParams;
  const season = await adminSeason();
  if (!season) return <div className="admin-head"><h1>Add a booking</h1><p>There is no season set up yet.</p></div>;
  const days = await openingDays(season.year);
  const day = days.find((d) => d.day === sp.day)?.day ?? days[0]?.day;
  const slots = day ? await daySlots(day) : [];
  const slot = slots.find((s) => s.slot_id === sp.slot && !s.blocked && s.taken < s.capacity);
  // A school or group, perhaps from their enquiry on Group enquiries (their details are filled in)
  const enquiryId = isUuid(sp.enquiry) ? sp.enquiry : null;
  const group = sp.type === 'group' || !!enquiryId;
  let prefill: GroupPrefill | undefined;
  if (enquiryId) {
    const [rows] = await asStaff((sql) => [sql`select organisation, contact_name, email::text as email, phone, people, staff, age_range, needs
      from group_enquiries where id = ${enquiryId}::uuid`]);
    const e = rows[0] as { organisation: string; contact_name: string; email: string; phone: string; people: number; staff: number; age_range: string; needs: string | null } | undefined;
    if (e) prefill = { group_name: e.organisation, contact_name: e.contact_name, email: e.email, phone: e.phone, group_size: e.people,
      group_staff: e.staff, age_range: e.age_range, notes: e.needs ?? undefined };
  }
  const keep = (extra: Record<string, string | undefined>) =>
    `/admin/bookings/new?${new URLSearchParams(Object.entries({ day, type: group ? 'group' : undefined, enquiry: enquiryId ?? undefined, ...extra }).filter(([, v]) => v) as [string, string][])}`;
  // How many back-to-back times are free from the chosen one
  const startAt = slot ? slots.indexOf(slot) : -1;
  let inRow = 0;
  for (let i = startAt; i >= 0 && i < slots.length && !slots[i].blocked && slots[i].taken < slots[i].capacity; i++) inRow++;
  const timeChoices = Array.from({ length: Math.max(1, Math.min(6, inRow)) }, (_, i) => ({
    value: String(i + 1), label: i === 0 ? `Just this time (${slot?.t} to ${slot?.ends})` : `${i + 1} times, ${slot?.t} to ${slots[startAt + i]?.ends}`,
  }));
  return (
    <>
      <div className="admin-head">
        <div><h1>{group ? 'Book a school or group' : 'Add a booking'}</h1><p>{slot && day ? visitWhen(day, slot.t) : 'Choose a day and time'}{prefill ? ` · ${prefill.group_name}` : ''}</p></div>
        <Link className="btn btn-outline" href={`/admin/bookings?day=${day ?? ''}`}>Back to bookings</Link>
      </div>
      {!season.booking_open ? (
        <div className="a-note"><p><strong>Public booking is closed.</strong> Bookings can only be added once it is open (on Visit times).</p></div>
      ) : null}
      <div className="give-switch" role="group" aria-label="Who is the booking for?" style={{ marginBottom: 20 }}>
        <Link href={`/admin/bookings/new?${new URLSearchParams(Object.entries({ day, slot: slot?.slot_id }).filter(([, v]) => v) as [string, string][])}`} aria-current={!group ? 'true' : undefined}>A family</Link>
        <Link href={`/admin/bookings/new?${new URLSearchParams(Object.entries({ day, slot: slot?.slot_id, type: 'group' }).filter(([, v]) => v) as [string, string][])}`} aria-current={group ? 'true' : undefined}>A school or group</Link>
      </div>
      {slot && day && group ? (
        <div className="a-panel" style={{ maxWidth: 820 }}>
          <GroupBookingForm action={addGroupBooking.bind(null, day, slot.slot_id, enquiryId)} times={timeChoices} prefill={prefill} />
        </div>
      ) : slot && day ? (
        <div style={{ maxWidth: 820 }}>
          <p className="a-note" style={{ marginTop: 0 }}>Read the two agreements to the family and tick them only if they agree.</p>
          <BookingForm slotId={slot.slot_id} action={addBooking} submitLabel="Add this booking" />
        </div>
      ) : (
        <>
          <ul className="a-days" aria-label="Choose a day">
            {days.map((d) => {
              const p = dayParts(d.day);
              return <li key={d.day}><Link className="a-day" href={keep({ day: d.day })} aria-current={d.day === day ? 'date' : undefined}
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
                      ? <Link className="time" href={keep({ slot: s.slot_id })}>{s.t}</Link>
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
