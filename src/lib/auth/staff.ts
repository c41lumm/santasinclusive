import 'server-only';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';

/**
 * Only on your own computer (`npm run dev`), DEV_STAFF_USER_ID in .env.local lets you use the admin area as that
 * staff member without signing in, for testing. A production build always ignores it.
 */
export function devStaffUserId() {
  return process.env.NODE_ENV === 'development' ? process.env.DEV_STAFF_USER_ID || null : null;
}

/** The signed-in staff member's Neon Auth user id, or null */
export async function currentUserId() {
  const dev = devStaffUserId();
  if (dev) return dev;
  const { data: session } = await auth.getSession();
  return session?.user?.id ?? null;
}

export type StaffRole = 'admin' | 'lead_elf' | 'elf' | 'santa';
export type Staff = { userId: string; name: string; role: StaffRole };

/** The signed-in person's staff record, from the database (so their role is the one an admin set). */
export async function getStaff(): Promise<Staff | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  // Imported here to avoid a cycle: db.ts uses currentUserId
  const { asStaff } = await import('@/lib/db');
  const [rows] = await asStaff((sql) => [sql`select name, role::text as role from staff where user_id = app.uid()`]);
  const row = rows[0] as { name: string; role: StaffRole } | undefined;
  return row ? { userId, name: row.name, role: row.role } : null;
}

/** For admin pages: signed in, with one of these roles, or sent to sign in / told they cannot see it. */
export async function requireStaff(roles: StaffRole[] = ['admin', 'lead_elf']): Promise<Staff> {
  const userId = await currentUserId();
  if (!userId) redirect('/staff/sign-in');
  const staff = await getStaff();
  if (!staff || !roles.includes(staff.role)) redirect('/staff/not-allowed');
  return staff;
}
