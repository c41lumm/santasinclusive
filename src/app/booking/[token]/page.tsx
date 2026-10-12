import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBooking } from '@/lib/public-data';
import { visitWhen } from '@/lib/dates';
import { saveDetails } from './actions';
import { DetailsForm } from './details-form';

export const dynamic = 'force-dynamic';
// The link is private to the family, so keep it out of search engines and other sites' logs
export const metadata: Metadata = { title: 'Your visit', robots: { index: false }, referrer: 'no-referrer' };

const banners: Record<string, string> = {
  saved: 'Thank you. Santa will read this before your visit.',
  moved: 'Your visit has moved. We have sent you the new time.',
  cancelled: 'Your visit is cancelled, so the time is free for another family. Thank you for letting us know.',
  confirmed: 'Thank you for confirming. We look forward to seeing you.',
  claimed: 'You are booked in. Please tell us who is coming below.',
};

export default async function Visit({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const b = await getBooking(token);
  if (!b) notFound();

  const when = visitWhen(b.day, b.starts_at);
  const active = b.status === 'confirmed' || b.status === 'pending_review';
  const canChange = active && !b.started;
  const daysAway = Math.round((Date.parse(`${b.day}T12:00:00Z`) - Date.now()) / 86_400_000);
  const main = b.visitors.find((v) => v.kind === 'visitor')?.first_name;

  return (
    <div className="content">
      {done && banners[done] ? <div className="success" role="status"><p>{banners[done]}</p></div> : null}
      <h1>{main ? `${main}'s visit to Santa` : 'Your visit to Santa'}</h1>

      <div className="panel visit-card">
        <span className="when">{when}</span>
        <span>Until {b.ends_at}, at 20 Freeschool Lane, Leicester LE1 4FY</span>
        <dl className="summary-list" style={{ marginTop: '0.75rem' }}>
          <dt>Reference</dt><dd>{b.reference}</dd>
          <dt>Status</dt>
          <dd>{{
            confirmed: 'Booked', pending_review: 'Booked. We will be in touch to confirm.', cancelled: 'Cancelled',
            attended: 'Visited', no_show: 'Missed',
          }[b.status]}</dd>
        </dl>
      </div>

      {active && b.reply === 'awaiting' && daysAway <= 3 && !b.started ? (
        <div className="notice">
          <p><strong>Are you still coming?</strong> Please let us know, so we can offer the time to another family if not.</p>
          <Link className="button" href={`/booking/${token}/confirm`}>Yes, we are coming</Link>
        </div>
      ) : null}

      {canChange ? (
        <div className="actions" style={{ marginTop: 0 }}>
          <Link className="button secondary" href={`/booking/${token}/change`}>Change time</Link>
          <Link className="button secondary" href={`/booking/${token}/cancel`}>Cancel visit</Link>
        </div>
      ) : null}

      {canChange ? (
        <>
          <h2 id="tell-santa">Tell Santa about {b.visitors.length > 1 || !main ? 'everyone' : main}</h2>
          {!b.details_complete ? (
            <p>
              The more Santa knows, the better the visit. It takes about five minutes, and you can come back and change it
              at any time before your visit. Every question is optional.
            </p>
          ) : <p>You can change this at any time before your visit.</p>}
          <DetailsForm action={saveDetails.bind(null, token)} visitors={b.visitors} photoConsent={b.photo_consent} />
        </>
      ) : b.status === 'cancelled' ? (
        <p><Link href="/book">Book another visit</Link></p>
      ) : null}

      <h2>Getting here</h2>
      <p>
        <a href="https://www.google.com/maps/dir/?api=1&destination=20+Freeschool+Ln+Leicester+LE1+4FY">
          Directions to 20 Freeschool Lane<span className="visually-hidden"> (opens Google Maps)</span>
        </a>
      </p>
      <p className="muted">Keep this link private: anyone with it can see and change your booking.</p>
    </div>
  );
}
