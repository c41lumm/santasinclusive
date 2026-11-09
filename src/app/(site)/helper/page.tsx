import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStaff, currentUserId } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { dayName } from '@/lib/dates';
import { roleLabel } from '@/lib/helper-roles';
import { signOut } from '../staff/actions';
import { ViewingAsBar } from '../../admin/viewing-as-bar';
import { respondToShift } from './actions';

export const metadata: Metadata = { title: 'My Grotto', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Shift = { id: string; day: string; name: string; starts: string; ends: string; status: string };
type TeamRow = { day: string; shift_name: string; starts: string; ends: string; name: string; role: string; status: string; is_me: boolean };
type Card = { booking_id: string; t: string; first_name: string; age: number | null; santa_hello: string | null; loves: string | null;
  dislikes: string | null; meet_preference: string | null; stage: string };
type Needs = { booking_id: string; first_name: string; communication: string[]; mobility: string[]; sensory: string[]; others: number };

const short = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Santas and elves: their shifts, and who is coming to see Santa during a shift. Santas see only the Santa cards
 * (no contact or health details); elves also see each visitor's needs. Admins and lead elves use the admin area.
 */
export default async function Helper({ searchParams }: { searchParams: Promise<{ day?: string; week?: string }> }) {
  if (!(await currentUserId())) redirect('/staff/sign-in');
  const me = await getStaff();
  if (!me) redirect('/staff/not-allowed');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const [shiftRows] = await asStaff((sql) => [sql`
    select s.id, s.day::text as day, s.name, to_char(s.starts_at, 'HH24:MI') as starts, to_char(s.ends_at, 'HH24:MI') as ends, a.status
    from shift_assignments a join shifts s on s.id = a.shift_id join volunteers v on v.id = a.volunteer_id
    where v.user_id = app.uid() and s.day >= ${today}::date order by s.day, s.starts_at`]);
  const allMine = shiftRows as Shift[];
  const shifts = allMine.filter((s) => s.status !== 'declined');
  const days = [...new Set(shifts.map((s) => s.day))];
  const sp = await searchParams;
  const day = days.includes(sp.day ?? '') ? sp.day! : days[0];
  const mine = shifts.filter((s) => s.day === day);
  const first = mine[0]?.starts, last = mine[mine.length - 1]?.ends;

  let cards: Card[] = [];
  let needs = new Map<string, Needs>();
  if (day && first && last) {
    const isElf = me.role !== 'santa';
    const [c, n] = await asStaff((sql) => [
      sql`select booking_id, to_char(starts_at, 'HH24:MI') as t, first_name, age, santa_hello, loves, dislikes, meet_preference, stage::text as stage
          from santa_cards where day = ${day}::date and starts_at >= ${first}::time and starts_at < ${last}::time order by starts_at, first_name`,
      isElf
        ? sql`select b.id as booking_id, v.first_name, v.communication, v.mobility, v.sensory,
                     (select count(*)::int from visitors o where o.booking_id = b.id and o.kind = 'sibling') as others
              from bookings b join slots sl on sl.id = b.slot_id join visitors v on v.booking_id = b.id and v.kind = 'visitor'
              where sl.day = ${day}::date and b.status in ('confirmed', 'attended')`
        : sql`select null where false`,
    ]);
    cards = c as Card[];
    needs = new Map((n as Needs[]).map((x) => [`${x.booking_id}:${x.first_name}`, x]));
  }

  // The whole team's rota, a week at a time from the chosen week
  const weekStart = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : (day ?? today);
  const weekEnd = new Date(new Date(`${weekStart}T12:00:00Z`).getTime() + 6 * 864e5).toISOString().slice(0, 10);
  const [teamRows] = await asStaff((sql) => [sql`
    select day::text as day, shift_name, to_char(starts_at, 'HH24:MI') as starts, to_char(ends_at, 'HH24:MI') as ends, name, role::text as role, status, is_me
    from team_rota(${weekStart}::date, ${weekEnd}::date)`]);
  const team = teamRows as TeamRow[];
  const teamShifts = [...new Map(team.map((r) => [`${r.day}|${r.shift_name}`, r])).values()];
  const shiftWeek = (d: string, by: number) => new Date(new Date(`${d}T12:00:00Z`).getTime() + by * 864e5).toISOString().slice(0, 10);
  const asked = shifts.filter((s) => s.status === 'asked').length;

  return (
    <div className="wrap" style={{ paddingBlock: '24px 72px', maxWidth: 1040 }}>
      <ViewingAsBar />
      <div className="admin-head" style={{ alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">My Grotto</p>
          <h1 className="green" style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', margin: 0 }}>Hello, {me.name.split(' ')[0]}</h1>
          <p style={{ margin: '6px 0 0' }}>You are helping as {me.role === 'santa' ? 'Santa' : me.role === 'elf' ? 'an elf' : roleLabel(me.role).toLowerCase()}. Thank you!</p>
        </div>
        <form action={signOut}><button className="link-button" type="submit">Sign out</button></form>
      </div>

      <section className="card" style={{ marginBottom: 24 }} aria-labelledby="shifts-h">
        <h2 id="shifts-h" className="green" style={{ fontSize: '1.5rem' }}>Your shifts</h2>
        {asked ? <p className="notice" style={{ marginTop: 0 }}>Please let us know if you can do {asked === 1 ? 'this shift' : `these ${asked} shifts`}.</p> : null}
        {shifts.length ? (
          <ul className="helper-shifts">
            {shifts.map((s) => (
              <li key={s.id} className={s.status}>
                <Link href={`/helper?day=${s.day}`} aria-current={s.day === day ? 'true' : undefined}>
                  <strong>{short(s.day)}</strong><span>{s.name}, {s.starts} to {s.ends}</span>
                </Link>
                {s.status === 'accepted' ? <span className="tag tag-green">You can do this</span> : (
                  <div className="btn-row" style={{ gap: 6 }}>
                    <form action={respondToShift.bind(null, s.id, true)}><button type="submit" className="btn btn-sm btn-green">I can do it</button></form>
                    <form action={respondToShift.bind(null, s.id, false)}><button type="submit" className="btn btn-sm btn-plain">I can&apos;t</button></form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p style={{ margin: 0 }}>You have no shifts yet. The organisers will email and text you when the rota is ready.</p>}
      </section>

      {day ? (
        <section aria-labelledby="visitors-h">
          <h2 id="visitors-h" className="green" style={{ fontSize: '1.5rem' }}>
            Coming to see Santa, {dayName(day)}{first && last ? <span className="muted" style={{ fontWeight: 400, fontSize: '1rem' }}> · {first} to {last}</span> : null}
          </h2>
          {me.role === 'santa' ? <p>What each visitor has told us, so you can greet them by name. Families shared this for their visit only: please keep it to yourself.</p>
            : <p>Who is coming during your shift and what helps them. Please keep these details to yourself.</p>}
          {cards.length ? (
            <div className="santa-cards">
              {cards.map((c) => {
                const n = needs.get(`${c.booking_id}:${c.first_name}`);
                const need = n ? [...n.communication, ...n.mobility, ...n.sensory] : [];
                return (
                  <article className="card santa-card" key={`${c.booking_id}-${c.first_name}`}>
                    <p className="slot-time">{c.t}</p>
                    <h3>{c.first_name}{c.age !== null ? <span>, {c.age}</span> : null}</h3>
                    {n?.others ? <p className="small muted" style={{ margin: '0 0 8px' }}>With {n.others} brother{n.others > 1 ? 's or sisters' : ' or sister'}</p> : null}
                    {need.length ? <div className="a-chips" style={{ marginBottom: 10 }}>{need.map((x) => <span key={x} className="tag tag-green">{x}</span>)}</div> : null}
                    {c.santa_hello ? <p className="hello">“{c.santa_hello}”</p> : null}
                    <dl className="a-dl">
                      <dt>Loves</dt><dd>{c.loves || 'Not told us'}</dd>
                      <dt>Avoid</dt><dd>{c.dislikes || 'Nothing we know of'}</dd>
                      <dt>Meeting Santa</dt><dd>{c.meet_preference || 'No preference given'}</dd>
                    </dl>
                  </article>
                );
              })}
            </div>
          ) : <p className="card">No visitors are booked during your shift yet.</p>}
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 24 }} aria-labelledby="team-h">
        <div className="admin-head" style={{ alignItems: 'center', marginBottom: 12 }}>
          <h2 id="team-h" className="green" style={{ fontSize: '1.5rem', margin: 0 }}>Team rota, {short(weekStart)} to {short(weekEnd)}</h2>
          <div className="btn-row" style={{ gap: 8 }}>
            <Link className="btn btn-sm btn-plain" href={`/helper?${new URLSearchParams({ ...(day ? { day } : {}), week: shiftWeek(weekStart, -7) })}#team-h`}>← Earlier</Link>
            <Link className="btn btn-sm btn-plain" href={`/helper?${new URLSearchParams({ ...(day ? { day } : {}), week: shiftWeek(weekStart, 7) })}#team-h`}>Later →</Link>
          </div>
        </div>
        {teamShifts.length ? (
          <div className="team-rota">
            {teamShifts.map((t) => (
              <div key={`${t.day}|${t.shift_name}`} className="team-shift">
                <p className="when"><strong>{short(t.day)}</strong> · {t.shift_name}, {t.starts} to {t.ends}</p>
                <ul>
                  {team.filter((r) => r.day === t.day && r.shift_name === t.shift_name).map((r) => (
                    <li key={r.name} className={r.is_me ? 'me' : undefined}>
                      {r.name.split(' ')[0]}{r.is_me ? ' (you)' : ''} <span className="muted">· {roleLabel(r.role)}{r.status === 'asked' ? ', not confirmed yet' : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : <p style={{ margin: 0 }}>No one is on the rota this week yet.</p>}
      </section>
    </div>
  );
}
