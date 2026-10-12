'use server';
import { bookingSchema } from '@/lib/booking-schema';
import { serviceClient } from '@/lib/supabase/server';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { visitWhen } from '@/lib/dates';
import { isHuman } from '@/lib/turnstile';
import { callerIp, withinLimit } from '@/lib/rate-limit';

/**
 * A new booking, a booking held for review and a family that has already booked all get the same answer
 * ({ ok: true }: "we have sent the details to you"), so the form never reveals whether someone has booked.
 */
export type BookingResult = { ok: true } | { ok: false; code: string; message: string };

const friendly: Record<string, string> = {
  SLOT_FULL: 'Sorry, someone has just booked that time. Please choose another.',
  SLOT_UNAVAILABLE: 'That time is not available. Please choose another.',
  BOOKING_CLOSED: 'Booking is not open yet. Sign up for an early alert and we will tell you when it opens.',
  ELIGIBILITY_REQUIRED: 'Please confirm your group includes a child or adult with a disability.',
  CONSENT_REQUIRED: 'Please agree to us holding your details so we can prepare for your visit.',
  CONTACT_REQUIRED: 'Please give an email address or mobile number.',
  INVALID_PHONE: 'Please give a UK mobile number, starting 07.',
  VISITOR_REQUIRED: 'Please tell us who is visiting Santa.',
  NOT_VERIFIED: 'We could not check the form was sent by a person. Please refresh the page and try again.',
  TOO_MANY: 'There have been too many attempts from your connection. Please wait a while and try again.',
};
const fail = (code: string): BookingResult =>
  ({ ok: false, code, message: friendly[code] ?? 'Something went wrong. Please try again.' });

export async function createBooking(input: unknown, turnstileToken: string): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Please check the form' };
  const b = parsed.data;

  const ip = await callerIp();
  if (!(await isHuman(turnstileToken, ip))) return fail('NOT_VERIFIED');
  if (!(await withinLimit(`book:ip:${ip ?? 'unknown'}`, 10, 60 * 60))) return fail('TOO_MANY');

  const db = serviceClient();
  const { data, error } = await db.rpc('create_booking', { p: b }).single<{ reference: string; manage_token: string; status: string }>();
  if (error) {
    if (error.message === 'ALREADY_BOOKED') {
      await resendExisting(b.email, b.phone);
      return { ok: true };
    }
    return fail(error.message in friendly ? error.message : 'ERROR');
  }

  const { data: slot } = await db.from('slots').select('day, starts_at').eq('id', b.slot_id).single();
  const name = b.visitors.find((v) => v.kind === 'visitor')!.first_name;
  const { data: booking } = await db.from('bookings').select('id').eq('reference', data.reference).single();
  const visit = { name, when: visitWhen(slot!.day, slot!.starts_at), token: data.manage_token, reference: data.reference };
  // A booking held for review is not confirmed yet; the admin confirms it after checking
  const template = data.status === 'pending_review' ? 'pendingReview' : 'confirmation';
  await send({ email: b.email, phone: b.phone, channels: b.channels }, templates[template](visit),
    { booking_id: booking?.id, template });

  return { ok: true };
}

/** Sends the existing booking link only to the email or phone on that booking, never to the screen. */
async function resendExisting(email?: string, phone?: string) {
  // At most 3 a day for the same details, so the form cannot be used to send someone repeated messages
  if (!(await withinLimit(`resend:${email ?? ''}:${phone ?? ''}`, 3, 24 * 60 * 60))) return;
  const db = serviceClient();
  const { data } = await db.rpc('find_existing_booking', { p_email: email ?? null, p_phone: phone ?? null }).maybeSingle<{
    booking_id: string; manage_token: string; reference: string; day: string; starts_at: string; first_name: string;
    email: string | null; phone: string | null; channels: ('email' | 'sms' | 'whatsapp')[];
  }>();
  if (!data) return;
  await send({ email: data.email, phone: data.phone, channels: data.channels },
    templates.alreadyBooked({ name: data.first_name, when: visitWhen(data.day, data.starts_at), token: data.manage_token, reference: data.reference }),
    { booking_id: data.booking_id, template: 'alreadyBooked' });
}
