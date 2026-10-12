import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';

export const metadata: Metadata = { title: 'Messages' };

type Msg = { id: string; channel: string; template: string; recipient: string; body: string; status: string; error: string | null;
  created_at: string; reference: string | null; day: string | null; booking_id: string | null };
const when = (t: string) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const filters = [['all', 'All'], ['failed', 'Not sent'], ['sent', 'Sent']] as const;

export default async function Messages({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff(['admin']);
  const show = (await searchParams).show === 'failed' ? 'failed' : (await searchParams).show === 'sent' ? 'sent' : 'all';
  const [rows, [counts]] = await asStaff((sql) => [
    sql`select m.id, m.channel::text as channel, m.template, m.recipient, m.body, m.status, m.error, m.created_at::text as created_at,
               b.reference, sl.day::text as day, m.booking_id
        from messages m left join bookings b on b.id = m.booking_id left join slots sl on sl.id = b.slot_id
        where ${show} = 'all' or m.status = ${show}
        order by m.created_at desc limit 300`,
    sql`select count(*) filter (where status = 'sent')::int as sent, count(*) filter (where status = 'failed')::int as failed,
               count(*) filter (where status = 'queued')::int as queued from messages`,
  ]);
  const list = rows as Msg[];
  const c = counts as unknown as { sent: number; failed: number; queued: number };
  return (
    <>
      <div className="admin-head">
        <div><h1>Messages</h1><p>Every email and text the grotto has sent, newest first.</p></div>
      </div>
      <section aria-label="Totals" className="a-stats">
        <div className="a-stat"><p className="label">Sent</p><p className="value">{c.sent}</p></div>
        <div className="a-stat" style={c.failed ? { background: '#fdecec', color: 'var(--red)' } : undefined}><p className="label">Not sent</p><p className="value">{c.failed}</p></div>
        <div className="a-stat"><p className="label">Sending now</p><p className="value">{c.queued}</p></div>
      </section>
      <div className="a-chips" role="group" aria-label="Show">
        {filters.map(([k, l]) => <Link key={k} href={k === 'all' ? '/admin/messages' : `/admin/messages?show=${k}`} className={`chip${show === k ? ' on' : ''}`} aria-current={show === k ? 'true' : undefined}>{l}</Link>)}
      </div>
      <section className="a-panel" aria-label="Messages">
        {list.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="simple-table">
              <thead><tr><th scope="col">When</th><th scope="col">To</th><th scope="col">Message</th><th scope="col">Booking</th><th scope="col">Result</th></tr></thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{when(m.created_at)}</td>
                    <td>{m.recipient}<br /><span className="small">{m.channel === 'sms' ? 'Text' : m.channel === 'email' ? 'Email' : m.channel}</span></td>
                    <td><details><summary>{m.template.replace(/^admin:/, '')}</summary><p className="small" style={{ whiteSpace: 'pre-wrap', maxWidth: 420 }}>{m.body}</p></details></td>
                    <td>{m.reference && m.day ? <Link href={`/admin/bookings?day=${m.day}&sel=${m.booking_id}`}>{m.reference}</Link> : <span className="muted">None</span>}</td>
                    <td>{m.status === 'sent' ? <span className="tag tag-green">Sent</span> : m.status === 'failed'
                      ? <><span className="tag tag-red">Not sent</span>{m.error ? <p className="small" style={{ margin: '4px 0 0', maxWidth: 260 }}>{m.error}</p> : null}</>
                      : <span className="tag tag-grey">Sending</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">No messages{show !== 'all' ? ' here' : ' yet'}.</p>}
        {list.length === 300 ? <p className="small">Showing the newest 300.</p> : null}
      </section>
    </>
  );
}
