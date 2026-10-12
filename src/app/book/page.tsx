import type { Metadata } from 'next';
import Link from 'next/link';
import { getDays, getSeason, getSlots } from '@/lib/public-data';
import { dayName } from '@/lib/dates';
import { DayPicker, TimeList } from '@/components/pickers';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Book a visit' };

export default async function Book({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const season = await getSeason();
  if (!season?.booking_open) {
    return (
      <div className="content">
        <h1>Book a visit</h1>
        <div className="notice">
          <h2>Booking is not open yet</h2>
          <p>Leave your email or mobile number and we will tell you as soon as it opens.</p>
          <Link className="button" href="/alerts">Get an alert</Link>
        </div>
      </div>
    );
  }
  const { day } = await searchParams;
  const days = await getDays(season.year);
  const chosen = days.find((d) => d.day === day);
  const slots = chosen ? await getSlots(chosen.day) : [];

  return (
    <>
      <ol className="steps" aria-label="Booking steps">
        <li aria-current="step">1. Choose a time</li>
        <li>2. Who is coming</li>
        <li>3. Check your messages</li>
      </ol>
      <h1>Choose a day</h1>
      <p className="lead content">You can change your time later if you need to.</p>
      {days.length ? (
        <DayPicker days={days} selected={chosen?.day} href={(d) => `/book?day=${d}#times`} />
      ) : (
        <p>There are no days left to book this season.</p>
      )}

      {chosen ? (
        <section id="times" aria-labelledby="times-heading" className="content">
          <h2 id="times-heading">Times on {dayName(chosen.day)}</h2>
          {chosen.spaces_left === 0 ? (
            <div className="notice">
              <p>This day is full. Join the waitlist and we will message you if a time opens up.</p>
              <Link className="button" href={`/waitlist?day=${chosen.day}`}>Join the waitlist for this day</Link>
            </div>
          ) : (
            <TimeList slots={slots} href={(s) => `/book/details?slot=${s.slot_id}&day=${chosen.day}`} />
          )}
        </section>
      ) : null}
    </>
  );
}
