'use server';
import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { requireStaff, viewingAs, type StaffRole } from '@/lib/auth/staff';
import { asStaff, db } from '@/lib/db';
import { adminSeason, isUuid } from '@/lib/admin/data';
import { encryptSecret, phoneNorm, placeholderEmail } from '@/lib/auth/phone';
import { optionalMobile } from '@/lib/booking-schema';
import { volunteerDayTypes, volunteerWeeks } from '@/lib/options';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { all, problem, text, type FormState } from '@/lib/forms';

/*
 * Helpers are the people who can sign in to the admin. Each has a Neon Auth sign-in account (email and password)
 * and a row in `staff` that gives their role here. Neon Auth's admin tools create the account; they run as the
 * signed-in admin, so admins here are also "admin" in Neon Auth (kept in step below).
 */

const roles = ['admin', 'lead_elf', 'elf', 'santa'] as const;
const authRole = (r: StaffRole) => (r === 'admin' ? 'admin' : 'user');
const NO_AUTH_ADMIN = 'Your sign-in account cannot manage helpers yet. Ask whoever set up the site to make you an admin in Neon Auth.';

async function origin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL || `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
}

/** Problems the database would also refuse: removing or demoting the last admin, or yourself */
async function guard(me: { userId: string }, userId: string, newRole: StaffRole | null) {
  if (userId === me.userId) return newRole === 'admin' ? null : 'You cannot remove or change your own access. Ask another admin.';
  const [admins] = await asStaff((sql) => [sql`select user_id from staff where role = 'admin'`]) as unknown as [{ user_id: string }[]];
  const isAdmin = admins.some((a) => a.user_id === userId);
  if (isAdmin && newRole !== 'admin' && admins.length <= 1) return 'There must always be at least one admin.';
  return null;
}

const addSchema = z.object({
  name: z.string().trim().min(1, 'Please give their name').max(100),
  email: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().toLowerCase().email('Please check the email address').max(200).optional()),
  role: z.enum(roles, { errorMap: () => ({ message: 'Please choose what they do' }) }),
  phone: optionalMobile,
  weeks: z.array(z.enum(volunteerWeeks as [string, ...string[]])).default([]),
  day_types: z.array(z.enum(volunteerDayTypes as [string, ...string[]])).default([]),
  note: z.string().trim().max(1000, 'Please keep the note under 1,000 characters').optional().transform((v) => v || undefined),
}).superRefine((h, ctx) => {
  // Signing in needs an email, so admins must have one; others can have just a mobile and get their shifts by text
  if (h.role === 'admin' && !h.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Admins need an email address to sign in' });
  else if (!h.email && !h.phone) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Please give an email address or a mobile number' });
});
type When = { weeks: string[]; day_types: string[]; note?: string };

/**
 * Helpers who work on the day (Santas, elves and lead elves) are also approved volunteers, so they can be put on
 * the rota straight away. They are marked as able to help on any day of the season. Someone who already applied as
 * a volunteer with the same email is approved and linked to their account instead of being added twice.
 */
async function makeVolunteer(userId: string | null, name: string, email: string | null, role: StaffRole, phone: string | undefined, by: string,
  when: When = { weeks: [], day_types: [] }) {
  const season = await adminSeason();
  // No weeks ticked means any day of the season
  const anyDay = season ? [`${Number(season.first_day.slice(8, 10))} to ${Number(season.last_day.slice(8, 10))} December`] : [];
  const weeks = when.weeks.length ? when.weeks : anyDay;
  await asStaff((sql) => [sql`
    with linked as (
      update volunteers set user_id = coalesce(${userId}::uuid, user_id), email = coalesce(${email}::citext, email),
             role = ${role}::staff_role, status = 'approved',
             phone = coalesce(nullif(${phone ?? ''}, ''), phone),
             approved_by = case when status = 'approved' then approved_by else ${by} end,
             approved_at = case when status = 'approved' then approved_at else now() end,
             available_weeks = case when ${when.weeks.length > 0} then ${when.weeks}::text[] else available_weeks end,
             day_types = case when ${when.day_types.length > 0} then ${when.day_types}::text[] else day_types end,
             notes = coalesce(${when.note ?? null}, notes)
      -- The same person: their sign-in, or an application or text-only record with the same email or mobile
      where (${userId}::uuid is not null and user_id = ${userId}::uuid)
         or (user_id is null and ${email}::text is not null and lower(email::text) = lower(${email}))
         or (user_id is null and ${phone ?? ''} <> '' and phone = ${phone ?? ''})
      returning id)
    insert into volunteers (user_id, name, email, phone, role, over_18, status, available_weeks, day_types, notes, approved_by, approved_at)
    select ${userId}::uuid, ${name}, ${email}, ${phone ?? ''}, ${role}::staff_role, true, 'approved', ${weeks}::text[], ${when.day_types}::text[],
           ${when.note ?? null}, ${by}, now()
    where not exists (select 1 from linked)`]);
}

/** Add a helper: a sign-in account (or their existing one), their role here, and a welcome email to set a password */
export async function addHelper(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(['admin']);
  const parsed = addSchema.safeParse({
    name: text(fd, 'name') ?? '', email: text(fd, 'email') ?? '', role: text(fd, 'role') ?? '', phone: text(fd, 'phone'),
    weeks: all(fd, 'weeks'), day_types: all(fd, 'day_types'), note: text(fd, 'note'),
  });
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => ({ field: String(i.path[0]), message: i.message })) };
  const { name, email, role, phone, weeks, day_types, note } = parsed.data;

  // No email: they sign in with a code texted to their mobile. Their account gets a hidden placeholder email on our own
  // domain and a random password, kept encrypted so the server can sign them in once their code is right.
  if (!email) {
    const norm = phoneNorm(phone ?? '');
    if (!norm) return problem('Please give their UK mobile number, starting 07', 'phone');
    const sql = db();
    const [taken] = await sql`select 1 as x from phone_sign_ins p join staff s on s.user_id = p.user_id where p.phone_norm = ${norm}` as { x: number }[];
    if (taken) return problem('A helper with that mobile number already exists.', 'phone');
    const placeholder = placeholderEmail(norm);
    const password = randomBytes(24).toString('base64url');
    const [old] = await sql`select id::text as id from neon_auth."user" where lower(email) = ${placeholder}` as { id: string }[];
    let uid = old?.id;
    if (uid) {
      // Added before and removed: same account, with a fresh password we keep
      const { error } = await auth.admin.setUserPassword({ userId: uid, newPassword: password });
      if (error) return problem(error.status === 403 || error.status === 401 ? NO_AUTH_ADMIN : 'Could not set up their sign-in. Please try again.');
      await auth.admin.setRole({ userId: uid, role: authRole(role) });
    } else {
      const { data, error } = await auth.admin.createUser({ email: placeholder, name, password, role: authRole(role) });
      if (error || !data?.user?.id) return problem(error?.status === 403 || error?.status === 401 ? NO_AUTH_ADMIN : 'Could not create their sign-in account. Please try again.');
      uid = data.user.id;
    }
    await sql`insert into phone_sign_ins (user_id, phone_norm, secret) values (${uid}::uuid, ${norm}, ${encryptSecret(password)})
              on conflict (user_id) do update set phone_norm = excluded.phone_norm, secret = excluded.secret`;
    await asStaff((q) => [q`insert into staff (user_id, name, role, phone, added_by) values (${uid}::uuid, ${name}, ${role}::staff_role, ${phone ?? null}, ${me.name})`]);
    await makeVolunteer(uid, name, null, role, phone, me.name, { weeks, day_types, note });
    const sent = await send({ phone, channels: ['sms'] }, templates.helperWelcomeText(name.split(' ')[0]), { template: 'helperWelcomeText' });
    revalidatePath('/admin');
    revalidatePath('/admin/rota');
    return { done: `${name} has been added and is on the Helper rota. ${sent.some((r) => r.ok) ? 'We have texted them' : 'Their welcome text did not send (see Messages), so tell them'} how to sign in: Helper login, then "Sign in with a code sent to your phone".` };
  }

  // Someone who had access before keeps their sign-in account, so look for it first
  const [existing] = await db()`select id::text as id from neon_auth."user" where lower(email) = ${email}` as { id: string }[];
  let userId = existing?.id;
  if (userId) {
    const [[already]] = await asStaff((sql) => [sql`select 1 as x from staff where user_id = ${userId}::uuid`]) as unknown as [[{ x: number } | undefined]];
    if (already) return problem(`${email} is already a helper.`, 'email');
    const { error } = await auth.admin.setRole({ userId, role: authRole(role) });
    if (error) return problem(error.status === 403 || error.status === 401 ? NO_AUTH_ADMIN : 'Could not give them access. Please try again.');
  } else {
    // A long random password nobody knows: they choose their own from the welcome email
    const { data, error } = await auth.admin.createUser({ email, name, password: randomBytes(24).toString('base64url'), role: authRole(role) });
    if (error || !data?.user?.id) {
      return problem(error?.status === 403 || error?.status === 401 ? NO_AUTH_ADMIN : 'Could not create their sign-in account. Please try again.');
    }
    userId = data.user.id;
  }

  await asStaff((sql) => [sql`insert into staff (user_id, name, role, phone, added_by) values (${userId}::uuid, ${name}, ${role}::staff_role, ${phone ?? null}, ${me.name})`]);
  await makeVolunteer(userId, name, email, role, phone, me.name, { weeks, day_types, note });
  await auth.requestPasswordReset({ email, redirectTo: `${await origin()}/staff/new-password` });
  await send({ email, channels: ['email'] }, templates.staffWelcome(name.split(' ')[0]), { template: 'staffWelcome' });
  revalidatePath('/admin');
  revalidatePath('/admin/rota');
  const rota = ' You can now put them on the Helper rota.';
  return { done: `${name} has been added. We have emailed ${email} a link to set their password.${rota}` };
}

export async function setHelperRole(userId: string, fd: FormData) {
  const me = await requireStaff(['admin']);
  const role = text(fd, 'role') as StaffRole;
  if (!isUuid(userId) || !roles.includes(role as (typeof roles)[number])) return;
  if (await guard(me, userId, role)) return;
  const { error } = await auth.admin.setRole({ userId, role: authRole(role) });
  if (error) return;
  await asStaff((sql) => [sql`update staff set role = ${role}::staff_role where user_id = ${userId}::uuid`]);
  // Every helper, admins included, is on the rota with their new role
  const [h] = await db()`select s.name, u.email, s.phone from staff s join neon_auth."user" u on u.id = s.user_id
    where s.user_id = ${userId}::uuid` as { name: string; email: string; phone: string | null }[];
  if (h) await makeVolunteer(userId, h.name, h.email, role, h.phone ?? undefined, me.name);
  revalidatePath('/admin');
  revalidatePath('/admin/rota');
}

/** Removes their access here and signs them out everywhere. Their sign-in account stays, so they can be added back. */
export async function removeHelper(userId: string) {
  const me = await requireStaff(['admin']);
  if (!isUuid(userId) || (await guard(me, userId, null))) return;
  await auth.admin.setRole({ userId, role: 'user' });
  await auth.admin.revokeUserSessions({ userId });
  await asStaff((sql) => [sql`delete from staff where user_id = ${userId}::uuid`]);
  revalidatePath('/admin');
}

const editSchema = z.object({
  name: z.string().trim().min(1, 'Please give their name').max(100),
  phone: optionalMobile,
  weeks: z.array(z.enum(volunteerWeeks as [string, ...string[]])).default([]),
  day_types: z.array(z.enum(volunteerDayTypes as [string, ...string[]])).default([]),
  note: z.string().trim().max(1000, 'Please keep the note under 1,000 characters').optional().transform((v) => v || null),
});

/** Change a helper's name, mobile, when they can help and the note about them (on their page) */
export async function updateHelper(userId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff(['admin']);
  if (!isUuid(userId)) return problem('Could not find this helper. Please go back and try again.');
  const parsed = editSchema.safeParse({
    name: text(fd, 'name') ?? '', phone: text(fd, 'phone'), weeks: all(fd, 'weeks'), day_types: all(fd, 'day_types'), note: text(fd, 'note'),
  });
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => ({ field: String(i.path[0]), message: i.message })) };
  const { name, phone, weeks, day_types, note } = parsed.data;
  const season = await adminSeason();
  const anyDay = season ? [`${Number(season.first_day.slice(8, 10))} to ${Number(season.last_day.slice(8, 10))} December`] : [];
  // Their sign-in account keeps its own name; everything in the admin uses the name here
  await asStaff((sql) => [
    sql`update staff set name = ${name}, phone = ${phone ?? null} where user_id = ${userId}::uuid`,
    sql`update volunteers set name = ${name}, phone = ${phone ?? ''}, available_weeks = ${weeks.length ? weeks : anyDay}::text[],
          day_types = ${day_types}::text[], notes = ${note} where user_id = ${userId}::uuid`,
  ]);
  revalidatePath('/admin', 'layout');
  return { done: 'Saved.' };
}

/**
 * "View as": signs this browser in as the helper (Neon Auth impersonation, ends after an hour) so an admin can see
 * what they see. Not for other admins or yourself. Anything done while viewing is done as them.
 */
export async function viewAsHelper(userId: string) {
  const me = await requireStaff(['admin']);
  if (!isUuid(userId) || userId === me.userId) return;
  const [[h]] = await asStaff((sql) => [sql`select role::text as role from staff where user_id = ${userId}::uuid`]) as unknown as [[{ role: string } | undefined]];
  if (!h || h.role === 'admin') return;
  const { error } = await auth.admin.impersonateUser({ userId });
  if (error) redirect(`/admin/helpers/${userId}?view=failed`);
  redirect(h.role === 'lead_elf' ? '/admin' : '/helper');
}

/** Back to the admin's own account, on the page of the helper they were viewing as */
export async function stopViewingAs() {
  const v = await viewingAs();
  await auth.admin.stopImpersonating();
  redirect(v ? `/admin/helpers/${v.userId}` : '/admin');
}

