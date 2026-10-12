import 'server-only';
import { db } from '@/lib/db';
import { visitWhen } from '@/lib/dates';
import type { Visit } from '@/lib/notify/templates';

/** Who to message about a booking, and the visit details for the message. Server only: it reads contact details. */
export async function bookingContact(token: string) {
  const [row] = await db()`
    select b.id, b.reference, b.manage_token, sl.day::text as day, sl.starts_at::text as starts_at,
           h.email::text as email, h.phone, h.channels::text[] as channels,
           (select v.first_name from visitors v where v.booking_id = b.id and v.kind = 'visitor' order by v.created_at limit 1) as first_name
    from bookings b join slots sl on sl.id = b.slot_id left join households h on h.id = b.household_id
    where b.manage_token = ${token}::uuid` as {
    id: string; reference: string; manage_token: string; day: string; starts_at: string;
    email: string | null; phone: string | null; channels: ('email' | 'sms' | 'whatsapp')[] | null; first_name: string | null;
  }[];
  if (!row) return null;
  const visit: Visit = { name: row.first_name ?? 'your visitor', when: visitWhen(row.day, row.starts_at), token: row.manage_token, reference: row.reference };
  const to = { email: row.email, phone: row.phone, channels: row.channels ?? [] };
  return { bookingId: row.id, visit, to };
}
