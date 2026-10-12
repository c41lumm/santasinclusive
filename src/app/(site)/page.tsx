import Image from 'next/image';
import Link from 'next/link';
import { getDays, getHours, getSeason, getSlots } from '@/lib/public-data';
import { dayName, hoursText, seasonDates } from '@/lib/dates';
import { site } from '@/lib/site';
import { DayPicker, TimeList } from '@/components/pickers';
import { Calendar, Clock, Family, Gift, Heart, Pin, QuoteMark, Sparkle } from '@/components/icons';
import { AlertForm } from './alerts/alert-form';

export const dynamic = 'force-dynamic';

const stories = [
  { quote: 'My son had the best experience last time. He even said his first word while we were there, it was so magical.', who: 'A parent' },
  { quote: 'Thank you so much for Henry’s visit yesterday, he was absolutely over the moon. He is so proud that he is at the top of the nice list and I think he wants Jingle Bells to be his new best friend.', who: 'A parent' },
  { quote: 'We have purposely avoided all grottos in fear of how E would react, so to know it’s a safe space for him will be amazing!', who: 'A parent, before their first visit' },
  { quote: 'She was amazing, had our kids in stitches and relaxed. Worth her weight in gold, a real gem.', who: 'A parent, about one of our elves' },
  { quote: 'Your Santas are amazing. I truly hope more people are inspired by this grotto and thoughtful Santas become standard.', who: 'A parent' },
  { quote: 'If I could I’d definitely book in to come again. I loved it.', who: 'An adult visitor' },
];
const shortQuotes = [
  'My SEN kiddos loved it.', 'Franklin loved every minute.', 'My gorgeous boy in awe of Santa.', 'Lovely memories made.',
  'Thank you for creating this safe space for anyone who would benefit.', 'This is absolutely the best thing to happen to Leicester.',
];
const faqs = [
  { q: 'Who can book?', a: "Santa's Inclusive Grotto is only for families with a child or adult who has a disability. Brothers, sisters, parents and carers are very welcome to come in too." },
  { q: 'Is it really free?', a: 'Yes. Our family funds the grotto and buys every gift. Booking is only so we can prepare for each visitor.' },
  { q: 'What if the day does not go to plan?', a: 'Message us or use the link in your reminder and we will move your booking, with no fuss. Cancelling early lets a family on the waitlist take the slot.' },
  { q: 'Who sees what I tell you about my child?', a: 'Only the Santa, elves and organisers who need it on the day. Health details are seen only by our organisers. We delete it all after the season ends.' },
  { q: 'Can we take a break during the visit?', a: 'Of course. There is no rush and no queue behind you. Step out whenever you need to and come back when you are ready.' },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const season = await getSeason();
  const open = !!season?.booking_open;
  const [hours, days] = season ? await Promise.all([getHours(season.year), open ? getDays(season.year) : []]) : [null, []];
  const { day } = await searchParams;
  const chosen = days.find((d) => d.day === day);
  const slots = chosen ? await getSlots(chosen.day) : [];
  const dates = season ? seasonDates(season.first_day, season.last_day).replace(/ \d{4}$/, '') : '';
  const times = hours ? hoursText(hours.opens_at, hours.closes_at) : '';

  return (
    <>
      <section id="top" className="wrap hero" style={{ paddingBlock: '40px 72px' }}>
        <div className="text">
          <p className="badge-pill">{dates ? <><span>{dates}</span> <span aria-hidden="true">·</span> </> : null}<span>Leicester city centre</span> <span aria-hidden="true">·</span> <span>Free</span></p>
          <h1>Meet Santa your way, <span className="red">at your pace.</span></h1>
          <p className="lead" style={{ fontSize: '1.17rem', maxWidth: 580, marginBottom: 30 }}>
            A calm Christmas grotto made only for children and adults with disabilities, and the families who love them.
            Every visit is shaped around the person at its heart, and every child leaves with a gift.
          </p>
          <div className="btn-row">
            {open ? <Link className="btn" href="/#book">Book your visit</Link> : <Link className="btn" href="/#alerts">Get an alert when booking opens</Link>}
            <Link className="btn btn-outline" href="/#expect">See what to expect</Link>
          </div>
          <div className="featured">
            <span style={{ fontWeight: 700, color: 'var(--muted)' }}>As featured on</span>
            <Image src="/images/bbc-news.jpg" alt="BBC News" width={52} height={52} style={{ borderRadius: 12 }} />
            <Image src="/images/sky-news.jpg" alt="Sky News" width={52} height={52} style={{ borderRadius: '50%' }} />
          </div>
        </div>
        <div className="card stack" style={{ flex: '1 1 380px', borderRadius: 32, padding: 34, gap: 22 }}>
          {site.showOpeningTimes ? (
            <div className="fact"><span className="icon-circle"><Calendar /></span><div>
              <p className="title">{hours?.every_day ? 'Every day, ' : ''}{dates || 'December'}</p>
              {times ? <p className="sub">{times}</p> : null}
            </div></div>
          ) : null}
          <div className="fact"><span className="icon-circle"><Pin /></span><div>
            <p className="title">{site.shortAddress}</p><p className="sub">Leicester LE1 4FY, city centre</p>
          </div></div>
          <div className="fact"><span className="icon-circle"><Gift /></span><div>
            <p className="title">Free, and a gift for every child</p><p className="sub">Funded by our family, booking only</p>
          </div></div>
          <div className="fact"><span className="icon-circle"><Family /></span><div>
            <p className="title">The whole family is welcome</p><p className="sub">Siblings, parents and carers come in too</p>
          </div></div>
        </div>
      </section>

      <section aria-label="Who the grotto is for" className="who-band">
        <div className="wrap">
          <Heart color="#FFFFFF" />
          <p>Only for families with a child or adult who has a disability, so every visit stays calm and unhurried.</p>
        </div>
      </section>

      <section id="expect" className="wrap" style={{ paddingBlock: '88px 64px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px 32px', marginBottom: 36 }}>
          <div style={{ flex: '1 1 520px', minWidth: 0 }}>
            <h2>What to expect</h2>
            <p className="lead" style={{ maxWidth: 680, margin: 0 }}>
              You tell us about your visitor when you book. Santa and the elves read it before you arrive, so nothing is a
              surprise for them, or for you.
            </p>
          </div>
          <Image src="/images/illustration-expect.png" alt="" width={143} height={230} className="hero-art" style={{ maxHeight: 230 }} />
        </div>
        <div className="grid-cards">
          {[
            { icon: <Sparkle />, title: 'Made for each visitor', text: 'Santa knows their name, what they love, and how they like to communicate before they walk in.' },
            { icon: <Clock />, title: 'No queues, no rush', text: 'Soft lighting, quiet music and time to settle. Step out for a break whenever you need one.' },
            { icon: <Gift />, title: 'A gift for every child', text: "Chosen by the elves around each child's interests, whether or not they say a word to Santa." },
            { icon: <Heart />, title: 'Meet Santa your way', text: 'On his lap, beside him, or with a wave from across the room. Whatever feels right on the day.' },
          ].map((c) => (
            <div className="card" key={c.title}>
              <div className="icon-dotted">{c.icon}</div>
              <h3>{c.title}</h3>
              <p className="muted">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap hero" style={{ paddingBlock: '24px 88px', gap: 56 }}>
        <figure style={{ flex: '1 1 380px', maxWidth: 480 }}>
          <div className="photo-ring"><div>
            <Image src="/images/opening-day-2022.png" width={480} height={480} sizes="(max-width: 600px) 90vw, 480px"
              alt="Opening day of the first grotto: a child in a green beanie cuts a red ribbon with help from a parent while the other parent smiles beside them." />
          </div></div>
          <figcaption className="small" style={{ marginTop: 14, textAlign: 'center' }}>Opening day of the very first grotto, 2022.</figcaption>
        </figure>
        <div style={{ flex: '1 1 460px', minWidth: 0 }}>
          <p className="eyebrow">Our story</p>
          <h2>It began with our son, Hudson.</h2>
          <p className="lead">In 2022 we opened the first grotto so that children with disabilities could meet Santa without crowds, noise or a ticking clock.</p>
          <p className="lead" style={{ margin: 0 }}>
            It has grown into one of the largest inclusive Christmas experiences in the world. It is still funded by our family
            every year, we buy every gift ourselves, and a team who care deeply about getting it right helps us make each
            visit special.
          </p>
        </div>
      </section>

      <section id="stories" aria-labelledby="stories-h" className="wrap" style={{ paddingBlock: '24px 88px' }}>
        <p className="eyebrow">From families who have visited</p>
        <h2 id="stories-h" style={{ marginBottom: 32 }}>What families say</h2>
        <figure className="big-quote">
          <blockquote>“You really are a miracle team, bringing not only joy to the children but also making it special for the parents by giving them a space where they’re not judged or rushed.”</blockquote>
          <figcaption style={{ fontWeight: 700 }}>A parent</figcaption>
        </figure>
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: 28 }}>
          {stories.map((s) => (
            <figure className="quote-card" key={s.quote}>
              <QuoteMark />
              <blockquote>{s.quote}</blockquote>
              <figcaption>{s.who}</figcaption>
            </figure>
          ))}
        </div>
        <ul className="chips" aria-label="More from families">
          {shortQuotes.map((q) => <li key={q}>“{q}”</li>)}
        </ul>
      </section>

      <section aria-label="Kind words from local organisations" className="band-white" style={{ borderBottom: 0 }}>
        <div className="wrap" style={{ paddingBlock: 44 }}>
          <p className="eyebrow" style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 24 }}>Kind words from local organisations</p>
          <div className="orgs">
            {[
              { img: '/images/lily-foundation.jpg', name: 'The Lily Foundation', quote: 'Fabulous. You are doing a wonderful thing.' },
              { img: '/images/visit-leicester.jpg', name: 'Visit Leicester', quote: 'Fantastic to see you guys back for this year!' },
              { img: '/images/discover-leicester.jpg', name: 'Discover Leicester', quote: 'Lovely and magical.' },
            ].map((o) => (
              <div key={o.name}>
                <Image src={o.img} alt={`${o.name} logo`} width={96} height={96} />
                <p style={{ marginBottom: 6 }}>“{o.quote}”</p>
                <p className="org">{o.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!open ? (
        <section id="alerts" aria-labelledby="alerts-h" className="wrap" style={{ paddingBlock: '0 72px' }}>
          <div className="card card-dotted" style={{ borderRadius: 32, padding: 40, display: 'flex', flexWrap: 'wrap', gap: '28px 40px', alignItems: 'center' }}>
            <Image src="/images/illustration-alerts.png" alt="" width={112} height={200} className="hero-art" style={{ maxHeight: 200 }} />
            <div style={{ flex: '1 1 520px', minWidth: 0 }}>
              <h2 id="alerts-h" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)' }}>Be first to know when booking opens</h2>
              <p className="lead" style={{ marginBottom: 22 }}>
                Times for this year are not out yet. Leave your details and we will email you as soon as the schedule is
                released, before we announce it anywhere else.
              </p>
              <AlertForm />
            </div>
          </div>
        </section>
      ) : null}

      {open ? (
        <section id="book" className="band-white">
          <div className="wrap section" style={{ display: 'flex', flexWrap: 'wrap', gap: 56 }}>
            <div style={{ flex: '1 1 360px', minWidth: 0 }}>
              <h2>Book your visit</h2>
              <p className="lead" style={{ marginBottom: 32 }}>It takes about five minutes, and it is free.</p>
              <ol className="stack" style={{ listStyle: 'none', padding: 0 }}>
                {[
                  ['Choose a day', `Pick any day${dates ? ` from ${dates}` : ''}.`],
                  ['Pick a time', 'See the slots left on that day.'],
                  ['Tell us about your visitor', 'What they love, what to avoid, and how they communicate.'],
                  ['Get reminders your way', 'By email or text, with directions and a one-tap link to change plans.'],
                ].map(([t, s], i) => (
                  <li className="fact" key={t}><span className="step-num" aria-hidden="true">{i + 1}</span>
                    <div><p className="title">{t}</p><p className="sub">{s}</p></div></li>
                ))}
              </ol>
              <Image src="/images/illustration-booking.png" alt="" width={186} height={230} style={{ marginTop: 36, height: 230, width: 'auto' }} />
            </div>
            <div className="card" style={{ flex: '1 1 520px', background: 'var(--cream)', borderRadius: 32 }}>
              {open ? (
                <>
                  <h3 style={{ fontSize: '1.6rem' }}>December {season!.year}</h3>
                  <p className="muted" style={{ marginBottom: 20 }}>Choose a day to see the times.</p>
                  <DayPicker days={days} selected={chosen?.day} href={(d) => `/?day=${d}#book`} label="Choose a day in December" />
                  {chosen ? (
                    <div style={{ marginTop: 26 }} id="times">
                      <h3>Choose a time on {dayName(chosen.day)}</h3>
                      {chosen.spaces_left ? (
                        <>
                          <p className="muted" style={{ marginBottom: 16 }}>Each visit is 15 minutes. Times marked “Break” are not available.</p>
                          <TimeList slots={slots} href={(s) => `/book/details?slot=${s.slot_id}&day=${chosen.day}`} />
                        </>
                    ) : null}
                  </div>
                ) : null}
                <div className="picker-summary" aria-live="polite">
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                      {!chosen ? 'No day chosen yet' : chosen.spaces_left ? `${dayName(chosen.day)}, now choose a time` : `${dayName(chosen.day)} is fully booked`}
                    </p>
                    <p className="muted" style={{ fontSize: '0.9rem' }}>Day full? You can join the waitlist and hear first if a slot opens.</p>
                  </div>
                  {chosen && !chosen.spaces_left ? <Link className="btn" href={`/waitlist?day=${chosen.day}`}>Join the waitlist</Link> : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      <section id="visit" className="wrap section hero">
        <div style={{ flex: '1 1 400px', minWidth: 0 }}>
          <Image src="/images/illustration-finding-us.png" alt="" width={126} height={200} className="float-art" style={{ maxHeight: 200 }} />
          <h2>Finding us</h2>
          <p style={{ fontWeight: 700, fontSize: '1.17rem', margin: '0 0 4px' }}>{site.address}</p>
          <p className="muted" style={{ marginBottom: 24 }}>In Leicester city centre.{times && site.showOpeningTimes ? ` Open ${times}.` : ''}</p>
          {site.access.length ? <ul style={{ marginBottom: 28 }}>{site.access.map((a) => <li key={a}>{a}</li>)}</ul> : null}
          <a className="btn" href={site.directions}>Get directions<span className="visually-hidden"> (opens Google Maps)</span></a>
        </div>
        <div className="map" style={{ flex: '1 1 440px', minWidth: 0 }}>
          {/* OpenStreetMap: free, no key and no tracking cookies, so no cookie banner is needed */}
          <iframe title={`Map showing ${site.address}`} src={site.map.embed} loading="lazy" referrerPolicy="no-referrer"
            style={{ display: 'block', width: '100%', height: 420, border: 0 }} />
          <p className="small" style={{ margin: 0, padding: '10px 16px', background: '#fff' }}>
            <a href={site.map.link}>View a larger map</a> · <a href={site.directions}>Get directions</a>
          </p>
        </div>
      </section>

      <section id="help" className="wrap" style={{ paddingBlock: '0 88px' }}>
        <h2 style={{ marginBottom: 28 }}>Get involved</h2>
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <div className="card card-green" style={{ borderRadius: 32, padding: 40 }}>
            <Image src="/images/illustration-gifts.png" alt="" width={92} height={170} className="float-art" style={{ maxHeight: 170 }} />
            <h3 style={{ fontSize: '1.85rem' }}>Sponsor gifts</h3>
            <p style={{ fontSize: '1.05rem', marginBottom: 24 }}>Companies can help by sponsoring toys for the children who visit. 100% of sponsorship is spent on toys for the children.</p>
            <Link className="btn btn-white" href="/support">Support the grotto</Link>
          </div>
          <div className="card" style={{ borderRadius: 32, padding: 40 }}>
            <Image src="/images/illustration-elf.png" alt="" width={97} height={170} className="float-art" style={{ maxHeight: 170 }} />
            <h3 style={{ fontSize: '1.85rem' }}>Be a Santa or an elf</h3>
            <p className="lead" style={{ fontSize: '1.05rem', marginBottom: 24 }}>We are looking for warm, patient people to help{dates ? ` from ${dates}` : ''}.</p>
            <Link className="btn btn-outline" href="/volunteer">Volunteer with us</Link>
          </div>
        </div>
      </section>

      <section id="faq" className="band-white" style={{ borderBottom: 0 }}>
        <div className="section" style={{ maxWidth: 880, margin: '0 auto', paddingInline: 'clamp(16px, 4vw, 40px)' }}>
          <h2>Questions families ask</h2>
          {faqs.map((f) => (
            <details className="faq" key={f.q}>
              <summary><span>{f.q}</span><span className="sign" aria-hidden="true" /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
