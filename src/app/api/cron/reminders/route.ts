import { serviceClient } from '@/lib/supabase/server';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { visitWhen } from '@/lib/dates';

const ukToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/**
 * Daily at 09:00: a reminder about a week before (visits 5 to 7 days away), and a please-confirm
 * message 1 to 2 days before. The ranges mean a missed run, or a failed send, is caught up the next day.
 * Bookings made in the last day are skipped, since they have just had their confirmation.
 */
const rounds = [
  { from: 5, to: 7, column: 'reminder_7d_at', template: 'reminder7d' },
  { from: 1, to: 2, column: 'reminder_48h_at', template: 'confirm48h' },
] as const;

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorised', { status: 401 });
  const db = serviceClient();
  const today = ukToday();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let count = 0;

  for (const { from, to, column, template } of rounds) {
    const { data } = await db.from('bookings')
      .select('id, manage_token, reference, details_complete, households(email, phone, channels), slots!inner(day, starts_at), visitors(first_name, kind)')
      .eq('status', 'confirmed').is(column, null).lt('created_at', dayAgo)
      .gte('slots.day', addDays(today, from)).lte('slots.day', addDays(today, to));
    for (const b of data ?? []) {
      const h = b.households as unknown as { email: string | null; phone: string | null; channels: ('email' | 'sms' | 'whatsapp')[] } | null;
      if (!h) continue;
      const s = b.slots as unknown as { day: string; starts_at: string };
      const name = (b.visitors as { first_name: string; kind: string }[]).find((v) => v.kind === 'visitor')?.first_name ?? 'your visitor';
      const visit = { name, when: visitWhen(s.day, s.starts_at), token: b.manage_token, reference: b.reference };
      const to = { email: h.email, phone: h.phone, channels: h.channels };
      const results = await send(to, templates[template](visit), { booking_id: b.id, template });
      if (template === 'reminder7d' && !b.details_complete) {
        await send(to, templates.missingDetails(visit), { booking_id: b.id, template: 'missingDetails' });
      }
      // Only mark it done if it reached them on at least one channel; otherwise try again tomorrow
      if (results.length && !results.some((r) => r.ok)) continue;
      await db.from('bookings').update({ [column]: new Date().toISOString() }).eq('id', b.id);
      count++;
    }
  }
  return Response.json({ reminded: count });
}
