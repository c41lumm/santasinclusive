'use server';
import { redirect } from 'next/navigation';
import { asPublic } from '@/lib/db';
import { bookingContact } from '@/lib/booking-contact';
import { isToken } from '@/lib/public-data';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { dbCode, messages, problem, type FormState } from '@/lib/forms';

/** "Claim this slot": books it, then goes straight to "about the visitor", as we do not have those details yet */
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
  redirect(`/booking/${manageToken}/about`);
}

/** "No thanks, keep me on the list": the time goes to the next family, and this family keeps its place */
export async function declineOffer(token: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  if (!isToken(token)) return problem(messages.OFFER_EXPIRED);
  try {
    await asPublic((sql) => [sql`select decline_waitlist_offer(${token}::uuid)`]);
  } catch (e) {
    return problem(messages[dbCode(e)]);
  }
  return { done: 'declined' };
}
