import 'server-only';
import { asStaff, db } from '@/lib/db';
import { visitWhen } from '@/lib/dates';
import type { Visit } from '@/lib/notify/templates';

/** All reads here run as the signed-in staff member, so the database's row level security applies. */

export type SeasonInfo = { year: number; first_day: string; last_day: string; booking_open: boolean;
  visit_minutes: number; gap_minutes: number; families_per_slot: number; siblings_get_gift: boolean };
export async function adminSeason(): Promise<SeasonInfo | null> {
  const [rows] = await asStaff((sql) => [sql`
    select year, first_day::text as first_day, last_day::text as last_day, booking_open, visit_minutes, gap_minutes,
           families_per_slot, siblings_get_gift
    from seasons where last_day >= (now() at time zone 'Europe/London')::date - 60 order by year limit 1`]);
  return (rows[0] as SeasonInfo | undefined) ?? null;
}

export type OpeningDay = { day: string; opens_at: string; closes_at: string; closed: boolean; times: number; booked: number };
export async function openingDays(year: number): Promise<OpeningDay[]> {
  const [rows] = await asStaff((sql) => [sql`
    select od.day::text as day, to_char(od.opens_at, 'HH24:MI') as opens_at, to_char(od.closes_at, 'HH24:MI') as closes_at, od.closed,
           (select count(*)::int from slots sl where sl.day = od.day and not sl.blocked) as times,
           (select count(*)::int from bookings b join slots sl on sl.id = b.slot_id where sl.day = od.day and b.status in ('pending_review', 'confirmed')) as booked
    from opening_days od where extract(year from od.day)::int = ${year} order by od.day`]);
  return rows as OpeningDay[];
}

export type DayVisitor = {
  name: string; kind: 'visitor' | 'sibling'; age: number | null; communication: string[]; mobility: string[]; sensory: string[];
  loves: string | null; dislikes: string | null; calming: string | null; meet: string | null; gift: string | null;
  condition: string | null; medical: string | null; other: string | null;
};
export type DayRow = {
  slot_id: string; t: string; ends: string; blocked: boolean; offered_to: string | null;
  id: string | null; reference: string | null; status: string | null; reply: string | null; stage: string | null;
  details_complete: boolean | null; asked_to_confirm: boolean | null; type: string | null; group_name: string | null; group_staff: number | null;
  contact_name: string | null; email: string | null; phone: string | null; channels: string[] | null; visitors: DayVisitor[] | null;
};
/** One row per booking, plus one per free time or break, in time order */
export async function dayRows(day: string): Promise<DayRow[]> {
  const [rows] = await asStaff((sql) => [sql`
    select sl.id as slot_id, to_char(sl.starts_at, 'HH24:MI') as t, to_char(sl.ends_at, 'HH24:MI') as ends, sl.blocked,
           (select w.contact_name from waitlist_entries w where w.offer_slot_id = sl.id and w.status = 'offered'
              and w.offer_expires_at > now() limit 1) as offered_to,
           b.id, b.reference, b.status::text as status, b.reply::text as reply, b.stage::text as stage, b.details_complete, b.reminder_48h_at is not null as asked_to_confirm,
           b.type::text as type, b.group_name, b.group_staff,
           h.contact_name, h.email::text as email, h.phone, h.channels::text[] as channels,
           (select json_agg(json_build_object(
              'name', v.first_name, 'kind', v.kind, 'age', v.age, 'communication', v.communication, 'mobility', v.mobility,
              'sensory', v.sensory, 'loves', v.loves, 'dislikes', v.dislikes, 'calming', v.calming, 'meet', v.meet_preference,
              'gift', v.gift_ideas, 'condition', vs.condition, 'medical', vs.medical, 'other', vs.other_requirements)
              order by v.kind, v.created_at)
            from visitors v left join visitor_sensitive vs on vs.visitor_id = v.id where v.booking_id = b.id) as visitors
    from slots sl
    left join bookings b on b.slot_id = sl.id and b.status in ('pending_review', 'confirmed', 'attended', 'no_show')
    left join households h on h.id = b.household_id
    where sl.day = ${day}::date
    order by sl.starts_at, b.created_at`]);
  return rows as DayRow[];
}

/**
 * Who to message about a booking, with the details for the message. Reads the contact details and private link
 * with the server's own connection, so only call it after requireStaff().
 */
export async function contactForBooking(bookingId: string) {
  const [row] = await db()`
    select b.id, b.reference, b.manage_token, sl.day::text as day, sl.starts_at::text as starts_at,
           h.email::text as email, h.phone, h.channels::text[] as channels,
           (select v.first_name from visitors v where v.booking_id = b.id and v.kind = 'visitor' order by v.created_at limit 1) as first_name
    from bookings b join slots sl on sl.id = b.slot_id left join households h on h.id = b.household_id
    where b.id = ${bookingId}::uuid` as {
    id: string; reference: string; manage_token: string; day: string; starts_at: string;
    email: string | null; phone: string | null; channels: string[] | null; first_name: string | null;
  }[];
  if (!row) return null;
  const visit: Visit = { name: row.first_name ?? 'your visitor', when: visitWhen(row.day, row.starts_at), token: row.manage_token, reference: row.reference };
  return { bookingId: row.id, visit, email: row.email, phone: row.phone, channels: (row.channels ?? []) as ('email' | 'sms')[] };
}

export const isUuid = (s: string | undefined | null): s is string =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export type AdminSlot = { slot_id: string; t: string; ends: string; blocked: boolean; capacity: number; taken: number };
/** Every time on a day with how many places are taken (bookings and held waitlist offers) */
export async function daySlots(day: string): Promise<AdminSlot[]> {
  const [rows] = await asStaff((sql) => [sql`
    select sl.id as slot_id, to_char(sl.starts_at, 'HH24:MI') as t, to_char(sl.ends_at, 'HH24:MI') as ends, sl.blocked, sl.capacity,
           ((select count(*) from bookings b where b.slot_id = sl.id and b.status in ('pending_review', 'confirmed'))
            + (select count(*) from waitlist_entries w where w.offer_slot_id = sl.id and w.status = 'offered' and w.offer_expires_at > now()))::int as taken
    from slots sl where sl.day = ${day}::date order by sl.starts_at`]);
  return rows as AdminSlot[];
}

/** One booking's day, time and name, for page headings */
export async function bookingSummary(id: string) {
  const [rows] = await asStaff((sql) => [sql`
    select b.id, b.status::text as status, sl.day::text as day, to_char(sl.starts_at, 'HH24:MI') as t, h.contact_name,
           (select string_agg(v.first_name, ' and ') from visitors v where v.booking_id = b.id and v.kind = 'visitor') as names
    from bookings b join slots sl on sl.id = b.slot_id left join households h on h.id = b.household_id where b.id = ${id}::uuid`]);
  return (rows[0] as { id: string; status: string; day: string; t: string; contact_name: string | null; names: string | null } | undefined) ?? null;
}
