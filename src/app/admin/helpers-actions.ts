'use server';
import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/server';
import { requireStaff, type StaffRole } from '@/lib/auth/staff';
import { asStaff, db } from '@/lib/db';
import { adminSeason, isUuid } from '@/lib/admin/data';
import { optionalMobile } from '@/lib/booking-schema';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { problem, text, type FormState } from '@/lib/forms';

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
  email: z.string().trim().toLowerCase().email('Please check the email address').max(200),
  role: z.enum(roles, { errorMap: () => ({ message: 'Please choose what they do' }) }),
  phone: optionalMobile,
});

/**
 * Helpers who work on the day (Santas, elves and lead elves) are also approved volunteers, so they can be put on
 * the rota straight away. They are marked as able to help on any day of the season. Someone who already applied as
 * a volunteer with the same email is approved and linked to their account instead of being added twice.
 */
async function makeVolunteer(userId: string, name: string, email: string, role: StaffRole, phone: string | undefined, by: string) {
  if (role === 'admin') return;
  const season = await adminSeason();
  const anyDay = season ? [`${Number(season.first_day.slice(8, 10))} to ${Number(season.last_day.slice(8, 10))} December`] : [];
  await asStaff((sql) => [sql`
    with linked as (
      update volunteers set user_id = ${userId}::uuid, role = ${role}::staff_role, status = 'approved',
             phone = coalesce(nullif(${phone ?? ''}, ''), phone),
             approved_by = case when status = 'approved' then approved_by else ${by} end,
             approved_at = case when status = 'approved' then approved_at else now() end
      where user_id = ${userId}::uuid or (user_id is null and lower(email::text) = lower(${email}))
      returning id)
    insert into volunteers (user_id, name, email, phone, role, over_18, status, available_weeks, approved_by, approved_at)
    select ${userId}::uuid, ${name}, ${email}, ${phone ?? ''}, ${role}::staff_role, true, 'approved', ${anyDay}::text[], ${by}, now()
    where not exists (select 1 from linked)`]);
}

/** Add a helper: a sign-in account (or their existing one), their role here, and a welcome email to set a password */
export async function addHelper(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(['admin']);
  const parsed = addSchema.safeParse({ name: text(fd, 'name') ?? '', email: text(fd, 'email') ?? '', role: text(fd, 'role') ?? '', phone: text(fd, 'phone') });
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => ({ field: String(i.path[0]), message: i.message })) };
  const { name, email, role, phone } = parsed.data;

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
  await makeVolunteer(userId, name, email, role, phone, me.name);
  await auth.requestPasswordReset({ email, redirectTo: `${await origin()}/staff/new-password` });
  await send({ email, channels: ['email'] }, templates.staffWelcome(name.split(' ')[0]), { template: 'staffWelcome' });
  revalidatePath('/admin');
  revalidatePath('/admin/rota');
  const rota = role === 'admin' ? '' : ' You can now put them on the Helper rota.';
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
  // Becoming a Santa, elf or lead elf puts them on the rota too (an admin keeps any volunteer record they had)
  if (role !== 'admin') {
    const [h] = await db()`select s.name, u.email, s.phone from staff s join neon_auth."user" u on u.id = s.user_id
      where s.user_id = ${userId}::uuid` as { name: string; email: string; phone: string | null }[];
    if (h) await makeVolunteer(userId, h.name, h.email, role, h.phone ?? undefined, me.name);
  }
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
