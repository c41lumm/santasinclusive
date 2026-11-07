import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/admin/data';
import { dayName } from '@/lib/dates';
import { roleLabel } from '@/lib/helper-roles';

export const metadata: Metadata = { title: 'Helper' };

type Helper = {
  user_id: string; name: string; role: string; staff_phone: string | null; added: string; added_by: string | null;
  email: string | null; account_created: string | null; last_sign_in: string | null;
};
type Vol = {
  id: string; status: string; role: string; phone: string; town: string | null; available_weeks: string[]; day_types: string[];
  experience: string | null; why: string | null; own_suit: boolean | null; applied: string;
  approved_by: string | null; approved_at: string | null;
};
type Shift = { day: string; name: string; starts: string; ends: string; role: string };

const when = (t: string) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const date = (t: string) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
const volStatus: Record<string, [string, string]> = {
  applied: ['Applied', 'tag-amber'], chat_booked: ['Chat booked', 'tag-amber'], checks_done: ['Checks done', 'tag-amber'],
  approved: ['Approved', 'tag-green'], declined: ['Declined', 'tag-grey'],
};

/** One helper's contact details, sign-in and volunteer information, and their shifts. Sign-in details are only readable by the server. */
export default async function HelperDetails({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin']);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sql = db();
  const [h] = await sql`
    select s.user_id::text as user_id, s.name, s.role::text as role, s.phone as staff_phone, s.created_at::text as added, s.added_by,
           u.email, u."createdAt"::text as account_created,
           (select max(ss."createdAt")::text from neon_auth.session ss where ss."userId" = s.user_id) as last_sign_in
    from staff s left join neon_auth."user" u on u.id = s.user_id where s.user_id = ${id}::uuid` as Helper[];
  if (!h) notFound();
  const [vol] = await sql`
    select id::text as id, status, role::text as role, phone, town, available_weeks, day_types, experience, why, own_suit, created_at::text as applied,
           approved_by, approved_at::text as approved_at
    from volunteers where user_id = ${id}::uuid` as Vol[];
  const shifts = vol ? await sql`
    select s.day::text as day, s.name, to_char(s.starts_at, 'HH24:MI') as starts, to_char(s.ends_at, 'HH24:MI') as ends, a.role::text as role
    from shift_assignments a join shifts s on s.id = a.shift_id
    where a.volunteer_id = ${vol.id}::uuid and s.day >= (now() at time zone 'Europe/London')::date order by s.day, s.starts_at` as Shift[] : [];
  const mobile = h.staff_phone || vol?.phone || '';
  const [vLabel, vCls] = vol ? volStatus[vol.status] ?? [vol.status, 'tag-grey'] : ['', ''];

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/admin">← Dashboard</Link></p>
      <div className="admin-head">
        <div>
          <h1>{h.name}</h1>
          <p>{roleLabel(h.role)}. Added {date(h.added)}{h.added_by ? ` by ${h.added_by}` : ''}.</p>
        </div>
        <span className="tag tag-grey" style={{ fontSize: '0.95rem', padding: '8px 14px' }}>{roleLabel(h.role)}</span>
      </div>

      <div className="a-split">
        <div className="a-main" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section className="a-panel" aria-labelledby="contact-h">
            <h2 id="contact-h">Contact details</h2>
            <dl className="a-dl">
              <dt>Email</dt><dd>{h.email ? <a href={`mailto:${h.email}`}>{h.email}</a> : 'Not known'}</dd>
              <dt>Mobile</dt><dd>{mobile ? <a href={`tel:${mobile.replace(/\s/g, '')}`}>{mobile}</a> : 'Not given'}</dd>
              {vol?.town ? <><dt>Town</dt><dd>{vol.town}</dd></> : null}
            </dl>
          </section>

          <section className="a-panel" aria-labelledby="vol-h">
            <h2 id="vol-h">Helping on the day</h2>
            {vol ? (
              <dl className="a-dl">
                <dt>Status</dt><dd><span className={`tag ${vCls}`}>{vLabel}</span> <Link href={`/admin/volunteers?show=${vol.status === 'approved' || vol.status === 'declined' ? vol.status : 'new'}`}>See on Helper applications</Link></dd>
                {vol.status === 'approved' ? <><dt>Approved</dt><dd>{vol.approved_by ? `By ${vol.approved_by}` : 'Yes'}{vol.approved_at ? `, ${date(vol.approved_at)}` : ''}</dd></> : null}
                <dt>On the rota as</dt><dd>{roleLabel(vol.role)}</dd>
                <dt>Can help</dt><dd>{[vol.available_weeks.join(', '), vol.day_types.join(', ')].filter(Boolean).join('; ') || 'Not given'}</dd>
                {vol.experience ? <><dt>Experience</dt><dd>{vol.experience}</dd></> : null}
                {vol.why ? <><dt>Why they help</dt><dd>{vol.why}</dd></> : null}
                {vol.role === 'santa' && vol.own_suit !== null ? <><dt>Own suit</dt><dd>{vol.own_suit ? 'Yes' : 'No'}</dd></> : null}
              </dl>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                {h.role === 'admin' ? 'Admins are not on the Helper rota.' : 'Not on the Helper rota yet. Change what they do on the Dashboard to add them.'}
              </p>
            )}
          </section>
        </div>

        <div className="a-side">
          <section className="a-panel" aria-labelledby="signin-h">
            <h2 id="signin-h">Signing in</h2>
            <dl className="a-dl">
              <dt>Last signed in</dt><dd>{h.last_sign_in ? when(h.last_sign_in) : 'Not yet. They may still need to set their password.'}</dd>
              {h.account_created ? <><dt>Account made</dt><dd>{date(h.account_created)}</dd></> : null}
            </dl>
            {!h.last_sign_in ? <p className="hint" style={{ marginBottom: 0 }}>If their email has gone missing, they can ask for a new link at the Helper login page: “Set or reset your password”.</p> : null}
          </section>

          <section className="a-panel" aria-labelledby="shifts-h">
            <h2 id="shifts-h">Coming up</h2>
            {shifts.length ? (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {shifts.map((s) => <li key={`${s.day}-${s.name}`} style={{ marginBottom: 6 }}><Link href="/admin/rota">{dayName(s.day)}</Link>, {s.name.toLowerCase()} ({s.starts} to {s.ends}), as {roleLabel(s.role).toLowerCase()}</li>)}
              </ul>
            ) : <p className="muted" style={{ margin: 0 }}>No shifts yet.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
