import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBooking } from '@/lib/public-data';
import { visitWhen } from '@/lib/dates';
import { ActionForm } from '@/components/form';
import { cancelBooking } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cancel visit', robots: { index: false }, referrer: 'no-referrer' };

export default async function Cancel({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBooking(token);
  if (!b) notFound();
  const back = `/booking/${token}`;
  if (b.started || !['confirmed', 'pending_review'].includes(b.status)) {
    return (
      <div className="narrow page"><div className="card card-lg">
        <h1 className="green" style={{ fontSize: '2rem' }}>This visit cannot be cancelled online</h1>
        <Link href={back}>Back to your visit</Link>
      </div></div>
    );
  }
  return (
    <div className="narrow page"><div className="card card-lg">
      <h1 className="green" style={{ fontSize: '2rem' }}>Cancel your visit?</h1>
      <p className="lead" style={{ fontWeight: 700 }}>{visitWhen(b.day, b.starts_at)}</p>
      <p>
        We will offer the time to a family on the waitlist straight away, so you will not be able to get it back. If a
        different day or time would suit you better, you can <Link href={`${back}/change`}>change your time</Link> instead.
      </p>
      <ActionForm action={cancelBooking.bind(null, token)} submitLabel="Yes, cancel our visit"
        secondary={<Link href={back} style={{ fontWeight: 700 }}>No, keep our visit</Link>}>
        {null}
      </ActionForm>
    </div></div>
  );
}
