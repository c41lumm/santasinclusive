import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getBooking } from '@/lib/public-data';
import { visitWhen } from '@/lib/dates';
import { site } from '@/lib/site';
import { saveDetails } from '../actions';
import { DetailsForm } from '../details-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tell us about who is visiting', robots: { index: false }, referrer: 'no-referrer' };

/** The "About your child" form from the design */
export default async function About({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBooking(token);
  if (!b) notFound();
  if (b.started || !['confirmed', 'pending_review'].includes(b.status)) redirect(`/booking/${token}`);
  return (
    <div className="narrow page">
      <Link href={`/booking/${token}`} style={{ fontWeight: 700, display: 'inline-block', padding: '10px 0', marginBottom: 8 }}>Back to your visit</Link>
      <div style={{ marginBottom: 32 }}>
        <Image src="/images/illustration-child-form.png" alt="" width={89} height={190} className="float-art" />
        <p className="eyebrow">Your booking is saved</p>
        <h1 className="green" style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)' }}>Tell us about who is visiting</h1>
        <p className="lead">This takes about five minutes. Santa and the elves read it before your visit, so every moment is made for them.</p>
        <div className="card" style={{ borderRadius: 16, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '12px 28px', clear: 'both' }}>
          <p style={{ margin: 0 }}><strong>Visit:</strong> {visitWhen(b.day, b.starts_at)}</p>
          <p style={{ margin: 0 }}><strong>Where:</strong> {site.address}</p>
        </div>
      </div>
      <DetailsForm action={saveDetails.bind(null, token)} visitors={b.visitors} photoConsent={b.photo_consent} />
      <p className="small" style={{ marginTop: 16 }}>You can change these details any time before your visit, using the link in your confirmation message.</p>
    </div>
  );
}
