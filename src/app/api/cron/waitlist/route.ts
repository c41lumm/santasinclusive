import { db } from '@/lib/db';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { visitWhen } from '@/lib/dates';

/** Attempts per offer before giving up (about three rounds on two channels) */
const MAX_ATTEMPTS = 6;

type Offer = {
  id: string; email: string | null; phone: string | null; channels: ('email' | 'sms' | 'whatsapp')[];
  offer_token: string; offer_expires_at: Date; day: string; starts_at: string;
};

/** Every 5 minutes: expire unclaimed offers, pass times on, and message anyone with a new offer. */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorised', { status: 401 });
  const sql = db();
  await sql`select expire_waitlist_offers()`;

  // Live offers whose hold has started (overnight offers start at 08:00), including offers made by cancellations,
  // not yet messaged and not given up on. A failed attempt is retried on the next run.
  const offers = await sql`
    select w.id, w.email::text as email, w.phone, w.channels::text[] as channels, w.offer_token,
           w.offer_expires_at, sl.day::text as day, sl.starts_at::text as starts_at
    from waitlist_entries w
    join slots sl on sl.id = w.offer_slot_id
    left join messages m on m.waitlist_id = w.id
    where w.status = 'offered' and w.offer_starts_at <= now() and w.offer_expires_at > now()
    group by w.id, sl.id
    having count(m.id) filter (where m.status = 'sent') = 0 and count(m.id) < ${MAX_ATTEMPTS}` as Offer[];
  let sent = 0;
  for (const o of offers) {
    const until = new Date(o.offer_expires_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    await send({ email: o.email, phone: o.phone, channels: o.channels },
      templates.waitlistOffer(visitWhen(o.day, o.starts_at), o.offer_token, until),
      { waitlist_id: o.id, template: 'waitlistOffer' });
    sent++;
  }
  return Response.json({ sent });
}
