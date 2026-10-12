import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { adminSeason } from '@/lib/admin/data';
import { ageBandLabel, ageBands } from '@/lib/options';
import { addStock, setSiblingsGetGift } from './actions';
import { AddStock } from './add-stock';

export const metadata: Metadata = { title: 'Toy stock' };

const bandOf = (age: number | null) => age === null ? null : age <= 2 ? '0-2' : age <= 5 ? '3-5' : age <= 8 ? '6-8' : age <= 12 ? '9-12' : age <= 17 ? '13-17' : '18+';
const supplierName: Record<string, string> = { amazon: 'Amazon', alibaba: 'Alibaba', donated: 'Donated', other: 'Other' };

export default async function Toys() {
  const me = await requireStaff(['admin', 'lead_elf']);
  const season = await adminSeason();
  if (!season) return <div className="admin-head"><h1>Toy stock</h1><p>There is no season set up yet.</p></div>;
  const [visitors, items, feed] = await asStaff((sql) => [
    sql`select v.booking_id, v.kind::text as kind, v.age from visitors v join bookings b on b.id = v.booking_id
        where b.season = ${season.year} and b.status in ('pending_review', 'confirmed', 'attended')`,
    sql`select sl.gift_id, sl.name, sl.age_band, sl.category, sl.received::int as received, sl.on_the_way::int as on_the_way, sl.given::int as given,
               sl.in_stock::int as in_stock, (select string_agg(distinct o.supplier, ',') from stock_orders o where o.gift_id = sl.gift_id) as suppliers
        from stock_levels sl order by array_position(array['0-2','3-5','6-8','9-12','13-17','18+'], sl.age_band), sl.name`,
    sql`(select 'delivery' as kind, o.received_at as at, o.qty_received as qty, g.name as gift, o.supplier, st.name as who, null as visitor
         from stock_orders o join gifts g on g.id = o.gift_id left join staff st on st.user_id = o.received_by where o.received_at is not null)
        union all
        (select 'given', h.given_at, 1, g.name, null, st.name, v.first_name
         from gift_handouts h join gifts g on g.id = h.gift_id left join staff st on st.user_id = h.given_by left join visitors v on v.id = h.visitor_id)
        order by at desc limit 12`,
  ]) as unknown as [
    { booking_id: string; kind: string; age: number | null }[],
    { gift_id: string; name: string; age_band: string; category: string; received: number; on_the_way: number; given: number; in_stock: number; suppliers: string | null }[],
    { kind: string; at: string; qty: number; gift: string; supplier: string | null; who: string | null; visitor: string | null }[],
  ];

  const main = visitors.filter((v) => v.kind === 'visitor');
  const sibs = visitors.filter((v) => v.kind === 'sibling');
  const counted = season.siblings_get_gift ? visitors : main;
  const need = (b: string) => counted.filter((v) => bandOf(v.age) === b).length;
  const noAge = counted.filter((v) => v.age === null).length;
  const have = (b: string) => items.filter((i) => i.age_band === b).reduce((a, i) => a + i.in_stock, 0);
  const coming = (b: string) => items.filter((i) => i.age_band === b).reduce((a, i) => a + i.on_the_way, 0);
  const totalNeed = counted.length;
  const inStock = items.reduce((a, i) => a + i.in_stock, 0);
  const onWay = items.reduce((a, i) => a + i.on_the_way, 0);
  const given = items.reduce((a, i) => a + i.given, 0);
  const spare = inStock + onWay - totalNeed;
  const max = Math.max(1, ...ageBands.map((b) => Math.max(need(b), have(b) + coming(b))));
  const pct = (v: number) => `${(v / max) * 100}%`;
  const fmt = (ts: string) => new Date(ts).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

  return (
    <>
      <div className="admin-head">
        <div><h1>Toy stock</h1><p>Gifts needed from bookings so far, against what we have and what is on the way.</p></div>
        {me.role === 'admin' ? (
          <form action={setSiblingsGetGift.bind(null, season.year, !season.siblings_get_gift)}>
            <button type="submit" className={`btn ${season.siblings_get_gift ? 'btn-green' : 'btn-outline'}`} aria-pressed={season.siblings_get_gift}>
              Siblings get a gift: {season.siblings_get_gift ? 'yes' : 'no'}
            </button>
          </form>
        ) : null}
      </div>
      <section aria-label="Booked so far" className="a-stats">
        {[['Families booked', new Set(visitors.map((v) => v.booking_id)).size], ['Children with disabilities', main.filter((v) => v.age !== null && v.age < 18).length],
          ['Adults with disabilities', main.filter((v) => v.age !== null && v.age >= 18).length], ['Siblings coming', sibs.length]]
          .map(([l, v]) => (
            <div className="a-stat" key={l as string}><p className="label">{l}</p><p className="value">{v}</p></div>
          ))}
      </section>
      <section aria-label="Gifts" className="a-stats">
        <div className="a-stat"><p className="label">Gifts needed</p><p className="value">{totalNeed}</p><p className="small">{season.siblings_get_gift ? 'Visitors plus siblings' : 'Visitors only'}</p></div>
        <div className="a-stat" style={{ background: 'var(--pale-green)', color: 'var(--green)' }}><p className="label">In stock now</p><p className="value">{inStock}</p><p className="small">{given} already given out</p></div>
        <div className="a-stat" style={{ background: '#eef0f3', color: '#3d4a5c' }}><p className="label">On the way</p><p className="value">{onWay}</p><p className="small">Ordered, not yet arrived</p></div>
        <div className="a-stat" style={spare >= 0 ? { background: 'var(--pale-green)', color: 'var(--green)' } : { background: '#fdecec', color: 'var(--red)' }}>
          <p className="label">{spare >= 0 ? 'Spare' : 'Still to buy'}</p><p className="value">{Math.abs(spare)}</p><p className="small">{spare >= 0 ? 'After everything arrives' : 'Even after orders arrive'}</p></div>
      </section>

      <section aria-labelledby="age-h" className="a-panel">
        <h2 id="age-h">By age</h2>
        <p className="muted">The bar shows stock (green) and on the way (light green) against gifts needed (the dark marker).
          {noAge ? ` ${noAge} ${noAge === 1 ? 'visitor has' : 'visitors have'} no age yet, so are not in a band.` : ''}</p>
        {ageBands.map((b) => {
          const h = have(b), o = coming(b), n = need(b), diff = h + o - n;
          return (
            <div className="band-row" key={b}>
              <span style={{ fontWeight: 700 }}>{ageBandLabel(b)}</span>
              <div className="bar-track" aria-hidden="true">
                <div className="have" style={{ width: pct(h) }} />
                <div className="coming" style={{ left: pct(h), width: pct(o) }} />
                <div className="need" style={{ left: `calc(${pct(n)} - 1px)` }} />
              </div>
              <span style={{ fontSize: '0.9rem' }}>Need {n} · have {h}{o ? ` (+${o} coming)` : ''} · <strong style={{ color: diff >= 0 ? 'var(--green)' : 'var(--red)' }}>{diff >= 0 ? 'Covered' : `Short by ${-diff}`}</strong></span>
            </div>
          );
        })}
      </section>

      <div className="a-split">
        <section aria-labelledby="list-h" className="a-table a-main">
          <div className="bar" style={{ justifyContent: 'space-between' }}><h2 id="list-h" style={{ margin: 0, fontSize: '1.35rem' }}>Stock list</h2><span className="muted">{items.length} gifts</span></div>
          <div className="a-stock head" aria-hidden="true"><span>Gift</span><span>Ages</span><span>From</span><span>In stock</span><span>Coming</span><span>Given</span><span>Left</span></div>
          {items.length ? items.map((i) => (
            <div className="a-stock" key={i.gift_id}>
              <span><strong>{i.name}</strong><br /><span className="small">{i.category}</span>
                {i.on_the_way ? <><br /><span className="tag tag-grey" style={{ marginTop: 4 }}>Awaiting delivery</span></> : null}</span>
              <span>{ageBandLabel(i.age_band)}</span>
              <span>{(i.suppliers ?? '').split(',').filter(Boolean).map((s) => supplierName[s] ?? s).join(', ')}</span>
              <span style={{ fontWeight: 700 }}>{i.received}</span>
              <span className="muted">{i.on_the_way}</span>
              <span className="muted">{i.given}</span>
              <span style={{ fontWeight: 700, color: i.in_stock <= 5 ? 'var(--red)' : undefined }}>{i.in_stock}</span>
            </div>
          )) : <p style={{ padding: 18, margin: 0 }} className="muted">No gifts yet. Add the first below.</p>}
        </section>
        <aside className="a-side">
          {me.role === 'admin' ? <section aria-labelledby="add-h" className="a-panel"><h2 id="add-h">Add stock</h2><AddStock action={addStock} /></section> : null}
          <section aria-labelledby="feed-h" className="a-panel" style={{ background: 'var(--pale-green)', border: 0 }}>
            <h2 id="feed-h" className="green">From the elf app</h2>
            <p style={{ fontSize: '0.95rem' }}>Elves check in deliveries when they arrive, and record each gift they hand over. Both update the stock here straight away.</p>
            {feed.length ? (
              <ul className="a-feed">
                {feed.map((f, n) => (
                  <li key={n}>
                    {f.kind === 'delivery'
                      ? <><span className="tag tag-green">Delivery arrived</span><br /><strong>{f.qty} x {f.gift}</strong>{f.supplier ? ` from ${supplierName[f.supplier] ?? f.supplier}` : ''}<br /><span className="small">Checked in{f.who ? ` by ${f.who}` : ''}, {fmt(f.at)}</span></>
                      : <><strong>{f.gift}</strong>{f.visitor ? ` to ${f.visitor}` : ''}<br /><span className="small">{f.who ?? 'An elf'}, {fmt(f.at)}</span></>}
                  </li>
                ))}
              </ul>
            ) : <p className="small" style={{ margin: 0 }}>Nothing yet.</p>}
          </section>
        </aside>
      </div>
    </>
  );
}
