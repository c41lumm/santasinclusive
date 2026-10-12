import type { Metadata } from 'next';
import Image from 'next/image';
import { site } from '@/lib/site';
import { QuoteMark } from '@/components/icons';
import { VolunteerForm } from './volunteer-form';

export const metadata: Metadata = { title: 'Volunteer' };

export default function Volunteer() {
  return (
    <>
      <section className="wrap hero" style={{ paddingBlock: '24px 48px', gap: 40 }}>
        <div className="text" style={{ flexBasis: 440 }}>
          <p className="eyebrow">Volunteer</p>
          <h1 className="green" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.25rem)' }}>Elf costume optional. Warm heart essential.</h1>
          <p className="lead" style={{ fontSize: '1.17rem', maxWidth: 720, margin: 0 }}>
            Every December we welcome children and adults with disabilities to meet Santa. We need warm, patient people to be
            Santa and his elves from 1 to 24 December.
          </p>
        </div>
        <div style={{ flex: '1 1 480px', minWidth: 0 }}>
          <Image src="/images/illustration-santa-and-elf.png" width={1400} height={1109} sizes="(max-width: 800px) 90vw, 560px" priority
            alt="Illustration of a smiling Santa and a cheerful elf waving, the elf holding a wrapped present." />
        </div>
      </section>

      <section className="wrap split" style={{ paddingBottom: 72 }}>
        <div className="card card-lg main">
          <VolunteerForm />
        </div>
        <aside className="side">
          <figure className="card" style={{ marginBottom: 24, padding: 28 }}>
            <QuoteMark />
            <blockquote style={{ margin: '12px 0' }}>Everything was perfect from the set up to Santa and the very entertaining elf.</blockquote>
            <figcaption style={{ fontWeight: 700, color: 'var(--green)' }}>A parent</figcaption>
          </figure>
          <div className="card card-green" style={{ padding: 36, marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: 20 }}>What happens next</h2>
            <ol style={{ margin: 0, paddingLeft: 24 }}>
              <li style={{ marginBottom: 12 }}>We read your application and arrange a short chat.</li>
              <li style={{ marginBottom: 12 }}>We complete your checks and references.</li>
              <li style={{ marginBottom: 12 }}>You come to a briefing, so you feel confident before you meet any families.</li>
              <li>You pick your shifts and receive your login for the volunteer app.</li>
            </ol>
          </div>
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 className="green">What you will need</h3>
            <ul style={{ margin: 0, paddingLeft: 22 }}>
              <li style={{ marginBottom: 8 }}>A patient, warm heart. The elf costume is optional, that part is essential.</li>
              <li style={{ marginBottom: 8 }}>A good sense of fun.</li>
              <li style={{ marginBottom: 8 }}>Time for at least one shift.{site.shiftTimes ? ` ${site.shiftTimes}` : ''}</li>
              <li>A smartphone, so you can see who is coming next and what will help them.</li>
            </ul>
          </div>
          {site.contactEmail ? (
            <div className="card card-sand">
              <h3 className="green">Questions?</h3>
              <p style={{ margin: 0 }}>Email us at <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> and we will gladly help.</p>
            </div>
          ) : null}
        </aside>
      </section>
    </>
  );
}
