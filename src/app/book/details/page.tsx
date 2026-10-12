import type { Metadata } from 'next';
import Link from 'next/link';
import { getSeason, getSlots } from '@/lib/public-data';
import { visitWhen } from '@/lib/dates';
import { BookingForm } from './booking-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Who is coming' };

export default async function Details({ searchParams }: { searchParams: Promise<{ slot?: string; day?: string }> }) {
  const { slot: slotId = '', day = '' } = await searchParams;
  const season = await getSeason();
  const slot = season?.booking_open ? (await getSlots(day)).find((s) => s.slot_id === slotId) : undefined;

  if (!slot || slot.state !== 'open') {
    return (
      <div className="content">
        <h1>That time is not available</h1>
        <p>Someone may have just booked it. Please choose another time.</p>
        <Link className="button" href={day ? `/book?day=${day}#times` : '/book'}>Choose another time</Link>
      </div>
    );
  }

  return (
    <>
      <Link className="back" href={`/book?day=${day}#times`}>Back to times</Link>
      <ol className="steps" aria-label="Booking steps">
        <li>1. Choose a time</li>
        <li aria-current="step">2. Who is coming</li>
        <li>3. Check your messages</li>
      </ol>
      <h1>Who is coming</h1>
      <div className="panel visit-card content">
        <span className="muted">Your visit</span>
        <span className="when">{visitWhen(day, slot.starts_at)}</span>
        <span>Until {slot.ends_at}. The time is yours once you book.</span>
      </div>
      <BookingForm slotId={slot.slot_id} />
    </>
  );
}
