'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { contactForBooking, isUuid } from '@/lib/admin/data';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { problem, text, type FormState } from '@/lib/forms';

/** "Cancel the newer booking and message the family" */
export async function cancelNewer(dupId: string, newerBookingId: string) {
  await requireStaff(['admin']);
  if (!isUuid(dupId) || !isUuid(newerBookingId)) return;
  const c = await contactForBooking(newerBookingId);
  await asStaff((sql) => [
    sql`select admin_cancel_booking(${newerBookingId}::uuid)`,
    sql`select admin_decide_duplicate(${dupId}::uuid, 'cancelled_newer')`,
  ]);
  if (c) await send({ email: c.email, phone: c.phone, channels: c.channels }, templates.duplicateCancelled(c.visit), { booking_id: newerBookingId, template: 'duplicateCancelled' });
  revalidatePath('/admin/checks');
}

export async function decideDuplicate(dupId: string, status: 'not_duplicate' | 'contacting') {
  await requireStaff(['admin']);
  if (!isUuid(dupId)) return;
  await asStaff((sql) => [sql`select admin_decide_duplicate(${dupId}::uuid, ${status}::dup_status)`]);
  revalidatePath('/admin/checks');
}

export async function removeFlag(flagId: string) {
  await requireStaff(['admin']);
  if (!isUuid(flagId)) return;
  await asStaff((sql) => [sql`update flags set active = false where id = ${flagId}::uuid`]);
  revalidatePath('/admin/checks');
}

export async function addNote(flagId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireStaff(['admin']);
  const note = text(fd, 'note')?.trim();
  if (!isUuid(flagId)) return problem('Not found');
  if (!note) return problem('Please write the note', 'note');
  const stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
  await asStaff((sql) => [sql`update flags set note = note || ${`\n\n${stamp}, ${me.name}: ${note}`} where id = ${flagId}::uuid`]);
  revalidatePath('/admin/checks');
  return { done: 'Note added to the flag history.' };
}

/** Add a flag: describe what happened or was said, never a guess from how someone looks */
export async function addFlag(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff(['admin']);
  const email = text(fd, 'email')?.trim().toLowerCase() || null;
  const phone = text(fd, 'phone')?.replace(/\D/g, '') || null;
  const label = text(fd, 'label')?.trim();
  const reason = text(fd, 'reason');
  const note = text(fd, 'note')?.trim();
  const errors = [
    !email && !phone ? { field: 'email', message: 'Please give an email address or mobile number' } : null,
    !label ? { field: 'label', message: 'Please give a name to recognise this by' } : null,
    !['eligibility_concern', 'repeat_duplicates', 'other'].includes(reason ?? '') ? { field: 'reason', message: 'Please choose a reason' } : null,
    !note ? { field: 'note', message: 'Please describe what happened or was said' } : null,
  ].filter(Boolean) as { field: string; message: string }[];
  if (errors.length) return { errors };
  const phoneNorm = phone ? (phone.startsWith('0') ? `44${phone.slice(1)}` : phone) : null;
  const reviewBy = `${new Date().getFullYear() + (new Date().getMonth() >= 6 ? 1 : 0)}-12-31`;
  await asStaff((sql) => [sql`
    insert into flags (email, phone_norm, label, reason, note, created_by, review_by)
    values (${email}, ${phoneNorm}, ${label!}, ${reason!}::flag_reason, ${note!}, app.uid(), ${reviewBy}::date)`]);
  revalidatePath('/admin/checks');
  return { done: 'Flag added. New bookings from this contact will be held for you to review.' };
}
