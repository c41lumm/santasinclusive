import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBooking, getSeason } from '@/lib/public-data';
import { visitWhen } from '@/lib/dates';
import { site } from '@/lib/site';
import { Bell, Calendar, Check, Clock, Family, Map, Pin } from '@/components/icons';

export const dynamic = 'force-dynamic';
// The link is private to the family, so keep it out of search engines and other sites' logs
export const metadata: Metadata = { title: 'Your visit', robots: { index: false }, referrer: 'no-referrer' };

const banners: Record<string, string> = {
  saved_later: 'Saved. You can finish telling us about your visitors any time before your visit, from this page.',
  moved: 'Your visit has moved. We have sent you the new time.',
  cancelled: 'Your visit is cancelled, so the time is free for another family. Thank you for letting us know.',
  confirmed: 'Thank you for confirming. We look forward to seeing you.',
  claimed: 'The visit is yours. Please tell us about who is coming, so Santa and the elves can get ready.',
};

const minutesBetween = (a: string, b: string) => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return m(b) - m(a);
};

/** The family's own page, from the link in their messages (the "Booking confirmed" design) */
export default async function Visit({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const b = await getBooking(token);
  if (!b) notFound();

  const base = `/booking/${token}`;
  const active = b.status === 'confirmed' || b.status === 'pending_review';
  const canChange = active && !b.started;
  const daysAway = Math.round((Date.parse(`${b.day}T12:00:00Z`) - Date.now()) / 86_400_000);
  const main = b.visitors.filter((v) => v.kind === 'visitor').map((v) => v.first_name);
  const others = b.visitors.filter((v) => v.kind === 'sibling').map((v) => v.first_name);
  const name = main.length ? (main.length > 1 ? `${main.slice(0, -1).join(', ')} and ${main.at(-1)}` : main[0]) : '';
  const who = !b.visitors.length ? 'Not told us yet'
    : `${name || 'Your visitor'}${others.length ? `, with ${others.length > 1 ? `${others.slice(0, -1).join(', ')} and ${others.at(-1)}` : others[0]}` : ''}`;

  const heading = {
    confirmed: "You're booked in!", pending_review: 'We have your request', cancelled: 'This visit is cancelled',
    attended: 'Thank you for visiting', no_show: 'We missed you',
  }[b.status];
  const pill = {
    confirmed: 'Booking confirmed', pending_review: 'Request received', cancelled: 'Cancelled', attended: 'Visited', no_show: 'Missed',
  }[b.status];

  return (
    <div className="wrap page" style={{ maxWidth: 1140 }}>
      {done && banners[done] ? <div className="success" role="status"><p>{banners[done]}</p></div> : null}

      <section aria-labelledby="done-h" className="hero" style={{ marginBottom: 40 }}>
        <Image src="/images/illustration-santa-waving.png" alt="Santa smiling and waving" width={213} height={300} className="hero-art" style={{ maxHeight: 300 }} priority />
        <div className="text" style={{ flexBasis: 460 }}>
          <p className="status-pill">{active ? <Check size={20} /> : null}{pill}</p>
          <h1 id="done-h">{heading}</h1>
          {active ? <p className="lead" style={{ fontSize: '1.22rem', marginBottom: 8 }}>
            {b.status === 'pending_review' ? 'We will be in touch to confirm it soon.' : name ? `Santa can't wait to meet ${name}.` : "Santa can't wait to meet you."}
          </p> : null}
          <p className="muted" style={{ margin: 0 }}>Your booking reference is <strong style={{ color: 'var(--text)' }}>{b.reference}</strong>.</p>
        </div>
      </section>

      <div className="split">
        <section aria-labelledby="visit-h" className="card main">
          <h2 id="visit-h" style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: 4 }}>Your visit</h2>
          <div className="detail-row"><span className="icon-circle sm"><Calendar size={24} /></span>
            <div><p className="label">Date and time</p><p className="value">{visitWhen(b.day, b.starts_at)}</p></div></div>
          <div className="detail-row"><span className="icon-circle sm"><Clock size={24} /></span>
            <div><p className="label">Visit length</p><p className="value">{minutesBetween(b.starts_at, b.ends_at)} minutes with Santa, with no rush</p></div></div>
          <div className="detail-row"><span className="icon-circle sm"><Family size={24} /></span>
            <div><p className="label">Who is coming</p><p className="value">{who}</p></div></div>
          <div className="detail-row"><span className="icon-circle sm"><Pin size={24} /></span>
            <div><p className="label">Where</p><p className="value">{site.address}</p></div></div>
          <div className="btn-row" style={{ marginTop: 24 }}>
            {active ? <a className="btn" href={`${base}/calendar`}><Calendar size={22} color="#FFFFFF" /> Add to calendar</a> : null}
            <a className="btn btn-outline" href={site.directions}><Map size={22} /> Get directions<span className="visually-hidden"> (opens Google Maps)</span></a>
          </div>
        </section>

        <aside className="side stack">
          {canChange && b.reply === 'awaiting' && daysAway <= 3 ? (
            <section aria-labelledby="coming-h" className="card card-warn">
              <h2 id="coming-h" style={{ fontSize: '1.5rem', fontWeight: 600 }}>Are you still coming?</h2>
              <p>Please let us know, so we can offer the time to another family if not.</p>
              <Link className="btn" href={`${base}/confirm`}>Yes, we are coming</Link>
            </section>
          ) : null}

          {canChange ? (b.details_complete ? (
            <section aria-labelledby="ready-h" className="card card-pale">
              <h2 id="ready-h" className="green" style={{ fontSize: '1.5rem', fontWeight: 600 }}>Santa has your notes</h2>
              <p>Thank you for telling us about {name || 'your visitors'}. You can change anything before your visit.</p>
              <Link href={`${base}/about`} style={{ fontWeight: 700 }}>Change what you told us</Link>
            </section>
          ) : (
            <section aria-labelledby="todo-h" className="card card-warn">
              <h2 id="todo-h" style={{ fontSize: '1.5rem', fontWeight: 600 }}>One last thing</h2>
              <p>Tell us about {name || 'who is coming'} so Santa and the elves can get ready. It takes about five minutes.</p>
              <Link className="btn" href={`${base}/about`}>Tell us about {name || 'your visitors'}</Link>
            </section>
          )) : null}

          {active && !b.started ? (
            <section aria-labelledby="rem-h" className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}><Bell /><h2 id="rem-h" style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Your reminders</h2></div>
              <p>We will message you a week before and two days before your visit, with directions and a link to change plans.</p>
            </section>
          ) : null}

          {canChange ? (
            <section aria-labelledby="cant-h" className="card">
              <h2 id="cant-h" style={{ fontSize: '1.5rem', fontWeight: 600 }}>Plans changed?</h2>
              <p>That is fine, it happens. Moving or cancelling early lets a family on the waitlist have your time.</p>
              <div className="btn-row">
                <Link className="btn btn-outline" href={`${base}/change`}>Change time</Link>
                <Link href={`${base}/cancel`} style={{ fontWeight: 700, padding: '10px 4px' }}>Cancel my booking</Link>
              </div>
            </section>
          ) : b.status === 'cancelled' && (await getSeason())?.booking_open ? (
            <section className="card"><p>Would another day suit you?</p><Link className="btn" href="/#book">Book a visit</Link></section>
          ) : null}
        </aside>
      </div>

      {active && !b.started ? (
        <section aria-labelledby="day-h" className="card card-green" style={{ marginTop: 40, borderRadius: 32, padding: 40 }}>
          <h2 id="day-h" style={{ fontSize: '1.85rem', fontWeight: 600, marginBottom: 20 }}>On the day</h2>
          <div className="grid-cards" style={{ gap: 24 }}>
            <div><p style={{ fontWeight: 700, marginBottom: 4 }}>Arrive when you can</p><p style={{ margin: 0 }}>There is no queue behind you, so a few minutes late is fine.</p></div>
            <div><p style={{ fontWeight: 700, marginBottom: 4 }}>Take breaks</p><p style={{ margin: 0 }}>Step out at any point and come back when you are ready.</p></div>
            <div><p style={{ fontWeight: 700, marginBottom: 4 }}>Bring what helps</p><p style={{ margin: 0 }}>Ear defenders, a favourite toy or a snack are all welcome.</p></div>
          </div>
        </section>
      ) : null}
      <p className="small" style={{ marginTop: 24 }}>Keep this page&apos;s link private: anyone with it can see and change your booking.</p>
    </div>
  );
}
