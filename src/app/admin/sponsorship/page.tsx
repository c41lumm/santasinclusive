import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { setSponsorStatus } from '../more-actions';

export const metadata: Metadata = { title: 'Sponsorship' };

type Sponsor = { id: string; company: string; contact_name: string; email: string; gifts: number; amount_pence: number; pay_method: string;
  show_on_wall: boolean; logo_requested: boolean; status: string; created_at: string };
const pounds = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const statusInfo: Record<string, [string, string]> = { pending: ['Waiting', 'tag-amber'], invoiced: ['Invoiced', 'tag-grey'], paid: ['Paid', 'tag-green'], cancelled: ['Cancelled', 'tag-red'] };

export default async function Sponsorship() {
  await requireStaff(['admin']);
  const [rows] = await asStaff((sql) => [sql`
    select id, company, contact_name, email::text as email, gifts, amount_pence, pay_method, show_on_wall, logo_requested, status, created_at::text as created_at
    from sponsorships order by created_at desc`]);
  const list = rows as Sponsor[];
  const live = list.filter((s) => s.status !== 'cancelled');
  const paid = live.filter((s) => s.status === 'paid');
  return (
    <>
      <div className="admin-head"><div><h1>Sponsorship</h1><p>Businesses sponsoring gifts. Mark each one as invoiced and paid.</p></div></div>
      <section aria-label="Totals" className="a-stats">
        <div className="a-stat"><p className="label">Gifts sponsored</p><p className="value">{live.reduce((a, s) => a + s.gifts, 0)}</p></div>
        <div className="a-stat"><p className="label">Promised</p><p className="value">{pounds(live.reduce((a, s) => a + s.amount_pence, 0))}</p></div>
        <div className="a-stat" style={{ background: 'var(--pale-green)', color: 'var(--green)' }}><p className="label">Paid</p><p className="value">{pounds(paid.reduce((a, s) => a + s.amount_pence, 0))}</p></div>
      </section>
      <section className="a-panel" aria-label="Sponsors">
        {list.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="simple-table">
              <thead><tr><th scope="col">Business</th><th scope="col">Gifts</th><th scope="col">Amount</th><th scope="col">Extras</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Change</span></th></tr></thead>
              <tbody>{list.map((s) => {
                const [label, cls] = statusInfo[s.status] ?? [s.status, 'tag-grey'];
                const change = (to: 'pending' | 'invoiced' | 'paid' | 'cancelled', l: string) => (
                  <form key={to} action={setSponsorStatus.bind(null, s.id, to)}><button type="submit" className="btn btn-sm btn-plain" aria-label={`${l}: ${s.company}`}>{l}</button></form>
                );
                return (
                  <tr key={s.id}>
                    <td><strong>{s.company}</strong><br /><span className="small">{s.contact_name}, <a href={`mailto:${s.email}`}>{s.email}</a></span></td>
                    <td>{s.gifts}</td>
                    <td>{pounds(s.amount_pence)}<br /><span className="small">{s.pay_method === 'invoice' ? 'By invoice' : 'By card'}</span></td>
                    <td className="small">{[s.show_on_wall ? 'On the thank-you wall' : '', s.logo_requested ? 'Wants logo shown' : ''].filter(Boolean).join(', ') || 'None'}</td>
                    <td><span className={`tag ${cls}`}>{label}</span></td>
                    <td><div className="a-chips">
                      {s.status === 'pending' && s.pay_method === 'invoice' ? change('invoiced', 'Invoiced') : null}
                      {s.status === 'pending' || s.status === 'invoiced' ? change('paid', 'Paid') : null}
                      {s.status !== 'cancelled' && s.status !== 'paid' ? change('cancelled', 'Cancel') : null}
                      {s.status === 'cancelled' || s.status === 'paid' ? change('pending', 'Undo') : null}
                    </div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>No sponsors yet.</p>}
      </section>
    </>
  );
}
