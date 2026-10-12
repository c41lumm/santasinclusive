import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { adminSeason } from '@/lib/admin/data';
import { availability, canDo, rotaData, type Shift, type Volunteer } from '@/lib/admin/rota';
import { dayName, dayParts } from '@/lib/dates';
import { assign, makeShifts, sendRota, setNeeded, unassign } from './actions';
import { SendRota } from './send-rota';

export const metadata: Metadata = { title: 'Staff rota' };

/** Monday-to-Sunday weeks of the season */
function weeksOf(days: string[]) {
  const weeks: string[][] = [];
  for (const d of days) {
    const monday = new Date(`${d}T12:00:00Z`).getUTCDay() === 1;
    if (!weeks.length || monday) weeks.push([]);
    weeks[weeks.length - 1].push(d);
  }
  return weeks;
}
const short = (d: string) => `${Number(d.slice(8, 10))} ${dayParts(d).month.slice(0, 3)}`;

export default async function Rota({ searchParams }: { searchParams: Promise<{ week?: string; shift?: string }> }) {
  await requireStaff(['admin', 'lead_elf']);
  const sp = await searchParams;
  const season = await adminSeason();
  if (!season) return <div className="admin-head"><h1>Staff rota</h1><p>There is no season set up yet.</p></div>;
  const { vols, shifts } = await rotaData(season.year);
  if (!shifts.length) {
    return (
      <>
        <div className="admin-head"><div><h1>Staff rota</h1><p>Santas and elves for every shift, from volunteers&apos; availability.</p></div></div>
        <div className="a-panel" style={{ maxWidth: 640 }}>
          <h2>No shifts yet</h2>
          <p>Create a morning and an afternoon shift for every open day. Their times follow each day&apos;s opening hours, and you can change how
            many Santas and elves each one needs.</p>
          <form action={makeShifts.bind(null, season.year)}><button className="btn" type="submit">Create this season&apos;s shifts</button></form>
        </div>
      </>
    );
  }

  const days = [...new Set(shifts.map((s) => s.day))];
  const weeks = weeksOf(days);
  const wi = Math.min(Math.max(0, Number(sp.week ?? 0) || 0), weeks.length - 1);
  const week = weeks[wi];
  const weekShifts = shifts.filter((s) => week.includes(s.day));
  const byId = new Map(vols.map((v) => [v.id, v]));
  const onShift = (s: Shift, role: 'santa' | 'elf') => s.people.filter((p) => (role === 'santa' ? p.role === 'santa' : p.role !== 'santa'));
  const gapOf = (s: Shift) => Math.max(0, s.santas_needed - onShift(s, 'santa').length) + Math.max(0, s.elves_needed - onShift(s, 'elf').length);
  const sel = weekShifts.find((s) => s.id === sp.shift) ?? weekShifts[0];
  const label = `${short(week[0])} to ${short(week[week.length - 1])}`;
  const people = new Set(weekShifts.flatMap((s) => s.people.map((p) => p.volunteer_id)));
  const gaps = weekShifts.reduce((a, s) => a + gapOf(s), 0);

  const roleBlock = (s: Shift, role: 'santa' | 'elf') => {
    const title = role === 'santa' ? 'Santas' : 'Elves';
    const needed = role === 'santa' ? s.santas_needed : s.elves_needed;
    const on = onShift(s, role);
    const pool = vols.filter((v) => (role === 'santa' ? v.role === 'santa' : v.role !== 'santa') && !s.people.some((p) => p.volunteer_id === v.id));
    const free = pool.filter((v) => canDo(v, s.day));
    const away = pool.filter((v) => !canDo(v, s.day));
    const nameOf = (v: Volunteer | undefined) => (v ? (role === 'santa' ? v.name : `Elf ${v.name.split(' ')[0]}`) : 'Someone');
    return (
      <div className="a-panel" key={role}>
        <div className="admin-head" style={{ alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{title}</h3>
          <div className="stepper">
            <span className="muted" style={{ fontSize: '0.9rem' }}>Needed</span>
            <form action={setNeeded.bind(null, s.id, role, -1)}><button type="submit" aria-label={`Fewer ${title.toLowerCase()} needed`}>−</button></form>
            <span className="val" style={{ minWidth: 40 }}>{needed}</span>
            <form action={setNeeded.bind(null, s.id, role, 1)}><button type="submit" aria-label={`More ${title.toLowerCase()} needed`}>+</button></form>
          </div>
        </div>
        {on.map((p) => (
          <div className="person-row" key={p.volunteer_id}>
            <span style={{ fontWeight: 700 }}>{nameOf(byId.get(p.volunteer_id))}</span>
            <form action={unassign.bind(null, s.id, p.volunteer_id)}><button type="submit" className="btn btn-plain btn-sm" aria-label={`Remove ${byId.get(p.volunteer_id)?.name ?? 'this person'}`}>Remove</button></form>
          </div>
        ))}
        {Array.from({ length: Math.max(0, needed - on.length) }, (_, i) => <div className="gap-row" key={i}>{role === 'santa' ? 'Santa' : 'Elf'} needed</div>)}
        <p style={{ fontWeight: 700, margin: '12px 0 6px', fontSize: '0.9rem' }}>Available to add</p>
        <div className="a-chips">
          {free.length ? free.map((v) => (
            <form key={v.id} action={assign.bind(null, s.id, v.id, role)}><button type="submit" className="chip" aria-label={`Add ${v.name}`}>+ {v.name}</button></form>
          )) : <span className="small">No one else is available that day.</span>}
        </div>
        {away.length ? <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>Not available: {away.map((v) => `${v.name} (${availability(v)})`).join(', ')}</p> : null}
      </div>
    );
  };

  return (
    <>
      <div className="admin-head">
        <div><h1>Staff rota</h1><p>Santas and elves for every shift, from volunteers&apos; availability.</p></div>
        <div style={{ minWidth: 260 }}>
          <SendRota action={sendRota.bind(null, season.year, week[0], week[week.length - 1], label)} />
        </div>
      </div>
      <div className="admin-head" style={{ alignItems: 'center' }}>
        <div className="a-chips" role="group" aria-label="Choose a week">
          {weeks.map((w, i) => (
            <Link key={w[0]} className={`chip${i === wi ? ' on' : ''}`} aria-current={i === wi ? 'true' : undefined} href={`/admin/rota?week=${i}`}>
              {short(w[0])} to {short(w[w.length - 1])}
            </Link>
          ))}
        </div>
        <p style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <span><strong style={{ color: 'var(--green)' }}>{weekShifts.filter((s) => !gapOf(s)).length}/{weekShifts.length}</strong> shifts covered</span>
          <span><strong style={{ color: gaps ? 'var(--red)' : 'var(--green)' }}>{gaps}</strong> {gaps === 1 ? 'person' : 'people'} needed</span>
          <span><strong>{people.size}</strong> volunteers this week</span>
        </p>
      </div>
      {!vols.length ? (
        <div className="a-note"><p>No volunteers are approved yet. Approve them on the <Link href="/admin/volunteers">Volunteers</Link> page and they will appear here.</p></div>
      ) : null}

      <div className="a-split">
        <section aria-label="Week" className="a-main week-grid">
          {week.map((d) => {
            const p = dayParts(d);
            const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
            return (
              <div className="week-day" key={d}>
                <div className={`head${wd === 0 || wd === 6 ? ' weekend' : ''}`}><span>{p.weekday}</span><span>{p.date}</span></div>
                {weekShifts.filter((s) => s.day === d).map((s) => {
                  const g = gapOf(s);
                  const sGap = Math.max(0, s.santas_needed - onShift(s, 'santa').length), eGap = Math.max(0, s.elves_needed - onShift(s, 'elf').length);
                  const gapText = [sGap ? `${sGap} Santa` : '', eGap ? `${eGap} ${eGap > 1 ? 'elves' : 'elf'}` : ''].filter(Boolean).join(' and ');
                  return (
                    <Link key={s.id} href={`/admin/rota?week=${wi}&shift=${s.id}`} className={`shift${g ? ' gap' : ''}`} aria-current={s.id === sel?.id ? 'true' : undefined}
                      aria-label={`${dayName(d)}, ${s.name}${g ? `, ${gapText} needed` : ', fully covered'}`}>
                      <span className="label">{s.name}</span>
                      {s.people.map((pp) => {
                        const v = byId.get(pp.volunteer_id);
                        return <span key={pp.volunteer_id} className={`p${pp.role === 'santa' ? ' santa' : ''}`}>{pp.role === 'santa' ? v?.name : `Elf ${v?.name.split(' ')[0]}`}</span>;
                      })}
                      {g ? <span className="need">{gapText} needed</span> : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </section>
        {sel ? (
          <aside aria-label="Shift details" className="a-side">
            <div>
              <p className="muted" style={{ margin: 0 }}>{sel.starts} to {sel.ends}</p>
              <h2 style={{ fontSize: '1.45rem', margin: 0 }}>{dayName(sel.day)}, {sel.name}</h2>
            </div>
            {roleBlock(sel, 'santa')}
            {roleBlock(sel, 'elf')}
          </aside>
        ) : null}
      </div>
      <section className="a-note">
        <p><strong>How it works.</strong> Each volunteer&apos;s availability comes from their application. Only approved volunteers who said they could do
          that day are offered for a shift. Sending the rota messages each person their own shifts for the week by email and text.</p>
      </section>
    </>
  );
}
