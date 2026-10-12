import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { adminSeason } from '@/lib/admin/data';
import { saveTimes, setBookingOpen } from './actions';
import { TimesEditor } from './times-editor';

export const metadata: Metadata = { title: 'Visit times' };

export default async function Times() {
  await requireStaff(['admin']);
  const season = await adminSeason();
  if (!season) return <div className="admin-head"><h1>Visit times</h1><p>There is no season set up yet.</p></div>;
  const [days, breaks, booked] = await asStaff((sql) => [
    sql`select day::text as day, to_char(opens_at, 'HH24:MI') as opens_at, to_char(closes_at, 'HH24:MI') as closes_at, closed, own_breaks
        from opening_days where extract(year from day)::int = ${season.year} order by day`,
    sql`select day::text as day, to_char(starts_at, 'HH24:MI') as t from blocked_times
        where day is null or extract(year from day)::int = ${season.year} order by starts_at`,
    sql`select sl.day::text as day, to_char(sl.starts_at, 'HH24:MI') as t from bookings b join slots sl on sl.id = b.slot_id
        where b.season = ${season.year} and b.status in ('pending_review', 'confirmed')`,
  ]) as unknown as [
    { day: string; opens_at: string; closes_at: string; closed: boolean; own_breaks: boolean }[],
    { day: string | null; t: string }[], { day: string; t: string }[],
  ];
  const group = (rows: { day: string | null; t: string }[]) => rows.reduce<Record<string, string[]>>((acc, r) => {
    if (r.day) (acc[r.day] ??= []).push(r.t);
    return acc;
  }, {});

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Visit times</h1>
          <p>Set the hours for each day. Longer days add more bookable times to the calendar straight away.</p>
        </div>
        <form action={setBookingOpen.bind(null, season.year, !season.booking_open)} className="btn-row">
          <span className={`tag ${season.booking_open ? 'tag-green' : 'tag-amber'}`}>Public booking is {season.booking_open ? 'open' : 'closed'}</span>
          <button type="submit" className={`btn ${season.booking_open ? 'btn-danger' : 'btn-green'}`}>
            {season.booking_open ? 'Close booking' : 'Open booking'}
          </button>
        </form>
      </div>
      <TimesEditor year={season.year} visit_minutes={season.visit_minutes} gap_minutes={season.gap_minutes}
        families_per_slot={season.families_per_slot} days={days}
        everyDayBreaks={breaks.filter((b) => !b.day).map((b) => b.t)} dayBreaks={group(breaks)} booked={group(booked)} action={saveTimes} />
    </>
  );
}
