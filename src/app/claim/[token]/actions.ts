'use server';
import { redirect } from 'next/navigation';
import { asPublic } from '@/lib/db';
import { bookingContact } from '@/lib/booking-contact';
import { isToken } from '@/lib/public-data';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { dbCode, messages, problem, type FormState } from '@/lib/forms';

export async function claimOffer(token: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  if (!isToken(token)) return problem(messages.OFFER_EXPIRED);
  let manageToken: string;
  try {
    const [rows] = await asPublic((sql) => [sql`select manage_token from claim_waitlist_offer(${token}::uuid)`]);
    manageToken = rows[0].manage_token as string;
  } catch (e) {
    return problem(messages[dbCode(e)]);
  }
  const c = await bookingContact(manageToken);
  if (c) await send(c.to, templates.claimed(c.visit), { booking_id: c.bookingId, template: 'claimed' });
  redirect(`/booking/${manageToken}?done=claimed`);
}
