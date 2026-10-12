import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { adminSeason } from '@/lib/admin/data';
import { sendEarlyAlerts } from '../more-actions';
import { OneButton } from '../admin-action';

export const metadata: Metadata = { title: 'Early alerts' };

type Alert = { id: string; name: string; contact: string; is_group: boolean; notified_at: string | null; created_at: string };
const when = (t: string) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

export default async function Alerts() {
  await requireStaff(['admin']);
  const season = await adminSeason();
  const [rows] = await asStaff((sql) => [sql`
    select id, name, contact, is_group, notified_at::text as notified_at, created_at::text as created_at
    from early_alerts order by notified_at nulls first, created_at`]);
  const alerts = rows as Alert[];
  const waiting = alerts.filter((a) => !a.notified_at);
  return (
    <>
      <div className="admin-head">
        <div><h1>Early alerts</h1><p>People who asked to hear the moment booking opens.</p></div>
      </div>
      <section aria-label="Totals" className="a-stats">
        <div className="a-stat"><p className="label">Still to tell</p><p className="value">{waiting.length}</p></div>
        <div className="a-stat"><p className="label">Already told</p><p className="value">{alerts.length - waiting.length}</p></div>
        <div className="a-stat"><p className="label">Groups</p><p className="value">{alerts.filter((a) => a.is_group).length}</p></div>
      </section>
      <section className="a-panel" aria-labelledby="send-h">
        <h2 id="send-h">Tell them booking is open</h2>
        {!season?.booking_open ? (
          <p>Booking is closed at the moment. Open it on the <a href="/admin/times">Visit times</a> page first, so the link in the message works.</p>
        ) : waiting.length ? (
          <>
            <p>Sends one email or text to {waiting.length === 1 ? 'the 1 person' : `each of the ${waiting.length} people`} not yet told. Each person is only ever sent it once.</p>
            <div style={{ maxWidth: 420 }}><OneButton action={sendEarlyAlerts} label={`Send to ${waiting.length} now`} /></div>
          </>
        ) : <p>Everyone on the list has been told.</p>}
      </section>
      <section className="a-panel" aria-labelledby="list-h">
        <h2 id="list-h">Everyone on the list</h2>
        {alerts.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="simple-table">
              <thead><tr><th scope="col">Name</th><th scope="col">Email or mobile</th><th scope="col">Signed up</th><th scope="col">Told</th></tr></thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}{a.is_group ? <> <span className="tag tag-grey">Group</span></> : null}</td>
                    <td>{a.contact}</td>
                    <td>{when(a.created_at)}</td>
                    <td>{a.notified_at ? <span className="tag tag-green">{when(a.notified_at)}</span> : <span className="tag tag-amber">Not yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">No one has signed up yet.</p>}
      </section>
    </>
  );
}
