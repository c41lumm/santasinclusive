import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getSeason, getSlots } from '@/lib/public-data';
import { visitWhen } from '@/lib/dates';
import { site } from '@/lib/site';
import { BookingForm } from './booking-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Book your visit' };

export default async function Details({ searchParams }: { searchParams: Promise<{ slot?: string; day?: string }> }) {
  const { slot: slotId = '', day = '' } = await searchParams;
  const season = await getSeason();
  const slot = season?.booking_open ? (await getSlots(day)).find((s) => s.slot_id === slotId) : undefined;
  const back = day ? `/?day=${day}#book` : '/#book';

  if (!slot || slot.state !== 'open') {
    return (
      <div className="narrow page">
        <h1 className="green" style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)' }}>That time is not available</h1>
        <p className="lead">Someone may have just booked it. Please choose another time.</p>
        <Link className="btn" href={back}>Choose another time</Link>
      </div>
    );
  }

  return (
    <div className="narrow page">
      <Link href={back} style={{ fontWeight: 700, display: 'inline-block', padding: '10px 0', marginBottom: 8 }}>Back to times</Link>
      <div style={{ marginBottom: 32 }}>
        <Image src="/images/illustration-child-form.png" alt="" width={89} height={190} className="float-art" />
        <p className="eyebrow">Book your visit</p>
        <h1 className="green" style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)' }}>Your details</h1>
        <p className="lead">Two short parts, then your time is booked. It is free.</p>
        <div className="card" style={{ borderRadius: 16, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '12px 28px', clear: 'both' }}>
          <p style={{ margin: 0 }}><strong>Visit:</strong> {visitWhen(day, slot.starts_at)}</p>
          <p style={{ margin: 0 }}><strong>Where:</strong> {site.address}</p>
        </div>
      </div>
      <BookingForm slotId={slot.slot_id} />
    </div>
  );
}
