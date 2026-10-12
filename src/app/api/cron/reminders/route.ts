import { db } from '@/lib/db';
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

type Due = {
  id: string; manage_token: string; reference: string; details_complete: boolean; first_name: string | null;
  email: string | null; phone: string | null; channels: ('email' | 'sms' | 'whatsapp')[]; day: string; starts_at: string;
};

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorised', { status: 401 });
  const sql = db();
  const today = ukToday();
  let count = 0;

  for (const { from, to, column, template } of rounds) {
    // column comes from the fixed list above, never from the request
    const due = await sql.query(`
      select b.id, b.manage_token, b.reference, b.details_complete,
             (select v.first_name from visitors v where v.booking_id = b.id and v.kind = 'visitor' order by v.created_at limit 1) as first_name,
             h.email::text as email, h.phone, h.channels::text[] as channels, sl.day::text as day, sl.starts_at::text as starts_at
      from bookings b
      join slots sl on sl.id = b.slot_id
      join households h on h.id = b.household_id
      where b.status = 'confirmed' and b.${column} is null and b.created_at < now() - interval '1 day'
        and sl.day between $1 and $2`, [addDays(today, from), addDays(today, to)]) as Due[];
    for (const b of due) {
      const visit = { name: b.first_name ?? 'your visitor', when: visitWhen(b.day, b.starts_at), token: b.manage_token, reference: b.reference };
      const recipient = { email: b.email, phone: b.phone, channels: b.channels };
      const results = await send(recipient, templates[template](visit), { booking_id: b.id, template });
      if (template === 'reminder7d' && !b.details_complete) {
        await send(recipient, templates.missingDetails(visit), { booking_id: b.id, template: 'missingDetails' });
      }
      // Only mark it done if it reached them on at least one channel; otherwise try again tomorrow
      if (results.length && !results.some((r) => r.ok)) continue;
      await sql.query(`update bookings set ${column} = now() where id = $1`, [b.id]);
      count++;
    }
  }
  return Response.json({ reminded: count });
}
