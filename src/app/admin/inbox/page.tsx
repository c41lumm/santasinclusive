import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { inbox, parseAddress, type InboxItem } from '@/lib/admin/inbox';

export const metadata: Metadata = { title: 'Inbox' };

const when = (t: string) => {
  const d = new Date(t);
  const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London' }) === d.toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
  return today ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
};
const tabs = [['todo', 'Inbox'], ['unreplied', 'Not replied'], ['archived', 'Archived']] as const;

/** Emails sent to the grotto's own addresses, such as families replying to booking emails */
export default async function Inbox({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff(['admin']);
  const asked = (await searchParams).show;
  const show = tabs.some(([k]) => k === asked) ? asked! : 'todo';
  let all: InboxItem[] = [];
  let problem = '';
  try { all = await inbox(); } catch (e) { problem = String(e); }
  const list = all.filter((e) => (show === 'archived' ? e.archived_at : !e.archived_at && (show !== 'unreplied' || !e.replied_at)));
  const unread = all.filter((e) => !e.read_at && !e.archived_at).length;

  return (
    <>
      <div className="admin-head">
        <div><h1>Inbox</h1><p>Emails sent to the grotto, such as families replying to their booking emails.{unread ? ` ${unread} unread.` : ''}</p></div>
      </div>
      <div className="a-chips" role="group" aria-label="Show" style={{ marginBottom: 16 }}>
        {tabs.map(([k, l]) => <Link key={k} href={k === 'todo' ? '/admin/inbox' : `/admin/inbox?show=${k}`} className={`chip${show === k ? ' on' : ''}`} aria-current={show === k ? 'true' : undefined}>{l}</Link>)}
      </div>
      {problem ? <p className="notice" role="alert">Could not reach Resend to fetch emails: {problem}</p> : null}
      <section className="a-table" aria-label="Emails">
        {list.length ? list.map((e) => {
          const from = parseAddress(e.from);
          return (
            <Link key={e.id} href={`/admin/inbox/${e.id}`} className={`a-mail${e.read_at ? '' : ' unread'}`}>
              <span className="who">{!e.read_at ? <span className="dot" aria-label="Unread" /> : null}{from.name || from.address}</span>
              <span className="subj">{e.subject}{e.attachments ? <span className="muted"> · {e.attachments} attachment{e.attachments > 1 ? 's' : ''}</span> : null}
                <span className="muted to"> to {e.to.map((t) => parseAddress(t).address.split('@')[0]).join(', ')}@</span></span>
              <span className="state">{e.replied_at ? <span className="tag tag-green">Replied</span> : null}</span>
              <span className="when">{when(e.created_at)}</span>
            </Link>
          );
        }) : <p style={{ padding: 18, margin: 0 }} className="muted">{show === 'archived' ? 'Nothing archived.' : show === 'unreplied' ? 'Everything has a reply.' : 'No emails yet.'}</p>}
      </section>
    </>
  );
}
