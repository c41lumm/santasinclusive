'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { asStaff } from '@/lib/db';
import { problem, text, type FormState } from '@/lib/forms';

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const plan = z.object({
  year: z.number().int(),
  visit_minutes: z.number().int().min(5).max(60),
  gap_minutes: z.number().int().min(0).max(30),
  families_per_slot: z.number().int().min(1).max(6),
  days: z.array(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), opens_at: hm, closes_at: hm, closed: z.boolean(), own_breaks: z.boolean() })).max(60),
  every_day_breaks: z.array(hm).max(40),
  day_breaks: z.record(z.string(), z.array(hm).max(40)),
});

/** "Save changes": settings, hours and breaks together, then the bookable times are rebuilt. All or nothing. */
export async function saveTimes(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff(['admin']);
  let input: unknown;
  try { input = JSON.parse(text(fd, 'plan') ?? ''); } catch { return problem('Something went wrong reading the changes. Please reload the page.'); }
  const parsed = plan.safeParse(input);
  if (!parsed.success) return problem('Some of the times are not valid. Please check them.');
  const p = parsed.data;
  const bad = p.days.find((d) => !d.closed && d.opens_at >= d.closes_at);
  if (bad) return problem(`The grotto must open before it closes on ${bad.day}.`);
  const dayBreaks = Object.entries(p.day_breaks).flatMap(([day, ts]) => ts.map((t) => ({ day, t })));
  try {
    await asStaff((sql) => [
      sql`update seasons set visit_minutes = ${p.visit_minutes}, gap_minutes = ${p.gap_minutes}, families_per_slot = ${p.families_per_slot}
          where year = ${p.year}`,
      sql`update opening_days od set opens_at = d.opens_at::time, closes_at = d.closes_at::time, closed = d.closed, own_breaks = d.own_breaks
          from jsonb_to_recordset(${JSON.stringify(p.days)}::jsonb) as d(day date, opens_at text, closes_at text, closed boolean, own_breaks boolean)
          where od.day = d.day`,
      sql`delete from blocked_times where day is null or extract(year from day)::int = ${p.year}`,
      sql`insert into blocked_times (day, starts_at, reason) select null, t::time, 'Break' from unnest(${p.every_day_breaks}::text[]) as t`,
      sql`insert into blocked_times (day, starts_at, reason) select (x->>'day')::date, (x->>'t')::time, 'Break' from jsonb_array_elements(${JSON.stringify(dayBreaks)}::jsonb) as x`,
      sql`select regenerate_season(${p.year})`,
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('BOOKINGS_AFFECTED')) {
      return problem('Nothing was saved: some families are booked at times these changes would remove or block. Move those families first (on Bookings), then save again.');
    }
    return problem('Nothing was saved. Please try again.');
  }
  revalidatePath('/admin', 'layout');
  revalidatePath('/', 'layout');
  return { done: 'Saved. The calendar families see has been updated.' };
}

export async function setBookingOpen(year: number, open: boolean) {
  await requireStaff(['admin']);
  await asStaff((sql) => [sql`update seasons set booking_open = ${open} where year = ${year}`]);
  revalidatePath('/admin', 'layout');
  revalidatePath('/', 'layout');
}
