import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getDays, getSeason } from '@/lib/public-data';
import { dayName } from '@/lib/dates';
import { WaitlistForm } from './waitlist-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Waitlist' };

export default async function Waitlist({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const season = await getSeason();
  const { day } = await searchParams;
  const days = season?.booking_open ? await getDays(season.year) : [];
  const chosen = days.find((d) => d.day === day);
  return (
    <div className="narrow page" style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
        <Image src="/images/illustration-alerts.png" alt="" width={61} height={110} />
        <div>
          <p className="eyebrow">Waitlist</p>
          <h1 className="green" style={{ fontSize: 'clamp(2rem, 5vw, 2.6rem)', margin: 0 }}>Be first to know about a cancelled slot</h1>
        </div>
      </div>
      {!season?.booking_open ? (
        <div className="card card-lg">
          <p>The waitlist opens when booking opens.</p>
          <Link className="btn" href="/#alerts">Get an alert</Link>
        </div>
      ) : (
        <section aria-labelledby="join-h" className="card card-lg">
          <p className="eyebrow">{chosen && !chosen.spaces_left ? 'Date is full' : 'Join the waitlist'}</p>
          <h2 id="join-h" className="green" style={{ fontSize: '1.65rem' }}>
            {chosen ? (chosen.spaces_left ? `Waitlist for ${dayName(chosen.day)}` : `${dayName(chosen.day)} is fully booked`) : 'Choose the day you would like'}
          </h2>
          <p style={{ marginBottom: 20 }}>Join the waitlist and we will message you the moment a slot opens, before anyone else hears.
            {chosen?.spaces_left ? <> Times are still free on this day: <Link href={`/?day=${chosen.day}#book`}>book one now</Link>.</> : null}</p>
          <WaitlistForm day={chosen?.day} days={days.map((d) => ({
            value: d.day, label: `${dayName(d.day)}${d.spaces_left ? ` (${d.spaces_left} times free now)` : ' (full)'}`,
          }))} />
        </section>
      )}
    </div>
  );
}
