'use server';
import { redirect } from 'next/navigation';
import { bookingSchema, type BookingInput } from '@/lib/booking-schema';
import { db } from '@/lib/db';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { visitWhen } from '@/lib/dates';
import { withinLimit } from '@/lib/rate-limit';
import { checkPublicForm } from '@/lib/public-form';
import { all, dbCode, messages, problem, text, ticked, zodErrors, type FormState } from '@/lib/forms';

/** The booking form. On success it goes to "check your messages", whatever happened (see createBooking). */
export async function bookAction(_prev: FormState, fd: FormData): Promise<FormState> {
  let visitors: unknown = [];
  try { visitors = JSON.parse(text(fd, 'visitors') ?? '[]'); } catch { /* the schema reports it */ }
  const parsed = bookingSchema.safeParse({
    slot_id: text(fd, 'slot_id'),
    contact_name: text(fd, 'contact_name'),
    email: text(fd, 'email'),
    phone: text(fd, 'phone'),
    postcode: text(fd, 'postcode'),
    address_line: text(fd, 'address_line'),
    channels: all(fd, 'channels'),
    photo_consent: text(fd, 'photo_consent'),
    eligibility_confirmed: ticked(fd, 'eligibility_confirmed'),
    data_consent: ticked(fd, 'data_consent'),
    visitors,
  });
  if (!parsed.success) return zodErrors(parsed.error);
  const blocked = await checkPublicForm('book', 10);
  if (blocked) return blocked;

  const code = await createBooking(parsed.data);
  if (code) return problem(messages[code]);
  redirect(`/book/sent?via=${parsed.data.channels.join(',')}`);
}

/**
 * Makes the booking and sends the message. Returns an error code, or null when the family should be told
 * "we have sent the details to you": a new booking, a booking held for review and a family that has already
 * booked all get that same answer, so the form never reveals whether someone has booked.
 */
async function createBooking(b: BookingInput): Promise<string | null> {
  const sql = db();
  let made: { reference: string; manage_token: string; status: string };
  try {
    [made] = await sql`select * from create_booking(${JSON.stringify(b)}::jsonb)` as (typeof made)[];
  } catch (e) {
    const code = dbCode(e);
    if (code === 'ALREADY_BOOKED') {
      await resendExisting(b.email, b.phone);
      return null;
    }
    return code;
  }

  // A separate query: the booking is not visible to the statement that created it
  const [booking] = await sql`
    select b.id, sl.day::text as day, sl.starts_at::text as starts_at
    from bookings b join slots sl on sl.id = b.slot_id where b.reference = ${made.reference}` as { id: string; day: string; starts_at: string }[];
  const name = b.visitors.find((v) => v.kind === 'visitor')!.first_name;
  const visit = { name, when: visitWhen(booking.day, booking.starts_at), token: made.manage_token, reference: made.reference };
  // A booking held for review is not confirmed yet; the admin confirms it after checking
  const template = made.status === 'pending_review' ? 'pendingReview' : 'confirmation';
  await send({ email: b.email, phone: b.phone, channels: b.channels }, templates[template](visit),
    { booking_id: booking.id, template });
  return null;
}

/** Sends the existing booking link only to the email or phone on that booking, never to the screen. */
async function resendExisting(email?: string, phone?: string) {
  // At most 3 a day for the same details, so the form cannot be used to send someone repeated messages
  if (!(await withinLimit(`resend:${email ?? ''}:${phone ?? ''}`, 3, 24 * 60 * 60))) return;
  const [data] = await db()`
    select booking_id, manage_token, reference, day::text as day, starts_at::text as starts_at, first_name,
           email::text as email, phone, channels::text[] as channels
    from find_existing_booking(${email ?? null}, ${phone ?? null})` as {
    booking_id: string; manage_token: string; reference: string; day: string; starts_at: string; first_name: string;
    email: string | null; phone: string | null; channels: ('email' | 'sms' | 'whatsapp')[];
  }[];
  if (!data) return;
  await send({ email: data.email, phone: data.phone, channels: data.channels },
    templates.alreadyBooked({ name: data.first_name, when: visitWhen(data.day, data.starts_at), token: data.manage_token, reference: data.reference }),
    { booking_id: data.booking_id, template: 'alreadyBooked' });
}
