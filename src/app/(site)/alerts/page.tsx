import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getSeason } from '@/lib/public-data';
import { AlertForm } from './alert-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Get an alert when booking opens' };

export default async function Alerts() {
  const season = await getSeason();
  return (
    <div className="wrap page" style={{ maxWidth: 1000 }}>
      <div className="card card-dotted" style={{ borderRadius: 32, padding: 40, display: 'flex', flexWrap: 'wrap', gap: '28px 40px', alignItems: 'center' }}>
        <Image src="/images/illustration-alerts.png" alt="" width={112} height={200} className="hero-art" style={{ maxHeight: 200 }} />
        <div style={{ flex: '1 1 480px', minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.4rem)' }}>Be first to know when booking opens</h1>
          {season?.booking_open ? (
            <div className="success"><p><strong>Booking is open now.</strong> <Link href="/#book">Book a visit</Link></p></div>
          ) : null}
          <p className="lead" style={{ marginBottom: 22 }}>Leave your details and we will email you as soon as the schedule is released, before we announce it anywhere else.</p>
          <AlertForm />
        </div>
      </div>
    </div>
  );
}
