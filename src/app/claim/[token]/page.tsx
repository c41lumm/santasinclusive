import type { Metadata } from 'next';
import Link from 'next/link';
import { getOffer } from '@/lib/public-data';
import { visitWhen } from '@/lib/dates';
import { claimOffer, declineOffer } from './actions';
import { ClaimButtons } from './claim-buttons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'A slot has opened', robots: { index: false }, referrer: 'no-referrer' };

/** From a waitlist offer message. Claiming is a button, as email scanners open links by themselves. */
export default async function Claim({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await getOffer(token);
  const live = offer && offer.status === 'offered' && !offer.expired;

  return (
    <div className="narrow page" style={{ maxWidth: 640 }}>
      <div className="card card-lg">
        <p className="eyebrow">Waitlist</p>
        {live ? (
          <>
            <h1 className="green" style={{ fontSize: '2rem' }}>A slot has opened for you</h1>
            <div style={{ border: '2px solid var(--green)', borderRadius: 20, padding: 24 }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: 4 }}>{visitWhen(offer.day, offer.starts_at)}</h2>
              <p className="muted" style={{ marginBottom: 16 }}>Held for you until {offer.until} today.</p>
              <ClaimButtons claim={claimOffer.bind(null, token)} decline={declineOffer.bind(null, token)} />
            </div>
            <p className="small" style={{ marginTop: 14 }}>Claiming takes you straight to the “about the visitor” form.</p>
          </>
        ) : (
          <>
            <h1 className="green" style={{ fontSize: '2rem' }}>{offer?.status === 'claimed' ? 'You have already claimed this slot' : 'Sorry, this offer has ended'}</h1>
            {offer?.status === 'claimed' ? (
              <p>Use the link in your booking message to see your visit.</p>
            ) : (
              <>
                <p>Offers are held for a short time, then passed to the next family on the waitlist.</p>
                <Link className="btn" href="/#book">See if other times are free</Link>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
