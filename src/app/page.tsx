import Link from 'next/link';
import { getSeason } from '@/lib/public-data';
import { seasonDates } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const season = await getSeason();
  const open = season?.booking_open;
  return (
    <>
      <section className="hero">
        <div>
          <h1>A calm visit to Santa, made around your family</h1>
          <p className="lead">
            Santa&apos;s Inclusive Grotto in Leicester is for children and adults with disabilities, and their families.
            Every family has its own booked time, so there is no queue, and you can tell Santa beforehand what will
            make the visit right for you.
          </p>
          {season ? <p><strong>Open {seasonDates(season.first_day, season.last_day)}</strong></p> : null}
          <div className="actions">
            {open ? (
              <>
                <Link className="button" href="/book">Book a visit</Link>
                <Link className="button secondary" href="/waitlist">Join the waitlist</Link>
              </>
            ) : (
              <>
                <Link className="button" href="/alerts">Get an alert when booking opens</Link>
                <Link className="button secondary" href="/groups">Schools and groups</Link>
              </>
            )}
          </div>
        </div>
        <Tree />
      </section>

      <h2>How a visit works</h2>
      <ol className="cards">
        <li>
          <h3>1. Choose a time</h3>
          <p>Pick a day and time that suits you. Each visit has time set aside before the next, so nobody is rushed.</p>
        </li>
        <li>
          <h3>2. Tell Santa about you</h3>
          <p>
            Let us know how your visitor communicates, what they love, what they find hard, and how they would like to
            meet Santa. It takes about five minutes.
          </p>
        </li>
        <li>
          <h3>3. Meet Santa</h3>
          <p>
            Santa will know how to say hello. Brothers and sisters are welcome too. We only take photos if you say yes.
          </p>
        </li>
      </ol>

      <div className="content">
        <h2>Who can book</h2>
        <p>
          Any family or group that includes a child or an adult with a disability, including hidden disabilities,
          autism, learning disabilities and sensory needs. You do not need a diagnosis or any proof.
        </p>
        <p>
          We offer one visit per family so that everyone gets a turn. Brothers, sisters, parents and carers can all come
          to the same visit.
        </p>

        <h2>Finding us</h2>
        <p>
          20 Freeschool Lane, Leicester LE1 4FY.{' '}
          <a href="https://www.google.com/maps/dir/?api=1&destination=20+Freeschool+Ln+Leicester+LE1+4FY">
            Get directions<span className="visually-hidden"> (opens Google Maps)</span>
          </a>
        </p>
        <p>
          If there is anything we should know to help you get here or get in, tell us when you book and we will
          plan for it.
        </p>

        <h2>Other ways to visit or help</h2>
        <ul>
          <li><Link href="/groups">Bring a school or group</Link></li>
          <li><Link href="/volunteer">Volunteer as an elf or as Santa</Link></li>
          <li><Link href="/support">Sponsor gifts as a business</Link></li>
        </ul>
      </div>
    </>
  );
}

function Tree() {
  return (
    <svg className="hero-art" viewBox="0 0 200 220" role="img" aria-label="A decorated Christmas tree with a star">
      <path d="M100 18l8 16 18 2-13 12 3 18-16-9-16 9 3-18-13-12 18-2z" fill="var(--gold)" />
      <path d="M100 52 L150 122 H124 L166 178 H34 L76 122 H50 Z" fill="currentColor" />
      <rect x="88" y="178" width="24" height="26" rx="3" fill="var(--accent)" />
      <circle cx="84" cy="112" r="6" fill="var(--gold)" />
      <circle cx="118" cy="138" r="6" fill="var(--accent)" />
      <circle cx="76" cy="160" r="6" fill="var(--gold)" />
      <circle cx="128" cy="166" r="6" fill="var(--gold)" />
      <circle cx="104" cy="92" r="5" fill="var(--accent)" />
    </svg>
  );
}
