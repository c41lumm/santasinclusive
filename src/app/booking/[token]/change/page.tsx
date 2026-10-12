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
      <div className="content">
        <h1>This visit cannot be changed online</h1>
        <p>Please contact us and we will help.</p>
        <Link href={back}>Back to your visit</Link>
      </div>
    );
  }

  const days = await getDays(season.year);
  const chosen = days.find((d) => d.day === day);
  const slots = chosen ? await getSlots(chosen.day) : [];
  const picked = slots.find((s) => s.slot_id === slot && s.state === 'open');

  if (chosen && picked) {
    return (
      <div className="content">
        <Link className="back" href={`${back}/change?day=${chosen.day}#times`}>Back to times</Link>
        <h1>Move your visit?</h1>
        <dl className="summary-list panel">
          <dt>From</dt><dd>{visitWhen(b.day, b.starts_at)}</dd>
          <dt>To</dt><dd><strong>{visitWhen(chosen.day, picked.starts_at)}</strong></dd>
        </dl>
        <p>Your old time will be offered to a family on the waitlist.</p>
        <ActionForm action={moveBooking.bind(null, token, picked.slot_id)} submitLabel="Move my visit" turnstile={false}
          secondary={<Link href={back}>Keep my current time</Link>}>
          {null}
        </ActionForm>
      </div>
    );
  }

  return (
    <>
      <Link className="back" href={back}>Back to your visit</Link>
      <h1>Choose a new time</h1>
      <p className="lead content">Your visit is on {visitWhen(b.day, b.starts_at)}. It stays booked until you confirm the new time.</p>
      <DayPicker days={days} selected={chosen?.day} href={(d) => `${back}/change?day=${d}#times`} />
      {chosen ? (
        <section id="times" aria-labelledby="times-heading" className="content">
          <h2 id="times-heading">Times on {dayName(chosen.day)}</h2>
          <TimeList slots={slots} href={(s) => `${back}/change?day=${chosen.day}&slot=${s.slot_id}`} />
        </section>
      ) : null}
    </>
  );
}
