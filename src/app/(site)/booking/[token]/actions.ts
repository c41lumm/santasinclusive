'use server';
import { redirect } from 'next/navigation';
import { asPublic } from '@/lib/db';
import { detailsSchema, finishedDetailsSchema } from '@/lib/booking-schema';
import { bookingContact } from '@/lib/booking-contact';
import { isToken } from '@/lib/public-data';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { dbCode, messages, problem, text, ticked, zodErrors, type FormState } from '@/lib/forms';

// Each action is bound to the family's link token; the database checks the token on every call.

/** "About your child": "Save and finish", or "Save and come back later" (submitted with later=1) */
export async function saveDetails(token: string, _prev: FormState, fd: FormData): Promise<FormState> {
  if (!isToken(token)) return problem(messages.NOT_FOUND);
  let input: Record<string, unknown> = {};
  try { input = JSON.parse(text(fd, 'details') ?? '{}'); } catch { /* the schema reports it */ }
  input.consent = ticked(fd, 'consent');
  const later = fd.get('later') === '1';
  const parsed = (later ? detailsSchema : finishedDetailsSchema).safeParse(input);
  if (!parsed.success) return zodErrors(parsed.error);
  const { consent: _consent, ...details } = parsed.data;
  try {
    await asPublic((sql) => [sql`select update_booking_details(${token}::uuid, ${JSON.stringify(details)}::jsonb)`]);
  } catch (e) {
    return problem(messages[dbCode(e)]);
  }
  redirect(`/booking/${token}?done=${later ? 'saved_later' : 'saved'}`);
}

export async function moveBooking(token: string, slotId: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  if (!isToken(token) || !isToken(slotId)) return problem(messages.NOT_FOUND);
  try {
    await asPublic((sql) => [sql`select move_booking(${token}::uuid, ${slotId}::uuid)`]);
  } catch (e) {
    return problem(messages[dbCode(e)]);
  }
  const c = await bookingContact(token);
  if (c) await send(c.to, templates.moved(c.visit), { booking_id: c.bookingId, template: 'moved' });
  redirect(`/booking/${token}?done=moved`);
}

export async function cancelBooking(token: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  if (!isToken(token)) return problem(messages.NOT_FOUND);
  const c = await bookingContact(token); // read first, for the time in the message
  try {
    await asPublic((sql) => [sql`select cancel_booking(${token}::uuid)`]);
  } catch (e) {
    return problem(messages[dbCode(e)]);
  }
  if (c) await send(c.to, templates.cancelled(c.visit), { booking_id: c.bookingId, template: 'cancelled' });
  redirect(`/booking/${token}?done=cancelled`);
}

export async function confirmVisit(token: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  if (!isToken(token)) return problem(messages.NOT_FOUND);
  try {
    await asPublic((sql) => [sql`select confirm_attendance(${token}::uuid)`]);
  } catch (e) {
    return problem(messages[dbCode(e)]);
  }
  redirect(`/booking/${token}?done=confirmed`);
}
