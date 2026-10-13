import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { groupTimes } from '@/lib/options';
import { site } from '@/lib/site';
import { setGroupStatus } from '../more-actions';

export const metadata: Metadata = { title: 'Group enquiries' };

type Enquiry = { id: string; organisation: string; contact_name: string; role: string | null; email: string; phone: string; people: number;
  staff: number; age_range: string; weeks: string[]; time_pref: string[]; needs: string | null; status: string; created_at: string };
type Status = 'new' | 'offered' | 'booked' | 'declined';
const statusInfo: Record<string, [string, string]> = { new: ['New', 'tag-amber'], offered: ['Offered a time', 'tag-grey'], booked: ['Booked', 'tag-green'], declined: ['Declined', 'tag-red'] };
const tabs = [['open', 'To do'], ['booked', 'Booked'], ['declined', 'Declined']] as const;
const timeLabel = (v: string) => groupTimes.find((t) => t.value === v)?.label ?? v;
const next: Record<string, [string, Status][]> = {
  new: [['Offered a time', 'offered'], ['Booked', 'booked']],
  offered: [['Booked', 'booked'], ['Back to new', 'new']],
  booked: [['Back to offered', 'offered']],
  declined: [['Back to new', 'new']],
};

/** Schools and groups who asked for a visit on the /groups page. Reply by email or phone, then record where it got to. */
export default async function Groups({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff(['admin']);
  const sp = await searchParams;
  const show = tabs.some(([k]) => k === sp.show) ? sp.show! : 'open';
  const [rows] = await asStaff((sql) => [sql`
    select id, organisation, contact_name, role, email::text as email, phone, people, staff, age_range, weeks, time_pref, needs, status,
           created_at::text as created_at
    from group_enquiries order by created_at`]);
  const all = rows as Enquiry[];
  const inTab = (e: Enquiry) => (show === 'open' ? e.status === 'new' || e.status === 'offered' : e.status === show);
  const list = all.filter(inTab);
  const booked = all.filter((e) => e.status === 'booked');
  return (
    <>
      <div className="admin-head">
        <div><h1>Group enquiries</h1><p>Schools and groups who asked for a visit on the <a href="/groups">Schools and groups</a> page.</p></div>
      </div>
      <section aria-label="Totals" className="a-stats">
        <div className="a-stat"><p className="label">New</p><p className="value">{all.filter((e) => e.status === 'new').length}</p></div>
        <div className="a-stat"><p className="label">Offered a time</p><p className="value">{all.filter((e) => e.status === 'offered').length}</p></div>
        <div className="a-stat"><p className="label">Groups booked</p><p className="value">{booked.length}</p>
          <p className="small">{booked.reduce((a, e) => a + e.people, 0)} people, {booked.reduce((a, e) => a + e.staff, 0)} staff</p></div>
      </section>
      <div className="a-chips" role="group" aria-label="Show">
        {tabs.map(([k, l]) => <Link key={k} href={`/admin/groups?show=${k}`} className={`chip${show === k ? ' on' : ''}`} aria-current={show === k ? 'true' : undefined}>{l}</Link>)}
      </div>
      {list.length ? list.map((e) => {
        const [label, cls] = statusInfo[e.status] ?? [e.status, 'tag-grey'];
        const subject = encodeURIComponent(`Your visit to ${site.name}`);
        return (
          <section className="a-panel" key={e.id} aria-labelledby={`g-${e.id}`}>
            <div className="admin-head" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <h2 id={`g-${e.id}`} style={{ margin: 0 }}>{e.organisation} <span className={`tag ${cls}`}>{label}</span></h2>
                <p className="muted" style={{ margin: 0 }}>{e.contact_name}{e.role ? `, ${e.role}` : ''}</p>
              </div>
              <div className="a-chips">
                <a className="btn btn-sm" href={`mailto:${e.email}?subject=${subject}`}>Email {e.contact_name.split(' ')[0]}</a>
                {(next[e.status] ?? []).map(([l, s]) => (
                  <form key={s} action={setGroupStatus.bind(null, e.id, s)}><button type="submit" className="btn btn-sm btn-plain" aria-label={`${l}: ${e.organisation}`}>{l}</button></form>
                ))}
                {e.status === 'new' || e.status === 'offered' ? (
                  <form action={setGroupStatus.bind(null, e.id, 'declined')}><button type="submit" className="btn btn-sm btn-plain" aria-label={`Declined: ${e.organisation}`}>Declined</button></form>
                ) : null}
              </div>
            </div>
            <dl className="a-dl">
              <dt>Coming</dt><dd>{e.people} {e.people === 1 ? 'person' : 'people'} and {e.staff} staff, aged {e.age_range}</dd>
              <dt>Weeks</dt><dd>{e.weeks.join(', ') || 'Not given'}</dd>
              <dt>Times</dt><dd>{e.time_pref.map(timeLabel).join(', ') || 'Not given'}</dd>
              {e.needs ? <><dt>Needs</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{e.needs}</dd></> : null}
              <dt>Contact</dt><dd><a href={`mailto:${e.email}`}>{e.email}</a>, <a href={`tel:${e.phone.replace(/\s/g, '')}`}>{e.phone}</a></dd>
              <dt>Asked</dt><dd>{new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/London' })}</dd>
            </dl>
          </section>
        );
      }) : <section className="a-panel"><p className="muted" style={{ margin: 0 }}>{show === 'open' ? 'No enquiries waiting.' : 'None here.'}</p></section>}
      <section className="a-note"><p><strong>How it works.</strong> Reply to the group by email or phone and agree a time. Then add it on the
        {' '}<Link href="/admin/bookings">Bookings</Link> page (Add booking) and mark the enquiry Booked here.</p></section>
    </>
  );
}
