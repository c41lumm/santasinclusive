import type { Metadata } from 'next';
import Link from 'next/link';
import { getSeason } from '@/lib/public-data';
import { AlertForm } from './alert-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Get an alert when booking opens' };

export default async function Alerts() {
  const season = await getSeason();
  return (
    <div className="content">
      <h1>Get an alert when booking opens</h1>
      {season?.booking_open ? (
        <div className="notice"><p><strong>Booking is open now.</strong> <Link href="/book">Book a visit</Link></p></div>
      ) : null}
      <p className="lead">Visits go quickly. We will message you once, as soon as booking opens. We delete your details after the season.</p>
      <AlertForm />
    </div>
  );
}
