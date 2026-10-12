import type { Metadata } from 'next';
import Link from 'next/link';
import { getDays, getSeason } from '@/lib/public-data';
import { dayName } from '@/lib/dates';
import { WaitlistForm } from './waitlist-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Waitlist' };

export default async function Waitlist({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const season = await getSeason();
  if (!season?.booking_open) {
    return (
      <div className="content">
        <h1>Waitlist</h1>
        <p>The waitlist opens when booking opens. <Link href="/alerts">Get an alert</Link> and we will tell you when.</p>
      </div>
    );
  }
  const { day } = await searchParams;
  const days = (await getDays(season.year)).map((d) => ({
    value: d.day, label: `${dayName(d.day)}${d.spaces_left ? ` (${d.spaces_left} times free now)` : ' (full)'}`,
  }));
  return (
    <div className="content">
      <h1>Join the waitlist</h1>
      <p className="lead">
        If the day you want is full, we will message you when a visit opens up, often because another family has had to
        cancel. The first family on the list gets the first offer.
      </p>
      <p>Times are still free on some days. <Link href="/book">See free times</Link></p>
      <WaitlistForm days={days} day={day} />
    </div>
  );
}
