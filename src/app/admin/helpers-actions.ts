'use server';
import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth/server';
import { requireStaff, type StaffRole } from '@/lib/auth/staff';
import { asStaff, db } from '@/lib/db';
import { isUuid } from '@/lib/admin/data';
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
});

/** Add a helper: a sign-in account (or their existing one), their role here, and a welcome email to set a password */
export async function addHelper(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(['admin']);
  const parsed = addSchema.safeParse({ name: text(fd, 'name') ?? '', email: text(fd, 'email') ?? '', role: text(fd, 'role') ?? '' });
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => ({ field: String(i.path[0]), message: i.message })) };
  const { name, email, role } = parsed.data;

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

  await asStaff((sql) => [sql`insert into staff (user_id, name, role) values (${userId}::uuid, ${name}, ${role}::staff_role)`]);
  await auth.requestPasswordReset({ email, redirectTo: `${await origin()}/staff/new-password` });
  await send({ email, channels: ['email'] }, templates.staffWelcome(name.split(' ')[0]), { template: 'staffWelcome' });
  revalidatePath('/admin');
  return { done: `${name} has been added. We have emailed ${email} a link to set their password.` };
}

export async function setHelperRole(userId: string, fd: FormData) {
  const me = await requireStaff(['admin']);
  const role = text(fd, 'role') as StaffRole;
  if (!isUuid(userId) || !roles.includes(role as (typeof roles)[number])) return;
  if (await guard(me, userId, role)) return;
  const { error } = await auth.admin.setRole({ userId, role: authRole(role) });
  if (error) return;
  await asStaff((sql) => [sql`update staff set role = ${role}::staff_role where user_id = ${userId}::uuid`]);
  revalidatePath('/admin');
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
