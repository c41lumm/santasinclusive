import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asPublic } from '@/lib/db';
import { isToken } from '@/lib/public-data';
import { dayName } from '@/lib/dates';
import { ActionForm } from '@/components/form';
import { leaveWaitlist } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Leave the waitlist', robots: { index: false }, referrer: 'no-referrer' };

/** From the link in the "you're on the waitlist" message. Leaving is a button, as email scanners open links. */
export default async function Leave({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  if (!isToken(token)) notFound();
  const [rows] = await asPublic((sql) => [sql`select day::text as day, status from get_waitlist_entry(${token}::uuid)`]);
  const entry = rows[0] as { day: string; status: string } | undefined;
  if (!entry) notFound();
  const left = done || !['waiting', 'offered'].includes(entry.status);
  return (
    <div className="narrow page" style={{ maxWidth: 760 }}>
      <div className="card card-lg">
        {left ? (
          <div role="status">
            <h1 className="green" style={{ fontSize: '2rem' }}>You have left the waitlist</h1>
            <p>You will not hear from us about {dayName(entry.day)}. Thank you for letting us know.</p>
            <Link href="/">Back to the homepage</Link>
          </div>
        ) : (
          <>
            <h1 className="green" style={{ fontSize: '2rem' }}>Leave the waitlist for {dayName(entry.day)}?</h1>
            <p>We will stop holding your place, and the next family will hear first if a slot opens.</p>
            <ActionForm action={leaveWaitlist.bind(null, token)} submitLabel="Leave the waitlist"
              secondary={<Link href="/" style={{ fontWeight: 700 }}>Stay on the list</Link>}>{null}</ActionForm>
          </>
        )}
      </div>
    </div>
  );
}
