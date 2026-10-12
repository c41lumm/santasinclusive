'use server';
import { bookingSchema } from '@/lib/booking-schema';
import { publicClient, serviceClient } from '@/lib/supabase/server';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { visitWhen } from '@/lib/dates';

export type BookingResult =
  | { ok: true; reference: string; token: string; pendingReview: boolean }
  | { ok: false; code: string; message: string };

const friendly: Record<string, string> = {
  ALREADY_BOOKED: 'You already have a visit booked. We have sent the details to you so you can change it if you need to.',
  SLOT_FULL: 'Sorry, someone has just booked that time. Please choose another.',
  SLOT_UNAVAILABLE: 'That time is not available. Please choose another.',
  BOOKING_CLOSED: 'Booking is not open yet. Sign up for an early alert and we will tell you when it opens.',
  ELIGIBILITY_REQUIRED: 'Please confirm your group includes a child or adult with a disability.',
  CONSENT_REQUIRED: 'Please agree to us holding your details so we can prepare for your visit.',
};

export async function createBooking(input: unknown): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'Please check the form' };
  const b = parsed.data;

  const { data, error } = await publicClient().rpc('create_booking', { p: b }).single<{ reference: string; manage_token: string; status: string }>();
  if (error) {
    const code = Object.keys(friendly).find((k) => error.message.includes(k)) ?? 'ERROR';
    if (code === 'ALREADY_BOOKED') await resendExisting(b.email, b.phone);
    return { ok: false, code, message: friendly[code] ?? 'Something went wrong. Please try again.' };
  }

  const db = serviceClient();
  const { data: slot } = await db.from('slots').select('day, starts_at').eq('id', b.slot_id).single();
  const name = b.visitors.find((v) => v.kind === 'visitor')!.first_name;
  const { data: booking } = await db.from('bookings').select('id').eq('reference', data.reference).single();
  await send({ email: b.email, phone: b.phone, channels: b.channels },
    templates.confirmation({ name, when: visitWhen(slot!.day, slot!.starts_at), token: data.manage_token, reference: data.reference }),
    { booking_id: booking?.id, template: 'confirmation' });

  return { ok: true, reference: data.reference, token: data.manage_token, pendingReview: data.status === 'pending_review' };
}

/** Sends the existing booking link only to the email or phone on that booking, never to the screen. */
async function resendExisting(email?: string, phone?: string) {
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
