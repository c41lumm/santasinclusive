import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getBooking } from '@/lib/public-data';
import { visitWhen } from '@/lib/dates';
import { ActionForm } from '@/components/form';
import { confirmVisit } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Confirm your visit', robots: { index: false }, referrer: 'no-referrer' };

/** From the message sent two days before. Confirming is a button, as email scanners open links by themselves. */
export default async function Confirm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBooking(token);
  if (!b) notFound();
  const back = `/booking/${token}`;
  if (b.reply === 'confirmed') redirect(`${back}?done=confirmed`);
  if (b.started || !['confirmed', 'pending_review'].includes(b.status)) redirect(back);
  return (
    <div className="narrow page"><div className="card card-lg">
      <h1 className="green" style={{ fontSize: '2rem' }}>Are you still coming?</h1>
      <p className="lead" style={{ fontWeight: 700 }}>{visitWhen(b.day, b.starts_at)}</p>
      <ActionForm action={confirmVisit.bind(null, token)} submitLabel="Yes, we are coming"
        secondary={<Link href={`${back}/change`} style={{ fontWeight: 700 }}>We need a different time</Link>}>
        {null}
      </ActionForm>
      <p style={{ marginTop: '1.5rem', marginBottom: 0 }}>Cannot come at all? <Link href={`${back}/cancel`}>Cancel your visit</Link> so another family can have the time.</p>
    </div></div>
  );
}
