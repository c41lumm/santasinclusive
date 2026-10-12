import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { adminSeason, openingDays } from '@/lib/admin/data';
import { dayName, seasonDates } from '@/lib/dates';

export const metadata: Metadata = { title: 'Dashboard' };

type Todo = { held: number; dups: number; failed: number; volunteers: number; alerts: number; waiting: number; gaps: number };

export default async function Dashboard() {
  const me = await requireStaff(['admin', 'lead_elf']);
  const admin = me.role === 'admin';
  const season = await adminSeason();
  if (!season) return <div className="admin-head"><div><h1>Hello, {me.name.split(' ')[0]}</h1><p>There is no season set up yet.</p></div></div>;
  const days = await openingDays(season.year);
  const [[todo]] = await asStaff((sql) => [sql`
    select (select count(*) from bookings where status = 'pending_review')::int as held,
           (select count(*) from duplicate_candidates where status in ('open', 'contacting'))::int as dups,
           (select count(*) from messages where status = 'failed' and created_at > now() - interval '7 days')::int as failed,
           (select count(*) from volunteers where status not in ('approved', 'declined'))::int as volunteers,
           (select count(*) from early_alerts where notified_at is null)::int as alerts,
           (select count(*) from waitlist_entries where status = 'waiting' and day >= (now() at time zone 'Europe/London')::date)::int as waiting,
           (select coalesce(sum(greatest(0, s.santas_needed - (select count(*) from shift_assignments a where a.shift_id = s.id and a.role = 'santa'))
                               + greatest(0, s.elves_needed - (select count(*) from shift_assignments a where a.shift_id = s.id and a.role <> 'santa'))), 0)
              from shifts s where extract(year from s.day)::int = ${season.year} and s.day >= (now() at time zone 'Europe/London')::date)::int as gaps`]) as unknown as [[Todo]];
  const open = days.filter((d) => !d.closed);
  const booked = open.reduce((a, d) => a + d.booked, 0);
  const times = open.reduce((a, d) => a + d.times, 0) * season.families_per_slot;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const upcoming = open.filter((d) => d.day >= today).slice(0, 5);

  const items: [boolean, number, string, string, string][] = [
    [admin, todo.held, 'booking held for review', 'bookings held for review', '/admin/bookings'],
    [admin, todo.dups, 'possible duplicate to check', 'possible duplicates to check', '/admin/checks'],
    [admin, todo.failed, 'message not sent this week', 'messages not sent this week', '/admin/messages?show=failed'],
    [admin, todo.volunteers, 'volunteer application to review', 'volunteer applications to review', '/admin/volunteers'],
    [admin && season.booking_open, todo.alerts, 'early alert still to send', 'early alerts still to send', '/admin/alerts'],
    [true, todo.gaps, 'gap on the rota', 'gaps on the rota', '/admin/rota'],
  ];
  const todos = items.filter(([show, n]) => show && n > 0);

  return (
    <>
      <div className="admin-head">
        <div><h1>Hello, {me.name.split(' ')[0]}</h1><p>Season {season.year}: {seasonDates(season.first_day, season.last_day)}</p></div>
        <span className={`tag ${season.booking_open ? 'tag-green' : 'tag-amber'}`} style={{ fontSize: '0.95rem', padding: '8px 14px' }}>
          Booking is {season.booking_open ? 'open' : 'closed'}
        </span>
      </div>
      <section aria-label="Season so far" className="a-stats">
        <div className="a-stat"><p className="label">Families booked</p><p className="value">{booked}</p></div>
        <div className="a-stat"><p className="label">Times left</p><p className="value">{Math.max(0, times - booked)}</p><p className="small">of {times}</p></div>
        <div className="a-stat"><p className="label">Open days</p><p className="value">{open.length}</p></div>
        {admin ? <div className="a-stat"><p className="label">On the waitlist</p><p className="value">{todo.waiting}</p></div> : null}
      </section>
      <div className="a-split">
        <section className="a-panel a-main" aria-labelledby="todo-h">
          <h2 id="todo-h">Needs doing</h2>
          {todos.length ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {todos.map(([, n, one, many, href]) => <li key={one} style={{ marginBottom: 6 }}><Link href={href}><strong>{n}</strong> {n === 1 ? one : many}</Link></li>)}
            </ul>
          ) : <p className="muted">Nothing waiting. All clear.</p>}
        </section>
        <section className="a-panel a-side" aria-labelledby="next-h">
          <h2 id="next-h">Coming up</h2>
          {upcoming.length ? (
            <table className="simple-table">
              <tbody>{upcoming.map((d) => (
                <tr key={d.day}>
                  <td><Link href={`/admin/bookings?day=${d.day}`}>{d.day === today ? 'Today' : dayName(d.day)}</Link><br /><span className="small">{d.opens_at} to {d.closes_at}</span></td>
                  <td style={{ textAlign: 'right' }}><strong>{d.booked}</strong> <span className="small">of {d.times * season.families_per_slot}</span></td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="muted">No more open days this season.</p>}
        </section>
      </div>
    </>
  );
}
