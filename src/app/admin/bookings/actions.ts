'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff, db } from '@/lib/db';
import { contactForBooking, isUuid } from '@/lib/admin/data';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { bookingSchema } from '@/lib/booking-schema';
import { bookingInputFromForm } from '@/lib/booking-form-data';
import { visitWhen } from '@/lib/dates';
import { all, dbCode, messages, problem, text, zodErrors, type FormState } from '@/lib/forms';

/** The messages staff can send from the bookings page, from the same templates as the automatic ones */
const adminTemplates = {
  reminder: templates.reminder7d,
  confirm: templates.confirm48h,
  details: templates.missingDetails,
  late: () => templates.runningLate(),
} as const;
export type AdminTemplate = keyof typeof adminTemplates;

/** Send a message to one family or every family on a day, by the channels chosen */
export async function sendMessages(ids: string[], _prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff(['admin', 'lead_elf']);
  const template = text(fd, 'template') as AdminTemplate;
  const channels = all(fd, 'channels').filter((c): c is 'email' | 'sms' => c === 'email' || c === 'sms');
  if (!(template in adminTemplates)) return problem('Please choose a message');
  if (!channels.length) return problem('Please choose email, text or both');
  let sent = 0, skipped = 0;
  for (const id of ids.filter(isUuid)) {
    const c = await contactForBooking(id);
    if (!c) continue;
    const usable = channels.filter((ch) => (ch === 'email' ? c.email : c.phone));
    if (!usable.length) { skipped++; continue; }
    const results = await send({ email: c.email, phone: c.phone, channels: usable }, adminTemplates[template](c.visit),
      { booking_id: c.bookingId, template: `admin:${template}` });
    if (results.some((r) => r.ok)) sent++; else skipped++;
  }
  revalidatePath('/admin/messages');
  const via = channels.map((c) => (c === 'sms' ? 'text' : 'email')).join(' and ');
  return { done: `Sent to ${sent} ${sent === 1 ? 'family' : 'families'} by ${via}.${skipped ? ` ${skipped} could not be sent (no ${via} on file, or sending failed: see Messages).` : ''}` };
}

export async function markArrived(id: string) {
  await requireStaff(['admin', 'lead_elf']);
  if (!isUuid(id)) return;
  await asStaff((sql) => [sql`select set_visit_stage(${id}::uuid, 'arrived')`]);
  revalidatePath('/admin/bookings');
}

export async function cancelBooking(id: string, day: string) {
  await requireStaff(['admin', 'lead_elf']);
  if (!isUuid(id)) return;
  const c = await contactForBooking(id); // before cancelling, for the time in the message
  await asStaff((sql) => [sql`select admin_cancel_booking(${id}::uuid)`]);
  if (c) await send({ email: c.email, phone: c.phone, channels: c.channels }, templates.cancelled(c.visit), { booking_id: id, template: 'cancelled' });
  revalidatePath('/admin/bookings');
  redirect(`/admin/bookings?day=${day}`);
}

/** Confirm a booking that was held for review, and send the family their confirmation */
export async function confirmBooking(id: string) {
  await requireStaff(['admin']);
  if (!isUuid(id)) return;
  await asStaff((sql) => [sql`select admin_confirm_booking(${id}::uuid)`]);
  const c = await contactForBooking(id);
  if (c) await send({ email: c.email, phone: c.phone, channels: c.channels }, templates.confirmation(c.visit), { booking_id: id, template: 'confirmation' });
  revalidatePath('/admin/bookings');
}

export async function moveBooking(id: string, slotId: string, day: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  await requireStaff(['admin', 'lead_elf']);
  if (!isUuid(id) || !isUuid(slotId)) return problem(messages.NOT_FOUND);
  try {
    await asStaff((sql) => [sql`select admin_move_booking(${id}::uuid, ${slotId}::uuid)`]);
  } catch (e) {
    return problem(messages[dbCode(e)]);
  }
  const c = await contactForBooking(id);
  if (c) await send({ email: c.email, phone: c.phone, channels: c.channels }, templates.moved(c.visit), { booking_id: id, template: 'moved' });
  revalidatePath('/admin/bookings');
  redirect(`/admin/bookings?day=${day}&sel=${id}`);
}

/** "Add booking", for example for a family who phones. Unlike the public form, staff see why it failed. */
export async function addBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff(['admin', 'lead_elf']);
  const parsed = bookingSchema.safeParse(bookingInputFromForm(fd));
  if (!parsed.success) return zodErrors(parsed.error);
  const b = parsed.data;
  const sql = db();
  let made: { reference: string; manage_token: string; status: string };
  try {
    [made] = await sql`select * from create_booking(${JSON.stringify(b)}::jsonb)` as (typeof made)[];
  } catch (e) {
    const code = dbCode(e);
    if (code === 'ALREADY_BOOKED') return problem('This family already has a visit (matched on email or mobile). Find it on the Bookings page, or check Checks for duplicates.');
    if (code === 'BOOKING_CLOSED') return problem('Booking is closed for this season. Open it on the Visit times page first.');
    return problem(messages[code]);
  }
  const [row] = await sql`
    select b.id, sl.day::text as day, sl.starts_at::text as starts_at from bookings b join slots sl on sl.id = b.slot_id
    where b.reference = ${made.reference}` as { id: string; day: string; starts_at: string }[];
  const name = b.visitors.find((v) => v.kind === 'visitor')!.first_name;
  const visit = { name, when: visitWhen(row.day, row.starts_at), token: made.manage_token, reference: made.reference };
  const template = made.status === 'pending_review' ? 'pendingReview' : 'confirmation';
  await send({ email: b.email, phone: b.phone, channels: b.channels }, templates[template](visit), { booking_id: row.id, template });
  revalidatePath('/admin/bookings');
  redirect(`/admin/bookings?day=${row.day}&sel=${row.id}`);
}
