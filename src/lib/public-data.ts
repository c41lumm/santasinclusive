import 'server-only';
import { asPublic } from '@/lib/db';

/** Dates always come back as text (YYYY-MM-DD), never as JavaScript dates, which shift with time zones */

export type Season = { year: number; first_day: string; last_day: string; booking_open: boolean };
export async function getSeason(): Promise<Season | null> {
  const [rows] = await asPublic((sql) => [sql`
    select year, first_day::text as first_day, last_day::text as last_day, booking_open from current_season()`]);
  return (rows[0] as Season | undefined) ?? null;
}

export type Day = { day: string; spaces_left: number };
export async function getDays(year: number): Promise<Day[]> {
  const [rows] = await asPublic((sql) => [sql`select day::text as day, spaces_left from available_days(${year})`]);
  return rows as Day[];
}

export type Slot = { slot_id: string; starts_at: string; ends_at: string; spaces_left: number; state: 'open' | 'full' | 'break' };
export async function getSlots(day: string): Promise<Slot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
  const [rows] = await asPublic((sql) => [sql`
    select slot_id, to_char(starts_at, 'HH24:MI') as starts_at, to_char(ends_at, 'HH24:MI') as ends_at, spaces_left, state
    from available_slots(${day}::date)`]);
  return rows as Slot[];
}

export const isToken = (t: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);

export type BookingVisitor = {
  id: string; kind: 'visitor' | 'sibling'; first_name: string; age: number | null; sex: string | null; pronouns: string | null;
  communication: string[]; mobility: string[]; sensory: string[]; loves: string | null; dislikes: string | null;
  calming: string | null; meet_preference: string | null; gift_ideas: string | null; condition: string | null;
  medical: string | null; other_requirements: string | null;
};
export type Booking = {
  reference: string; status: 'pending_review' | 'confirmed' | 'cancelled' | 'attended' | 'no_show';
  reply: 'awaiting' | 'confirmed' | 'no_reply'; day: string; starts_at: string; ends_at: string; started: boolean;
  contact_name: string | null; details_complete: boolean; photo_consent: 'share' | 'family_only' | 'none';
  visitors: BookingVisitor[];
};
export async function getBooking(token: string): Promise<Booking | null> {
  if (!isToken(token)) return null;
  const [rows] = await asPublic((sql) => [sql`select get_booking(${token}::uuid) as b`]);
  return (rows[0]?.b as Booking | null) ?? null;
}

export type Offer = { status: string; day: string; starts_at: string; until: string; expired: boolean };
export async function getOffer(token: string): Promise<Offer | null> {
  if (!isToken(token)) return null;
  const [rows] = await asPublic((sql) => [sql`
    select status, day::text as day, starts_at, to_char(expires_at at time zone 'Europe/London', 'HH24:MI') as until, expired
    from get_offer(${token}::uuid)`]);
  return (rows[0] as Offer | undefined) ?? null;
}
