import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { setSponsorStatus, setToyStatus } from '../more-actions';

export const metadata: Metadata = { title: 'Sponsors and toys' };

type Sponsor = { id: string; company: string; contact_name: string; email: string; gifts: number; amount_pence: number; pay_method: string;
  show_on_wall: boolean; logo_requested: boolean; status: string; created_at: string };
const pounds = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
type Toys = { id: string; giver: string; company: string | null; contact_name: string; email: string; phone: string | null; toys: string;
  how_many: number | null; delivery: string; show_on_wall: boolean; status: string; created_at: string };
const toyStatus: Record<string, [string, string]> = { offered: ['New offer', 'tag-amber'], arranged: ['Arranged', 'tag-grey'], received: ['Received', 'tag-green'], cancelled: ['Cancelled', 'tag-red'] };
const deliveryText: Record<string, string> = { drop_off: 'Dropping off', collect: 'Wants them collected', post: 'Posting or delivering' };
const added = (t: string) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
const statusInfo: Record<string, [string, string]> = { pending: ['Waiting', 'tag-amber'], invoiced: ['Invoiced', 'tag-grey'], paid: ['Paid', 'tag-green'], cancelled: ['Cancelled', 'tag-red'] };

export default async function Sponsorship() {
  await requireStaff(['admin']);
  const [rows, toyRows] = await asStaff((sql) => [sql`
    select id, company, contact_name, email::text as email, gifts, amount_pence, pay_method, show_on_wall, logo_requested, status, created_at::text as created_at
    from sponsorships order by created_at desc`, sql`
    select id, giver, company, contact_name, email::text as email, phone, toys, how_many, delivery, show_on_wall, status, created_at::text as created_at
    from toy_donations order by status = 'cancelled', created_at desc`]);
  const offers = toyRows as Toys[];
  const liveOffers = offers.filter((t) => t.status !== 'cancelled');
  const list = rows as Sponsor[];
  const live = list.filter((s) => s.status !== 'cancelled');
  const paid = live.filter((s) => s.status === 'paid');
  return (
    <>
      <div className="admin-head"><div><h1>Sponsors and toys</h1><p>Companies sponsoring gifts, and people and companies donating toys.</p></div></div>
      <section aria-label="Totals" className="a-stats">
        <div className="a-stat"><p className="label">Gifts sponsored</p><p className="value">{live.reduce((a, s) => a + s.gifts, 0)}</p></div>
        <div className="a-stat"><p className="label">Promised</p><p className="value">{pounds(live.reduce((a, s) => a + s.amount_pence, 0))}</p></div>
        <div className="a-stat" style={{ background: 'var(--pale-green)', color: 'var(--green)' }}><p className="label">Paid</p><p className="value">{pounds(paid.reduce((a, s) => a + s.amount_pence, 0))}</p></div>
        <div className="a-stat"><p className="label">Toy offers</p><p className="value">{liveOffers.length}</p></div>
        <div className="a-stat"><p className="label">Toys received</p><p className="value">{offers.filter((t) => t.status === 'received').reduce((a, t) => a + (t.how_many ?? 0), 0)}</p></div>
      </section>
      <h2 style={{ margin: '8px 0 12px' }}>Toy donations</h2>
      <section className="a-panel" aria-label="Toy donations" style={{ marginBottom: 28 }}>
        {offers.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="simple-table">
              <thead><tr><th scope="col">From</th><th scope="col">Toys</th><th scope="col">Getting them to us</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Change</span></th></tr></thead>
              <tbody>{offers.map((t) => {
                const [label, cls] = toyStatus[t.status] ?? [t.status, 'tag-grey'];
                const change = (to: 'offered' | 'arranged' | 'received' | 'cancelled', l: string) => (
                  <form key={to} action={setToyStatus.bind(null, t.id, to)}><button type="submit" className="btn btn-sm btn-plain" aria-label={`${l}: ${t.company ?? t.contact_name}`}>{l}</button></form>
                );
                return (
                  <tr key={t.id}>
                    <td><strong>{t.company ?? t.contact_name}</strong>{t.company ? <><br /><span className="small">{t.contact_name}</span></> : null}
                      <br /><span className="small"><a href={`mailto:${t.email}`}>{t.email}</a>{t.phone ? <>, <a href={`tel:${t.phone}`}>{t.phone}</a></> : null}</span>
                      <br /><span className="small muted">Offered {added(t.created_at)}{t.show_on_wall ? ' · On the thank-you wall' : ''}</span></td>
                    <td style={{ maxWidth: 340 }}>{t.how_many ? <strong>About {t.how_many}: </strong> : null}<span style={{ whiteSpace: 'pre-wrap' }}>{t.toys}</span></td>
                    <td className="small">{deliveryText[t.delivery] ?? t.delivery}</td>
                    <td><span className={`tag ${cls}`}>{label}</span></td>
                    <td><div className="a-chips">
                      {t.status === 'offered' ? change('arranged', 'Arranged') : null}
                      {t.status === 'offered' || t.status === 'arranged' ? change('received', 'Received') : null}
                      {t.status === 'offered' || t.status === 'arranged' ? change('cancelled', 'Cancel') : null}
                      {t.status === 'received' || t.status === 'cancelled' ? change('offered', 'Undo') : null}
                    </div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>No toy offers yet. People offer toys on the Support page.</p>}
      </section>
      <h2 style={{ margin: '8px 0 12px' }}>Sponsors</h2>
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
