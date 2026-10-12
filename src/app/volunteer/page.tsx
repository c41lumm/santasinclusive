import type { Metadata } from 'next';
import { getSeason } from '@/lib/public-data';
import { dayName } from '@/lib/dates';
import { VolunteerForm } from './volunteer-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Volunteer' };

const between = (first: string, last: string) => {
  const out: string[] = [];
  for (let d = new Date(`${first}T12:00:00Z`); d <= new Date(`${last}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

export default async function Volunteer() {
  const season = await getSeason();
  const days = season ? between(season.first_day, season.last_day).map((d) => ({ value: d, label: dayName(d) })) : [];
  return (
    <div className="content">
      <h1>Volunteer with us</h1>
      <p className="lead">
        Our elves and Santas make each visit calm and special. You do not need experience, just patience and kindness.
        We will arrange a chat, and the checks the role needs.
      </p>
      {days.length ? <VolunteerForm days={days} /> : <p>Volunteering for next season opens soon.</p>}
    </div>
  );
}
