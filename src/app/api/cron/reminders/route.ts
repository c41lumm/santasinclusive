import { serviceClient } from '@/lib/supabase/server';
import { send } from '@/lib/notify/send';
import { templates } from '@/lib/notify/templates';
import { visitWhen } from '@/lib/dates';

const ukToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Daily at 09:00: a reminder 7 days before, and a please-confirm message 2 days before. */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorised', { status: 401 });
  const db = serviceClient();
  const today = ukToday();
  let count = 0;

  for (const [days, column, template] of [[7, 'reminder_7d_at', 'reminder7d'], [2, 'reminder_48h_at', 'confirm48h']] as const) {
    const { data } = await db.from('bookings')
      .select('id, manage_token, reference, details_complete, households(email, phone, channels), slots!inner(day, starts_at), visitors(first_name, kind)')
      .eq('status', 'confirmed').is(column, null).eq('slots.day', addDays(today, days));
    for (const b of data ?? []) {
      const h = b.households as unknown as { email: string | null; phone: string | null; channels: ('email' | 'sms' | 'whatsapp')[] };
      const s = b.slots as unknown as { day: string; starts_at: string };
      const name = (b.visitors as { first_name: string; kind: string }[]).find((v) => v.kind === 'visitor')?.first_name ?? 'your visitor';
      const visit = { name, when: visitWhen(s.day, s.starts_at), token: b.manage_token, reference: b.reference };
      await send({ email: h.email, phone: h.phone, channels: h.channels }, templates[template](visit), { booking_id: b.id, template });
      if (days === 7 && !b.details_complete) {
        await send({ email: h.email, phone: h.phone, channels: h.channels }, templates.missingDetails(visit), { booking_id: b.id, template: 'missingDetails' });
      }
      await db.from('bookings').update({ [column]: new Date().toISOString() }).eq('id', b.id);
      count++;
    }
  }
  return Response.json({ reminded: count });
}
