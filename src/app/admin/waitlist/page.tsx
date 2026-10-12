import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { dayName } from '@/lib/dates';
import { removeFromWaitlist } from '../more-actions';

export const metadata: Metadata = { title: 'Waitlist' };

type Entry = { id: string; day: string; time_pref: string; contact_name: string; email: string | null; phone: string | null;
  status: string; offer_time: string | null; offer_expires_at: string | null; created_at: string };
const when = (t: string) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const prefs: Record<string, string> = { any: 'Any time', morning: 'Morning', afternoon: 'Afternoon' };

export default async function Waitlist() {
  await requireStaff(['admin']);
  const [rows] = await asStaff((sql) => [sql`
    select w.id, w.day::text as day, w.time_pref, w.contact_name, w.email::text as email, w.phone, w.status::text as status,
           to_char(sl.starts_at, 'HH24:MI') as offer_time, w.offer_expires_at::text as offer_expires_at, w.created_at::text as created_at
    from waitlist_entries w left join slots sl on sl.id = w.offer_slot_id
    where w.day >= (now() at time zone 'Europe/London')::date
    order by w.day, w.created_at`]);
  const all = rows as Entry[];
  const offered = all.filter((e) => e.status === 'offered' && e.offer_expires_at && new Date(e.offer_expires_at) > new Date());
  const waiting = all.filter((e) => e.status === 'waiting');
  const days = [...new Set(waiting.map((e) => e.day))];
  return (
    <>
      <div className="admin-head">
        <div><h1>Waitlist</h1><p>Families waiting for a time to free up. When a booking is cancelled, the time is offered to the first in line automatically.</p></div>
      </div>
      <section aria-label="Totals" className="a-stats">
        <div className="a-stat"><p className="label">Waiting</p><p className="value">{waiting.length}</p></div>
        <div className="a-stat"><p className="label">Holding an offer</p><p className="value">{offered.length}</p></div>
        <div className="a-stat"><p className="label">Took a time</p><p className="value">{all.filter((e) => e.status === 'claimed').length}</p></div>
      </section>
      {offered.length ? (
        <section className="a-panel" aria-labelledby="off-h">
          <h2 id="off-h">Holding an offer</h2>
          <table className="simple-table">
            <thead><tr><th scope="col">Family</th><th scope="col">Time offered</th><th scope="col">Offer ends</th></tr></thead>
            <tbody>{offered.map((e) => (
              <tr key={e.id}><td>{e.contact_name}<br /><span className="small">{e.phone ?? e.email}</span></td>
                <td>{dayName(e.day)}, {e.offer_time}</td><td>{when(e.offer_expires_at!)}</td></tr>
            ))}</tbody>
          </table>
        </section>
      ) : null}
      {days.length ? days.map((d) => (
        <section className="a-panel" key={d} aria-labelledby={`d-${d}`}>
          <h2 id={`d-${d}`}>{dayName(d)}</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="simple-table">
              <thead><tr><th scope="col">In line</th><th scope="col">Family</th><th scope="col">Prefers</th><th scope="col">Joined</th><th scope="col"><span className="visually-hidden">Remove</span></th></tr></thead>
              <tbody>{waiting.filter((e) => e.day === d).map((e, i) => (
                <tr key={e.id}>
                  <td>{i + 1}</td>
                  <td>{e.contact_name}<br /><span className="small">{[e.phone, e.email].filter(Boolean).join(', ')}</span></td>
                  <td>{prefs[e.time_pref] ?? e.time_pref}</td>
                  <td>{when(e.created_at)}</td>
                  <td><form action={removeFromWaitlist.bind(null, e.id)}><button type="submit" className="btn btn-plain btn-sm" aria-label={`Remove ${e.contact_name} from the waitlist`}>Remove</button></form></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )) : <section className="a-panel"><p className="muted" style={{ margin: 0 }}>No one is waiting.</p></section>}
    </>
  );
}
