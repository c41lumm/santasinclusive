import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { addFlag, addNote, cancelNewer, decideDuplicate, removeFlag } from './actions';
import { FlagForm, NoteForm } from './check-forms';

export const metadata: Metadata = { title: 'Checks' };

type Side = { booking_id: string; name: string | null; contact: string | null; when: string; created: string; phone: string | null; email: string | null; postcode: string | null; status: string };
type Dup = { id: string; reasons: string[]; score: number; status: string; a: Side; b: Side };
type Flag = { id: string; label: string; email: string | null; phone_norm: string | null; reason: string; note: string; by: string | null; added: string; review_by: string };

const confidence = (d: Dup) => d.reasons.some((r) => ['Same email address', 'Same mobile number', 'Same home address'].includes(r)) && d.score >= 2
  ? 'Likely' : d.score >= 2 ? 'Check' : 'Unlikely';
const tone = (c: string) => (c === 'Likely' ? 'red' : c === 'Check' ? 'amber' : 'grey');
const reasonLabel: Record<string, string> = { eligibility_concern: 'Eligibility concern', repeat_duplicates: 'Repeated duplicate bookings', other: 'Other' };
const statusText: Record<string, string> = {
  cancelled_newer: 'Newer booking cancelled and the family messaged. The time was offered to the waitlist.',
  not_duplicate: 'Marked as not a duplicate. These two will not be flagged again.',
  contacting: 'Marked to contact the family. Both bookings stay until you decide.',
};

export default async function Checks({ searchParams }: { searchParams: Promise<{ tab?: string; sel?: string }> }) {
  await requireStaff(['admin']);
  const sp = await searchParams;
  const side = (b: string) => `json_build_object(
      'booking_id', ${b}.id, 'status', ${b}.status,
      'name', (select string_agg(v.first_name, ' and ') from visitors v where v.booking_id = ${b}.id and v.kind = 'visitor'),
      'contact', h_${b}.contact_name, 'phone', h_${b}.phone, 'email', h_${b}.email, 'postcode', h_${b}.postcode_norm, 'created', ${b}.created_at,
      'when', to_char(s_${b}.day, 'Dy DD Mon') || ', ' || to_char(s_${b}.starts_at, 'HH24:MI'))`;
  const [dups, flags] = await asStaff((sql) => [
    sql.query(`
      select d.id, d.reasons, d.score, d.status::text as status, ${side('a')} as a, ${side('b')} as b
      from duplicate_candidates d
      join bookings a on a.id = d.booking_a join slots s_a on s_a.id = a.slot_id left join households h_a on h_a.id = a.household_id
      join bookings b on b.id = d.booking_b join slots s_b on s_b.id = b.slot_id left join households h_b on h_b.id = b.household_id
      order by (d.status = 'open') desc, d.score desc, d.created_at desc`),
    sql`
      select f.id, f.label, f.email::text as email, f.phone_norm, f.reason::text as reason, f.note,
             st.name as by, to_char(f.created_at, 'FMDD Mon YYYY') as added, to_char(f.review_by, 'FMMonth YYYY') as review_by
      from flags f left join staff st on st.user_id = f.created_by where f.active order by f.created_at desc`,
  ]) as unknown as [Dup[], Flag[]];

  const tab = sp.tab === 'flags' ? 'flags' : 'dup';
  const openDups = dups.filter((d) => d.status === 'open').length;
  const selDup = tab === 'dup' ? dups.find((d) => d.id === sp.sel) ?? dups[0] : undefined;
  const selFlag = tab === 'flags' ? flags.find((f) => f.id === sp.sel) ?? flags[0] : undefined;
  const newer = (d: Dup) => (new Date(d.a.created) > new Date(d.b.created) ? d.a : d.b);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Checks</h1>
          <p>One visit per family, and visits kept for the people the grotto is for. Only admins can see this page.</p>
        </div>
      </div>
      <div className="a-chips" role="tablist" aria-label="Checks">
        <Link role="tab" aria-selected={tab === 'dup'} className={`chip${tab === 'dup' ? ' on' : ''}`} href="/admin/checks">Possible duplicates ({openDups})</Link>
        <Link role="tab" aria-selected={tab === 'flags'} className={`chip${tab === 'flags' ? ' on' : ''}`} href="/admin/checks?tab=flags">Flagged contacts ({flags.length})</Link>
      </div>

      <div className="a-split">
        <section aria-label="List" className="a-table a-main">
          {tab === 'dup' ? (dups.length ? dups.map((d) => {
            const c = confidence(d);
            return (
              <Link key={d.id} className="a-list-item" href={`/admin/checks?sel=${d.id}`} aria-current={d.id === selDup?.id ? 'true' : undefined}>
                <span className={`tag tag-${tone(c)}`}>{c} duplicate</span>
                <span className="body">
                  <span className="title">{d.a.name ?? d.a.contact} and {d.b.name ?? d.b.contact}</span>
                  <span className="sub">{d.a.when} and {d.b.when}</span>
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: d.status === 'open' ? '#8a5a00' : 'var(--green)' }}>{d.status === 'open' ? 'Needs a decision' : 'Resolved'}</span>
              </Link>
            );
          }) : <p style={{ padding: 20, margin: 0 }} className="muted">No possible duplicates.</p>)
          : (flags.length ? flags.map((f) => (
              <Link key={f.id} className="a-list-item" href={`/admin/checks?tab=flags&sel=${f.id}`} aria-current={f.id === selFlag?.id ? 'true' : undefined}>
                <span className="tag tag-amber">Flagged</span>
                <span className="body"><span className="title">{f.label}</span><span className="sub">{reasonLabel[f.reason]}, added {f.added}</span></span>
              </Link>
            )) : <p style={{ padding: 20, margin: 0 }} className="muted">No flagged contacts.</p>)}
        </section>

        <aside aria-label="Details" className="a-side" style={{ width: 430 }}>
          {selDup ? (
            <section className="a-panel">
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: `var(--${tone(confidence(selDup)) === 'amber' ? 'text' : tone(confidence(selDup)) === 'red' ? 'red' : 'muted'})` }}>{confidence(selDup)} duplicate</p>
              <h2 style={{ fontSize: '1.45rem', margin: '2px 0 12px' }}>{selDup.a.name ?? selDup.a.contact} and {selDup.b.name ?? selDup.b.contact}</h2>
              <div className="a-pair">
                {[selDup.a, selDup.b].map((p) => (
                  <div key={p.booking_id}>
                    <p style={{ fontWeight: 700 }}>{p.name ?? 'No visitor names yet'}</p>
                    <p>{p.when}{p.status === 'cancelled' ? ' (cancelled)' : ''}</p>
                    <p className="muted">{p.contact}</p><p className="muted">{p.phone}</p><p className="muted">{p.email}</p><p className="muted">{p.postcode}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontWeight: 700, marginBottom: 6 }}>Why it was flagged</p>
              <ul style={{ marginBottom: 16, paddingLeft: 20 }}>{selDup.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              {selDup.status !== 'open' ? (
                <p role="status" className="success" style={{ margin: 0, fontWeight: 700 }}>{statusText[selDup.status]}</p>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  <form action={cancelNewer.bind(null, selDup.id, newer(selDup).booking_id)}><button className="btn btn-block" type="submit">Cancel the newer booking and message the family</button></form>
                  <form action={decideDuplicate.bind(null, selDup.id, 'not_duplicate')}><button className="btn btn-outline btn-block" type="submit">Not a duplicate, keep both</button></form>
                  <form action={decideDuplicate.bind(null, selDup.id, 'contacting')}><button className="btn btn-plain btn-block" type="submit">Contact the family first</button></form>
                </div>
              )}
            </section>
          ) : selFlag ? (
            <section className="a-panel">
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#8a5a00' }}>Flagged contact</p>
              <h2 style={{ fontSize: '1.45rem', margin: '2px 0 12px' }}>{selFlag.label}</h2>
              <dl className="a-dl" style={{ gridTemplateColumns: '110px 1fr', marginBottom: 16 }}>
                <dt>Contact</dt><dd>{[selFlag.phone_norm ? `0${selFlag.phone_norm.slice(2)}` : null, selFlag.email].filter(Boolean).join(', ')}</dd>
                <dt>Reason</dt><dd>{reasonLabel[selFlag.reason]}</dd>
                <dt>What happened</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{selFlag.note}</dd>
                <dt>Added by</dt><dd>{selFlag.by ?? 'Admin'}, {selFlag.added}</dd>
                <dt>Review by</dt><dd>{selFlag.review_by}</dd>
                <dt>New bookings</dt><dd style={{ fontWeight: 700 }}>Held for review before confirming</dd>
              </dl>
              <form action={removeFlag.bind(null, selFlag.id)} style={{ marginBottom: 14 }}><button className="btn btn-outline btn-block" type="submit">Remove flag</button></form>
              <NoteForm action={addNote.bind(null, selFlag.id)} />
            </section>
          ) : (
            <div className="a-panel empty">{tab === 'dup' ? 'Nothing to check.' : 'No flags. Add one below if you need to.'}</div>
          )}
          <section className="a-note">
            <h3 style={{ fontSize: '1.15rem' }}>{tab === 'dup' ? 'How duplicates are found' : 'Using flags fairly'}</h3>
            <p>{tab === 'dup'
              ? 'The system compares every new booking with existing ones by mobile, email, home address and visitor name. Nothing is cancelled automatically: you decide. Siblings can share one visit, so the family is told that rather than refused.'
              : 'Many disabilities are not visible, so a flag records what was said or what happened, never a guess from how someone looks. Flags are only seen by admins, never by Santa or the elves. A flagged contact can still book: their booking is held for you to review. Flags are removed in January with the other season details.'}</p>
          </section>
          {tab === 'flags' ? <section className="a-panel"><h2>Add a flag</h2><FlagForm action={addFlag} /></section> : null}
        </aside>
      </div>

      <section className="a-panel" aria-labelledby="fam-h" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px' }}>
          <h2 id="fam-h" style={{ fontSize: '1.35rem', fontWeight: 600 }}>What families see when booking</h2>
          <p className="muted" style={{ margin: 0, fontSize: '0.95rem' }}>
            If the email or mobile already has a booking, no second one is made. So the booking form never reveals who has booked, the
            page just says to check their messages, and we send the existing booking to their own email or phone.
          </p>
        </div>
        <div style={{ flex: '1 1 420px', background: 'var(--cream)', border: '2px solid var(--line)', borderRadius: 18, padding: '18px 20px' }}>
          <p style={{ fontFamily: 'var(--heading)', fontWeight: 600, fontSize: '1.2rem', margin: '0 0 6px' }}>Your existing visit to Santa</p>
          <p style={{ margin: 0 }}>You already have a visit booked for Saturday 12 December at 10:20. We offer one visit per family so everyone gets a turn,
            and brothers and sisters can all come to the same visit. Change it here: [their link]</p>
        </div>
      </section>
    </>
  );
}
