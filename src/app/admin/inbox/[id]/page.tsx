import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { inboxEmail, inboxState, markRead, parseAddress } from '@/lib/admin/inbox';
import { db } from '@/lib/db';
import { setArchived, replyToEmail } from '../actions';
import { ReplyForm } from './reply-form';

export const metadata: Metadata = { title: 'Email' };

const when = (t: string) => new Date(t).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

/** One received email, with earlier replies and a box to reply */
export default async function InboxEmail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff(['admin']);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await inboxEmail(id);
  if (!e) notFound();
  await markRead(id, me.name);
  const state = await inboxState(id);
  const replies = await db()`
    select created_at::text as created_at, recipient, body, status, error, resent_by from messages
    where inbox_email_id = ${id} order by created_at` as { created_at: string; recipient: string; body: string; status: string; error: string | null; resent_by: string | null }[];
  const from = parseAddress(e.from);
  const replyTo = parseAddress(e.reply_to?.[0] || e.from).address;
  const files = (e.attachments ?? []).filter((a) => a.content_disposition !== 'inline' || !a.content_id);
  // Only HTML: shown in a locked-down frame so nothing in the email can run
  const html = !e.text?.trim() && e.html ? `<base target="_blank"><style>body{font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;margin:12px;color:#222}</style>${e.html}` : null;

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/admin/inbox">← Inbox</Link></p>
      <div className="admin-head">
        <div>
          <h1 style={{ overflowWrap: 'anywhere' }}>{e.subject || '(no subject)'}</h1>
          <p>From {from.name ? <><strong>{from.name}</strong> &lt;{from.address}&gt;</> : <strong>{from.address}</strong>} to {(e.received_for?.length ? e.received_for : e.to).join(', ')}<br />{when(e.created_at)}</p>
        </div>
        <form action={setArchived.bind(null, id, !state?.archived_at)}>
          <button type="submit" className="btn btn-outline btn-sm">{state?.archived_at ? 'Move back to Inbox' : 'Archive'}</button>
        </form>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
          <section className="a-panel" aria-label="Email">
            {html
              ? <iframe title="Email" sandbox="allow-popups" srcDoc={html} style={{ width: '100%', minHeight: 420, border: 0 }} />
              : <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.text?.trim() || <span className="muted">This email has no text.</span>}</div>}
            {files.length ? (
              <ul className="a-chips" style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }} aria-label="Attachments">
                {files.map((a) => <li key={a.id}><a className="chip" href={`/admin/inbox/${id}/attachments/${a.id}`} target="_blank" rel="noopener">📎 {a.filename || 'Attachment'} ({size(a.size)})</a></li>)}
              </ul>
            ) : null}
          </section>

          {replies.map((r) => (
            <section className="a-panel card-pale" key={r.created_at} aria-label="Reply">
              <p className="small" style={{ marginTop: 0 }}><strong>{r.resent_by ?? 'Someone'}</strong> replied {when(r.created_at)}
                {r.status === 'failed' ? <> · <span className="tag tag-red">Not sent</span> {r.error}</> : null}</p>
              <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.body.split('\nOn ')[0]}</div>
            </section>
          ))}

          <section className="a-panel" aria-labelledby="reply-h">
            <h2 id="reply-h">Reply</h2>
            <ReplyForm action={replyToEmail.bind(null, id)} to={replyTo} />
          </section>
      </div>
    </>
  );
}
