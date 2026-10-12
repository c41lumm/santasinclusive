import 'server-only';
import { asStaff } from '@/lib/db';

export type Volunteer = {
  id: string; name: string; role: 'santa' | 'elf' | 'lead_elf'; email: string; phone: string;
  available_days: string[]; available_weeks: string[]; day_types: string[];
};
export type Shift = { id: string; day: string; name: string; starts: string; ends: string; santas_needed: number; elves_needed: number;
  people: { volunteer_id: string; role: string }[] };

/** Approved volunteers only: applicants are not offered for shifts until approved on the Volunteers page */
export async function rotaData(year: number) {
  const [vols, shifts] = await asStaff((sql) => [
    sql`select id, name, role::text as role, email::text as email, phone, available_days::text[] as available_days, available_weeks, day_types
        from volunteers where status = 'approved' order by name`,
    sql`select s.id, s.day::text as day, s.name, to_char(s.starts_at, 'HH24:MI') as starts, to_char(s.ends_at, 'HH24:MI') as ends,
               s.santas_needed, s.elves_needed,
               coalesce((select json_agg(json_build_object('volunteer_id', a.volunteer_id, 'role', a.role)) from shift_assignments a where a.shift_id = s.id), '[]') as people
        from shifts s where extract(year from s.day)::int = ${year} order by s.day, s.starts_at`,
  ]) as unknown as [Volunteer[], Shift[]];
  return { vols, shifts };
}

/** Whether a volunteer said they could help on this day: the weeks they ticked, and weekdays or weekends */
export function canDo(v: Volunteer, day: string) {
  if (v.available_days.includes(day)) return true;
  const n = Number(day.slice(8, 10));
  const inWeek = v.available_weeks.some((w) => {
    const m = w.match(/^(\d+) to (\d+)/);
    return m ? n >= Number(m[1]) && n <= Number(m[2]) : false;
  });
  if (!inWeek) return false;
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
  const weekend = wd === 0 || wd === 6;
  return v.day_types.length === 0 || v.day_types.includes(weekend ? 'Weekends' : 'Weekdays');
}

/** A short description of when someone can help, for "Not available" lists */
export const availability = (v: Volunteer) =>
  [v.available_weeks.join(', '), v.day_types.filter((t) => t !== 'Evenings').join(' and ').toLowerCase()].filter(Boolean).join(', ') || 'no days given';
