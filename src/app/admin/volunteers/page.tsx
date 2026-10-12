import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { setVolunteerStatus } from '../more-actions';

export const metadata: Metadata = { title: 'Volunteers' };

type Vol = { id: string; name: string; email: string; phone: string; role: string; town: string | null; available_weeks: string[];
  day_types: string[]; experience: string | null; why: string | null; own_suit: boolean | null; status: string; created_at: string };
const roleLabel: Record<string, string> = { santa: 'Santa', elf: 'Elf', lead_elf: 'Lead elf' };
const statusInfo: Record<string, [string, string]> = {
  applied: ['New', 'tag-amber'], chat_booked: ['Chat booked', 'tag-grey'], checks_done: ['Checks done', 'tag-grey'],
  approved: ['Approved', 'tag-green'], declined: ['Declined', 'tag-red'],
};
const tabs = [['new', 'To review'], ['approved', 'Approved'], ['declined', 'Declined']] as const;
const next: Record<string, [string, 'chat_booked' | 'checks_done' | 'approved'][]> = {
  applied: [['Chat booked', 'chat_booked'], ['Checks done', 'checks_done'], ['Approve', 'approved']],
  chat_booked: [['Checks done', 'checks_done'], ['Approve', 'approved']],
  checks_done: [['Approve', 'approved']],
};

export default async function Volunteers({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff(['admin']);
  const sp = await searchParams;
  const show = tabs.some(([k]) => k === sp.show) ? sp.show! : 'new';
  const [rows] = await asStaff((sql) => [sql`
    select id, name, email::text as email, phone, role::text as role, town, available_weeks, day_types, experience, why, own_suit, status,
           created_at::text as created_at
    from volunteers order by created_at`]);
  const all = rows as Vol[];
  const inTab = (v: Vol) => (show === 'new' ? !['approved', 'declined'].includes(v.status) : v.status === show);
  const list = all.filter(inTab);
  const approved = all.filter((v) => v.status === 'approved');
  return (
    <>
      <div className="admin-head">
        <div><h1>Volunteers</h1><p>Applications from the volunteer page. Approved volunteers appear on the <Link href="/admin/rota">Staff rota</Link>.</p></div>
      </div>
      <section aria-label="Totals" className="a-stats">
        <div className="a-stat"><p className="label">To review</p><p className="value">{all.filter((v) => !['approved', 'declined'].includes(v.status)).length}</p></div>
        <div className="a-stat"><p className="label">Approved Santas</p><p className="value">{approved.filter((v) => v.role === 'santa').length}</p></div>
        <div className="a-stat"><p className="label">Approved elves</p><p className="value">{approved.filter((v) => v.role !== 'santa').length}</p></div>
      </section>
      <div className="a-chips" role="group" aria-label="Show">
        {tabs.map(([k, l]) => <Link key={k} href={`/admin/volunteers?show=${k}`} className={`chip${show === k ? ' on' : ''}`} aria-current={show === k ? 'true' : undefined}>{l}</Link>)}
      </div>
      {list.length ? list.map((v) => {
        const [label, cls] = statusInfo[v.status] ?? [v.status, 'tag-grey'];
        return (
          <section className="a-panel" key={v.id} aria-labelledby={`v-${v.id}`}>
            <div className="admin-head" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <h2 id={`v-${v.id}`} style={{ margin: 0 }}>{v.name} <span className="tag tag-grey">{roleLabel[v.role] ?? v.role}</span> <span className={`tag ${cls}`}>{label}</span></h2>
                <p className="muted" style={{ margin: 0 }}>{v.email}, {v.phone}{v.town ? `, ${v.town}` : ''}</p>
              </div>
              <div className="a-chips">
                {(next[v.status] ?? []).map(([l, s]) => (
                  <form key={s} action={setVolunteerStatus.bind(null, v.id, s)}><button type="submit" className={`btn btn-sm${s === 'approved' ? '' : ' btn-plain'}`} aria-label={`${l}: ${v.name}`}>{l}</button></form>
                ))}
                {v.status !== 'declined' ? (
                  <form action={setVolunteerStatus.bind(null, v.id, 'declined')}><button type="submit" className="btn btn-sm btn-plain" aria-label={`Decline ${v.name}`}>Decline</button></form>
                ) : (
                  <form action={setVolunteerStatus.bind(null, v.id, 'applied')}><button type="submit" className="btn btn-sm btn-plain" aria-label={`Review ${v.name} again`}>Review again</button></form>
                )}
              </div>
            </div>
            <dl className="a-dl">
              <dt>Can help</dt><dd>{[v.available_weeks.join(', '), v.day_types.join(', ')].filter(Boolean).join('; ') || 'Not given'}</dd>
              {v.experience ? <><dt>Experience</dt><dd>{v.experience}</dd></> : null}
              {v.why ? <><dt>Why</dt><dd>{v.why}</dd></> : null}
              {v.role === 'santa' && v.own_suit !== null ? <><dt>Own suit</dt><dd>{v.own_suit ? 'Yes' : 'No'}</dd></> : null}
              <dt>Applied</dt><dd>{new Date(v.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/London' })}</dd>
            </dl>
          </section>
        );
      }) : <section className="a-panel"><p className="muted" style={{ margin: 0 }}>No one here.</p></section>}
      <section className="a-note"><p><strong>Before approving.</strong> Have a chat with each volunteer and make sure their checks (such as DBS) are done.
        Approving adds them to the rota.</p></section>
    </>
  );
}
