import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBooking, getDays, getSeason, getSlots } from '@/lib/public-data';
import { dayName, visitWhen } from '@/lib/dates';
import { DayPicker, TimeList } from '@/components/pickers';
import { ActionForm } from '@/components/form';
import { moveBooking } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Change time', robots: { index: false }, referrer: 'no-referrer' };

export default async function Change({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ day?: string; slot?: string }>;
}) {
  const { token } = await params;
  const { day, slot } = await searchParams;
  const b = await getBooking(token);
  if (!b) notFound();
  const back = `/booking/${token}`;
  const season = await getSeason();
  if (b.started || !['confirmed', 'pending_review'].includes(b.status) || !season?.booking_open) {
    return (
      <div className="narrow page"><div className="card card-lg">
        <h1 className="green" style={{ fontSize: '2rem' }}>This visit cannot be changed online</h1>
        <p>Please contact us and we will help.</p>
        <Link href={back}>Back to your visit</Link>
      </div></div>
    );
  }

  const days = await getDays(season.year);
  const chosen = days.find((d) => d.day === day);
  const slots = chosen ? await getSlots(chosen.day) : [];
  const picked = slots.find((s) => s.slot_id === slot && s.state === 'open');

  if (chosen && picked) {
    return (
      <div className="narrow page">
        <Link href={`${back}/change?day=${chosen.day}#times`} style={{ fontWeight: 700, display: 'inline-block', padding: '10px 0', marginBottom: 8 }}>Back to times</Link>
        <div className="card card-lg">
          <h1 className="green" style={{ fontSize: '2rem' }}>Move your visit?</h1>
          <dl className="summary-list panel">
            <dt>From</dt><dd>{visitWhen(b.day, b.starts_at)}</dd>
            <dt>To</dt><dd><strong>{visitWhen(chosen.day, picked.starts_at)}</strong></dd>
          </dl>
          <p>Your old time will be offered to a family on the waitlist.</p>
          <ActionForm action={moveBooking.bind(null, token, picked.slot_id)} submitLabel="Move my visit"
            secondary={<Link href={back} style={{ fontWeight: 700 }}>Keep my current time</Link>}>
            {null}
          </ActionForm>
        </div>
      </div>
    );
  }

  return (
    <div className="narrow page">
      <Link href={back} style={{ fontWeight: 700, display: 'inline-block', padding: '10px 0', marginBottom: 8 }}>Back to your visit</Link>
      <p className="eyebrow">Change time</p>
      <h1 className="green" style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)' }}>Choose a new time</h1>
      <p className="lead">Your visit is on {visitWhen(b.day, b.starts_at)}. It stays booked until you confirm the new time.</p>
      <div className="card" style={{ background: 'var(--cream)', borderRadius: 32 }}>
        <DayPicker days={days} selected={chosen?.day} href={(d) => `${back}/change?day=${d}#times`} />
        {chosen ? (
          <section id="times" aria-labelledby="times-heading" style={{ marginTop: 26 }}>
            <h2 id="times-heading" style={{ fontSize: '1.5rem', fontWeight: 600 }}>Choose a time on {dayName(chosen.day)}</h2>
            <TimeList slots={slots} href={(s) => `${back}/change?day=${chosen.day}&slot=${s.slot_id}`} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
