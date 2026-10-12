import { serviceClient } from '@/lib/supabase/server';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { visitWhen } from '@/lib/dates';

/** Attempts per offer before giving up (about three rounds on two channels) */
const MAX_ATTEMPTS = 6;

/** Every 5 minutes: expire unclaimed offers, pass times on, and message anyone with a new offer. */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorised', { status: 401 });
  const db = serviceClient();
  await db.rpc('expire_waitlist_offers');

  // Live offers whose hold has started (overnight offers start at 08:00), including offers made by cancellations
  const now = new Date().toISOString();
  const { data: offers } = await db.from('waitlist_entries')
    .select('id, email, phone, channels, offer_token, offer_expires_at, slots:offer_slot_id(day, starts_at), messages(status)')
    .eq('status', 'offered').lte('offer_starts_at', now).gt('offer_expires_at', now);
  let sent = 0;
  for (const o of offers ?? []) {
    // Already messaged, or failed too often: a failed attempt is retried on the next run
    const tries = o.messages as { status: string }[];
    if (tries.some((m) => m.status === 'sent') || tries.length >= MAX_ATTEMPTS) continue;
    const slot = o.slots as unknown as { day: string; starts_at: string };
    const until = new Date(o.offer_expires_at!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    await send({ email: o.email, phone: o.phone, channels: o.channels },
      templates.waitlistOffer(visitWhen(slot.day, slot.starts_at), o.offer_token!, until),
      { waitlist_id: o.id, template: 'waitlistOffer' });
    sent++;
  }
  return Response.json({ sent });
}
