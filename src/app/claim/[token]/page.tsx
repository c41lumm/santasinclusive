import type { Metadata } from 'next';
import Link from 'next/link';
import { getOffer } from '@/lib/public-data';
import { visitWhen } from '@/lib/dates';
import { ActionForm } from '@/components/form';
import { claimOffer } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Claim your visit', robots: { index: false }, referrer: 'no-referrer' };

/** From a waitlist offer message. Claiming is a button, as email scanners open links by themselves. */
export default async function Claim({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await getOffer(token);

  if (!offer || offer.status !== 'offered' || offer.expired) {
    return (
      <div className="content">
        <h1>{offer?.status === 'claimed' ? 'You have already claimed this visit' : 'Sorry, this offer has ended'}</h1>
        {offer?.status === 'claimed' ? (
          <p>Use the link in your booking message to see your visit.</p>
        ) : (
          <>
            <p>Offers are held for a short time, then passed to the next family on the waitlist.</p>
            <p><Link href="/book">See if other times are free</Link></p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="content">
      <h1>A visit to Santa is yours if you want it</h1>
      <div className="panel visit-card">
        <span className="when">{visitWhen(offer.day, offer.starts_at)}</span>
        <span>Held for you until {offer.until} today.</span>
      </div>
      <ActionForm action={claimOffer.bind(null, token)} submitLabel="Claim this visit" turnstile={false}>
        {null}
      </ActionForm>
      <p style={{ marginTop: '1.5rem' }}>Cannot make this time? Do nothing, and we will offer it to the next family.</p>
    </div>
  );
}
