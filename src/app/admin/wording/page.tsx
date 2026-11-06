import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { messageDefs, type TemplateName } from '@/lib/notify/templates';
import { savedWording } from '@/lib/notify/wording';

export const metadata: Metadata = { title: 'Message wording' };

const when = (t: string) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

export default async function Wording() {
  await requireStaff(['admin']);
  const saved = await savedWording();
  const names = Object.keys(messageDefs) as TemplateName[];
  const groups = ['Bookings', 'Waitlist', 'Other'] as const;
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Message wording</h1>
          <p>Change what the emails and texts say. The same wording is used for email and text. Changes are used from the next message sent.</p>
        </div>
      </div>
      {groups.map((g) => (
        <section key={g} className="a-panel" aria-labelledby={`g-${g}`}>
          <h2 id={`g-${g}`}>{g}</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="simple-table">
              <thead><tr><th scope="col">Message</th><th scope="col">When it is sent</th><th scope="col">Wording</th></tr></thead>
              <tbody>
                {names.filter((n) => messageDefs[n].group === g).map((n) => {
                  const s = saved.get(n);
                  return (
                    <tr key={n}>
                      <td><Link href={`/admin/wording/${n}`} style={{ fontWeight: 700 }}>{messageDefs[n].label}</Link></td>
                      <td>{messageDefs[n].when}</td>
                      <td>{s ? <span className="tag tag-green">Changed {when(s.updated_at)}</span> : <span className="tag tag-grey">Original</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
