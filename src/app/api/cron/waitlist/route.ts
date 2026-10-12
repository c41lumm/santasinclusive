import { serviceClient } from '@/lib/supabase/server';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { visitWhen } from '@/lib/dates';

/** Every 5 minutes: expire unclaimed offers, pass times on, and message anyone with a new offer. */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorised', { status: 401 });
  const db = serviceClient();
  await db.rpc('expire_waitlist_offers');

  // Any offer not yet messaged (covers offers made by cancellations as well)
  const { data: offers } = await db.from('waitlist_entries')
    .select('id, email, phone, channels, offer_token, offer_expires_at, slots:offer_slot_id(day, starts_at), messages(id)')
    .eq('status', 'offered');
  let sent = 0;
  for (const o of offers ?? []) {
    if ((o.messages as unknown[]).length) continue;
    if (new Date(o.offer_expires_at!).getTime() - Date.now() > 3 * 60 * 60 * 1000) continue; // overnight offer, send from 08:00
    const slot = o.slots as unknown as { day: string; starts_at: string };
    const until = new Date(o.offer_expires_at!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    await send({ email: o.email, phone: o.phone, channels: o.channels },
      templates.waitlistOffer(visitWhen(slot.day, slot.starts_at), o.offer_token!, until),
      { waitlist_id: o.id, template: 'waitlistOffer' });
    sent++;
  }
  return Response.json({ sent });
}
