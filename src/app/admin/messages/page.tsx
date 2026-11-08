import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { messageDefs } from '@/lib/notify/templates';
import { notReceived } from '@/lib/notify/send';
import { OneButton } from '../admin-action';
import { checkDelivery, resendAll, resendOne } from './actions';
import { ResendForm } from './resend-form';

export const metadata: Metadata = { title: 'Messages' };
// Sending a batch again can take a minute
export const maxDuration = 300;

type Msg = { id: string; channel: string; template: string; recipient: string; subject: string | null; body: string; status: string; error: string | null;
  delivery: string | null; created_at: string; reference: string | null; day: string | null; booking_id: string | null;
  resend_of: string | null; resent_by: string | null; resent: number; lost: boolean };
type Group = { template: string; channel: string; n: number; bounced: number; failed: number; error: string | null };

const when = (t: string) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const filters = [['all', 'All'], ['lost', 'Not received'], ['sent', 'Sent']] as const;
const channelName = (c: string) => (c === 'sms' ? 'Text' : c === 'email' ? 'Email' : c === 'whatsapp' ? 'WhatsApp' : c);
const templateName = (t: string) => {
  if (t === 'inbox:reply') return 'Reply from the Inbox';
  const name = t.replace(/^admin:/, '');
  const label = (messageDefs as Record<string, { label: string } | undefined>)[name]?.label;
  return `${label ?? name}${t.startsWith('admin:') ? ' (sent by a helper)' : ''}`;
};
const deliveryTag: Record<string, [string, string]> = {
  delivered: ['Delivered', 'green'], opened: ['Delivered', 'green'], clicked: ['Delivered', 'green'],
  bounced: ['Bounced', 'red'], complained: ['Marked as spam', 'red'], delivery_delayed: ['Delayed', 'amber'],
};

export default async function Messages({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff(['admin']);
  const asked = (await searchParams).show;
  const show = asked === 'lost' || asked === 'failed' ? 'lost' : asked === 'sent' ? 'sent' : 'all';
  const [rows, [counts], groups, [checked]] = await asStaff((sql) => [
    sql`select m.id, m.channel::text as channel, m.template, m.recipient, m.subject, m.body, m.status, m.error, m.delivery,
               m.created_at::text as created_at, b.reference, sl.day::text as day, m.booking_id, m.resend_of, m.resent_by,
               (select count(*)::int from messages r where r.resend_of = m.id) as resent,
               (${sql.unsafe(notReceived)}) as lost
        from messages m left join bookings b on b.id = m.booking_id left join slots sl on sl.id = b.slot_id
        where ${show} = 'all' or (${show} = 'sent' and m.status = 'sent') or (${show} = 'lost' and ${sql.unsafe(notReceived)})
        order by m.created_at desc limit 300`,
    sql`select count(*) filter (where m.status = 'sent')::int as sent,
               count(*) filter (where m.delivery in ('delivered', 'opened', 'clicked'))::int as delivered,
               count(*) filter (where ${sql.unsafe(notReceived)})::int as lost,
               count(*) filter (where m.status = 'queued')::int as queued from messages m`,
    sql`select m.template, m.channel::text as channel, count(*)::int as n,
               count(*) filter (where m.delivery = 'bounced')::int as bounced, count(*) filter (where m.status = 'failed')::int as failed,
               max(m.error) as error
        from messages m where ${sql.unsafe(notReceived)}
        group by 1, 2 order by n desc`,
    sql`select max(delivery_checked_at)::text as at from messages`,
  ]);
  const list = rows as Msg[];
  const c = counts as unknown as { sent: number; delivered: number; lost: number; queued: number };
  const lastChecked = (checked as unknown as { at: string | null }).at;
  const lostGroups = groups as Group[];

  return (
    <>
      <div className="admin-head">
        <div><h1>Messages</h1><p>Every email and text the grotto has sent, newest first.</p></div>
        <div style={{ minWidth: 240 }}>
          <OneButton action={checkDelivery} label="Check which emails arrived" />
          <p className="small" style={{ margin: '6px 0 0' }}>{lastChecked ? `Last checked ${when(lastChecked)}.` : 'Not checked yet.'}</p>
        </div>
      </div>
      <section aria-label="Totals" className="a-stats">
        <div className="a-stat"><p className="label">Sent</p><p className="value">{c.sent}</p></div>
        <div className="a-stat"><p className="label">Emails delivered</p><p className="value" style={{ color: 'var(--green)' }}>{c.delivered}</p></div>
        <div className="a-stat" style={c.lost ? { background: '#fdecec', color: 'var(--red)' } : undefined}><p className="label">Not received</p><p className="value">{c.lost}</p></div>
        <div className="a-stat"><p className="label">Sending now</p><p className="value">{c.queued}</p></div>
      </section>
      <div className="a-chips" role="group" aria-label="Show" style={{ marginBottom: 16 }}>
        {filters.map(([k, l]) => <Link key={k} href={k === 'all' ? '/admin/messages' : `/admin/messages?show=${k}`} className={`chip${show === k ? ' on' : ''}`} aria-current={show === k ? 'true' : undefined}>{l}{k === 'lost' && c.lost ? ` (${c.lost})` : ''}</Link>)}
      </div>

      {show === 'lost' && lostGroups.length ? (
        <section className="a-panel" aria-labelledby="again-h" style={{ marginBottom: 20 }}>
          <h2 id="again-h">Send them again</h2>
          <p>Fix what stopped them first, or they will fail again in the same way. Each message goes word for word as before, to the same
            address or number. Messages about a booking that has since been cancelled are skipped.</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="simple-table">
              <thead><tr><th scope="col">Message</th><th scope="col">Not received</th><th scope="col">Why</th><th scope="col"><span className="visually-hidden">Send again</span></th></tr></thead>
              <tbody>
                {lostGroups.map((g) => (
                  <tr key={`${g.template}-${g.channel}`}>
                    <td>{templateName(g.template)}<br /><span className="small">{channelName(g.channel)}</span></td>
                    <td>{g.n}</td>
                    <td className="small" style={{ maxWidth: 320 }}>
                      {[g.bounced ? `${g.bounced} bounced` : '', g.failed ? `${g.failed} not sent${g.error ? `: ${g.error.replace(/^Error: /, '')}` : ''}` : '',
                        g.n - g.bounced - g.failed > 0 ? `${g.n - g.bounced - g.failed} delayed` : ''].filter(Boolean).join('; ')}
                    </td>
                    <td style={{ minWidth: 200 }}><OneButton action={resendAll.bind(null, g.template, g.channel)} label={`Send ${g.n > 100 ? '100' : g.n} again`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="a-panel" aria-label="Messages">
        {list.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="simple-table">
              <thead><tr><th scope="col">When</th><th scope="col">To</th><th scope="col">Message</th><th scope="col">Booking</th><th scope="col">Result</th></tr></thead>
              <tbody>
                {list.map((m) => {
                  const d = m.delivery ? deliveryTag[m.delivery] : undefined;
                  return (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{when(m.created_at)}</td>
                      <td>{m.recipient}<br /><span className="small">{channelName(m.channel)}</span></td>
                      <td>
                        <details><summary>{templateName(m.template)}</summary>
                          {m.subject ? <p className="small" style={{ fontWeight: 700, margin: '6px 0 0' }}>{m.subject}</p> : null}
                          <p className="small" style={{ whiteSpace: 'pre-wrap', maxWidth: 420 }}>{m.body}</p></details>
                        {m.resend_of ? <span className="small">Sent again{m.resent_by ? ` by ${m.resent_by}` : ''}</span> : null}
                      </td>
                      <td>{m.reference && m.day ? <Link href={`/admin/bookings?day=${m.day}&sel=${m.booking_id}`}>{m.reference}</Link> : <span className="muted">None</span>}</td>
                      <td style={{ minWidth: 260 }}>
                        {m.status === 'failed'
                          ? <><span className="tag tag-red">Not sent</span>{m.error ? <p className="small" style={{ margin: '4px 0 0', maxWidth: 260 }}>{m.error}</p> : null}</>
                          : m.status === 'queued' ? <span className="tag tag-grey">Sending</span>
                          : d ? <span className={`tag tag-${d[1]}`}>{d[0]}</span>
                          : <span className="tag tag-green">Sent</span>}
                        {m.resent ? <p className="small" style={{ margin: '4px 0 0' }}>Sent again since</p> : null}
                        {m.lost || m.status === 'sent' ? <ResendForm id={m.id} channel={m.channel} recipient={m.recipient} action={resendOne.bind(null, m.id, m.channel)} /> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">No messages{show !== 'all' ? ' here' : ' yet'}.</p>}
        {list.length === 300 ? <p className="small">Showing the newest 300.</p> : null}
      </section>
    </>
  );
}
