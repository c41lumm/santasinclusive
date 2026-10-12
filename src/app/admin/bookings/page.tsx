import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { adminSeason, dayRows, openingDays, type DayRow } from '@/lib/admin/data';
import { dayName, dayParts, visitWhen } from '@/lib/dates';
import { templates } from '@/lib/notify/templates';
import { cancelBooking, confirmBooking, markArrived, sendMessages } from './actions';
import { Composer } from './composer';

export const metadata: Metadata = { title: 'Bookings' };

type Search = { day?: string; sel?: string; filter?: string; compose?: string; cancel?: string };

const surnameInitial = (contact: string | null) => {
  const last = contact?.trim().split(/\s+/).slice(1).at(-1);
  return last ? ` ${last[0].toUpperCase()}.` : '';
};
const mainNames = (r: DayRow) => (r.visitors ?? []).filter((v) => v.kind === 'visitor').map((v) => v.name);
const displayName = (r: DayRow) => r.type === 'group'
  ? r.group_name ?? r.contact_name ?? 'Group'
  : `${mainNames(r).join(' and ') || r.contact_name || 'Not told us yet'}${mainNames(r).length === 1 ? surnameInitial(r.contact_name) : ''}`;
const party = (r: DayRow) => {
  if (r.type === 'group') return `${(r.visitors ?? []).length || '?'} visiting${r.group_staff ? `, ${r.group_staff} staff` : ''}`;
  const others = (r.visitors ?? []).filter((v) => v.kind === 'sibling').length;
  return `${mainNames(r)[0] ?? 'Visitor'}${others ? ` + ${others} family` : ''}`;
};
const needs = (r: DayRow) => [...new Set((r.visitors ?? []).filter((v) => v.kind === 'visitor').flatMap((v) => [...v.communication, ...v.mobility, ...v.sensory]))];
const status = (r: DayRow): { label: string; tone: string } => {
  if (r.status === 'pending_review') return { label: 'Held for review', tone: 'amber' };
  if (r.status === 'attended') return { label: 'Visited', tone: 'green' };
  if (r.status === 'no_show') return { label: 'Did not come', tone: 'red' };
  if (r.stage === 'arrived' || r.stage === 'with_santa') return { label: 'Arrived', tone: 'green' };
  if (r.reply === 'confirmed') return { label: 'Confirmed', tone: 'green' };
  if (r.reply === 'no_reply') return { label: 'No reply', tone: 'red' };
  return r.asked_to_confirm ? { label: 'Awaiting reply', tone: 'grey' } : { label: 'Booked', tone: 'grey' };
};

export default async function Bookings({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requireStaff(['admin', 'lead_elf']);
  const sp = await searchParams;
  const season = await adminSeason();
  if (!season) return <div className="admin-head"><h1>Bookings</h1><p>There is no season set up yet.</p></div>;
  const days = await openingDays(season.year);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const day = days.find((d) => d.day === sp.day)?.day ?? days.find((d) => d.day >= today)?.day ?? days[0]?.day;
  if (!day) return <div className="admin-head"><h1>Bookings</h1><p>No opening days are set up yet. Add them on Visit times.</p></div>;

  const rows = await dayRows(day);
  const bookings = rows.filter((r) => r.id);
  const active = bookings.filter((r) => r.status === 'confirmed' || r.status === 'pending_review');
  const filter = ['family', 'group'].includes(sp.filter ?? '') ? sp.filter : 'all';
  const freeTimes = rows.filter((r) => !r.id && !r.blocked && !r.offered_to && !rows.some((o) => o.slot_id === r.slot_id && o.id));
  const sel = bookings.find((r) => r.id === sp.sel);
  const base = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ day, filter: filter === 'all' ? undefined : filter, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `/admin/bookings?${q}`;
  };
  // One row per slot when it is free or a break; one per booking otherwise
  const seen = new Set<string>();
  const listed = rows.filter((r) => {
    if (r.id) return filter === 'all' || r.type === filter;
    if (seen.has(r.slot_id)) return false;
    seen.add(r.slot_id);
    return filter === 'all';
  });

  const preview = (name: string, when: string) => {
    const v = { name, when, token: 'link', reference: 'SIG-…' };
    const tidy = (s: string) => s.replace(/https?:\/\/\S*\/booking\/link(\/confirm)?|\/booking\/link(\/confirm)?/g, '[their link]');
    return {
      reminder: tidy(templates.reminder7d(v).text), confirm: tidy(templates.confirm48h(v).text),
      details: tidy(templates.missingDetails(v).text), late: templates.runningLate().text,
    };
  };

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Bookings</h1>
          <p>{dayName(day)} {season.year}{season.booking_open ? '' : ' · public booking is closed'}</p>
        </div>
        <div className="btn-row">
          <Link className="btn btn-outline" href={base({ compose: 'day' })}>Message everyone this day</Link>
          <Link className="btn" href={`/admin/bookings/new?day=${day}`}>Add booking</Link>
        </div>
      </div>

      <ul className="a-days" aria-label="Choose a day">
        {days.map((d) => {
          const p = dayParts(d.day);
          return (
            <li key={d.day}>
              <Link className="a-day" href={`/admin/bookings?day=${d.day}`} aria-current={d.day === day ? 'date' : undefined}
                aria-label={`${dayName(d.day)}, ${d.booked} booked`}>
                <span className="wd">{p.weekday}</span><span className="n">{p.date}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="a-stats">
        {[
          { label: 'Visits booked', value: active.length, color: 'var(--text)' },
          { label: 'Times free', value: freeTimes.length, color: 'var(--green)' },
          { label: 'Breaks', value: new Set(rows.filter((r) => r.blocked).map((r) => r.slot_id)).size, color: 'var(--text)' },
          { label: 'Details missing', value: active.filter((r) => !r.details_complete).length, color: '#8a5a00' },
          { label: 'Not yet confirmed', value: active.filter((r) => r.reply !== 'confirmed').length, color: 'var(--red)' },
        ].map((s) => (
          <div className="a-stat" key={s.label}><p className="label">{s.label}</p><p className="value" style={{ color: s.color }}>{s.value}</p></div>
        ))}
      </div>

      <div className="a-split">
        <section aria-label="Bookings for the day" className="a-table a-main">
          <div className="bar" role="group" aria-label="Show">
            {[['all', 'Everyone'], ['family', 'Families'], ['group', 'Groups']].map(([k, l]) => (
              <Link key={k} className="chip" aria-current={filter === k ? 'true' : undefined}
                href={`/admin/bookings?day=${day}${k === 'all' ? '' : `&filter=${k}`}`}>{l}</Link>
            ))}
          </div>
          <div className="a-row head" aria-hidden="true">
            <span>Time</span><span>Visitor</span><span>Type</span><span>Party</span><span>Needs</span><span>Details</span><span>Status</span>
          </div>
          {listed.length ? listed.map((r) => {
            if (!r.id) {
              if (r.offered_to) {
                return <div key={r.slot_id} className="a-row other"><span className="t">{r.t}</span><span>Held for {r.offered_to}, from the waitlist</span></div>;
              }
              return r.blocked
                ? <div key={r.slot_id} className="a-row other break"><span className="t">{r.t}</span><span>Break</span></div>
                : <Link key={r.slot_id} className="a-row other" href={`/admin/bookings/new?day=${day}&slot=${r.slot_id}`}>
                    <span className="t">{r.t}</span><span>Available<span className="visually-hidden">, add a booking</span></span>
                  </Link>;
            }
            const s = status(r);
            return (
              <Link key={r.id} className="a-row" href={base({ sel: r.id })} aria-current={r.id === sel?.id ? 'true' : undefined}>
                <span className="t">{r.t}</span>
                <span className="name">{displayName(r)}</span>
                <span className="muted">{r.type === 'group' ? 'Group' : 'Family'}</span>
                <span className="muted">{party(r)}</span>
                <span className="needs">{needs(r).join(', ') || '—'}</span>
                <span className={`tag ${r.details_complete ? 'tag-green' : 'tag-amber'}`}>{r.details_complete ? 'Complete' : 'Missing'}</span>
                <span className={`tag tag-${s.tone}`}>{s.label}</span>
              </Link>
            );
          }) : <p style={{ padding: 18, margin: 0 }} className="muted">No bookings to show.</p>}
        </section>

        <aside aria-label="Booking details" className="a-side">
          {sp.compose === 'day' ? (
            <Composer to={`Every family booked on ${dayName(day)} (${active.length})`}
              previews={preview('your visitor', dayName(day))} action={sendMessages.bind(null, active.map((r) => r.id!))} />
          ) : sel ? (
            <>
              <BookingPanel r={sel} day={day} isAdmin={me.role === 'admin'} base={base} confirmCancel={sp.cancel === '1'} />
              {sp.compose === 'one' ? (
                <Composer to={`${displayName(sel)}${sel.phone ? `, ${sel.phone}` : ''}${sel.email ? `, ${sel.email}` : ''}`}
                  previews={preview(mainNames(sel)[0] ?? 'your visitor', visitWhen(day, sel.t))}
                  action={sendMessages.bind(null, [sel.id!])} defaultTemplate={sel.details_complete ? 'reminder' : 'details'} />
              ) : null}
            </>
          ) : (
            <div className="a-panel empty">Select a booking to see the visitor&apos;s details and send a message.</div>
          )}
        </aside>
      </div>
    </>
  );
}

function BookingPanel({ r, day, isAdmin, base, confirmCancel }: {
  r: DayRow; day: string; isAdmin: boolean; base: (e: Record<string, string | undefined>) => string; confirmCancel: boolean;
}) {
  const main = (r.visitors ?? []).filter((v) => v.kind === 'visitor');
  const health = main.flatMap((v) => [v.condition, v.medical, v.other].filter(Boolean).map((t) => `${main.length > 1 ? `${v.name}: ` : ''}${t}`));
  const join = (xs: (string | null | undefined)[]) => xs.filter(Boolean).join('; ') || 'Not given yet';
  const pick = (f: (v: (typeof main)[number]) => string | null | undefined) =>
    join(main.map((v) => { const x = f(v); return x ? (main.length > 1 ? `${v.name}: ${x}` : x) : null; }));
  const active = r.status === 'confirmed' || r.status === 'pending_review';
  const prefers = (r.channels ?? []).map((c) => (c === 'sms' ? 'text' : c)).join(' and ');
  return (
    <section className="a-panel">
      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>{r.t} · {r.type === 'group' ? 'Group' : 'Family'} · {r.reference}</p>
      <h2 style={{ fontSize: '1.6rem', margin: '2px 0 4px' }}>{displayName(r)}</h2>
      <p className="muted" style={{ marginBottom: 14 }}>{party(r)}{(r.visitors ?? []).length > 1 ? `: ${(r.visitors ?? []).map((v) => `${v.name}${v.age !== null ? ` (${v.age})` : ''}`).join(', ')}` : ''}</p>
      {needs(r).length ? <div className="a-chips" style={{ marginBottom: 14 }}>{needs(r).map((n) => <span key={n} className="tag tag-green">{n}</span>)}</div> : null}
      <dl className="a-dl">
        <dt>Loves</dt><dd>{pick((v) => v.loves)}</dd>
        <dt>Avoid</dt><dd>{pick((v) => v.dislikes)}</dd>
        <dt>Calming</dt><dd>{pick((v) => v.calming)}</dd>
        <dt>Meets Santa</dt><dd>{pick((v) => v.meet)}</dd>
        <dt>Gift</dt><dd>{pick((v) => v.gift)}</dd>
        {health.length ? <><dt>Health</dt><dd>{health.join('; ')}</dd></> : null}
        <dt>Contact</dt>
        <dd>{r.contact_name}{r.phone ? <><br />{r.phone}</> : null}{r.email ? <><br />{r.email}</> : null}
          {prefers ? <><br /><span className="muted">Prefers {prefers}</span></> : null}</dd>
      </dl>
      {active ? (
        confirmCancel ? (
          <div className="notice" style={{ marginTop: 18 }}>
            <p><strong>Cancel this visit?</strong> The family will get a message, and the time goes to the waitlist.</p>
            <div className="btn-row">
              <form action={cancelBooking.bind(null, r.id!, day)}><button className="btn" type="submit">Yes, cancel it</button></form>
              <Link href={base({ sel: r.id! })} style={{ fontWeight: 700 }}>Keep it</Link>
            </div>
          </div>
        ) : (
          <div className="a-actions">
            {r.status === 'pending_review' && isAdmin ? (
              <form action={confirmBooking.bind(null, r.id!)}><button className="btn btn-green wide" type="submit">Confirm this booking</button></form>
            ) : null}
            <Link className="btn btn-green wide" href={base({ sel: r.id!, compose: 'one' })}>Send a message</Link>
            <Link className="btn btn-plain" href={`/admin/bookings/${r.id}/move?day=${day}`}>Move</Link>
            {r.stage === 'waiting' ? (
              <form action={markArrived.bind(null, r.id!)}><button className="btn btn-plain" type="submit" style={{ width: '100%' }}>Mark arrived</button></form>
            ) : <span className="btn btn-plain" aria-disabled="true">Arrived</span>}
            <Link className="btn btn-danger wide" href={base({ sel: r.id!, cancel: '1' })}>Cancel and offer to waitlist</Link>
          </div>
        )
      ) : null}
    </section>
  );
}
