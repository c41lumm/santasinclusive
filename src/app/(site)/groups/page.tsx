import type { Metadata } from 'next';
import Image from 'next/image';
import { site } from '@/lib/site';
import { GroupForm } from './group-form';

export const metadata: Metadata = { title: 'School and group visits' };

export default function Groups() {
  const goodToKnow = [
    site.maxGroupSize ? `Groups of up to ${site.maxGroupSize} per session.` : '',
    ...site.groupVenueNotes,
    'Every child in the group receives a gift.',
  ].filter(Boolean);
  return (
    <>
      <section className="wrap hero" style={{ paddingBlock: '24px 56px' }}>
        <div className="text" style={{ flexBasis: 560 }}>
          <p className="eyebrow">For schools and groups</p>
          <h1>School and group visits</h1>
          <p className="lead" style={{ fontSize: '1.17rem', maxWidth: 640, margin: 0 }}>
            Bring your class or group to meet Santa in a calm, unhurried grotto made for children and young people with
            disabilities. We plan every group visit with you, so it works for everyone in your group.
          </p>
        </div>
        <Image src="/images/illustration-expect.png" alt="" width={168} height={270} className="hero-art" priority />
      </section>

      <section className="wrap" style={{ paddingBottom: 56 }}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', marginBottom: 24 }}>How group visits work</h2>
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {[
            ['Dedicated group sessions', `Your group has the grotto to itself, at times set aside for schools and groups.${site.groupSessions ? ` ${site.groupSessions}` : ''}`],
            ['Planned with your staff', 'Tell us about your group’s needs and we will agree the visit with you, from arrival to goodbye.'],
            ['A note for every child', 'We send you a short form for each child or young person, so Santa and the elves know who they are meeting.'],
            ['Staff and carers welcome', 'Bring the staff, carers and helpers your group needs. Tell us how many when you enquire.'],
          ].map(([t, s]) => (
            <div className="card" key={t} style={{ borderRadius: 24, padding: 26 }}>
              <h3 style={{ fontSize: '1.35rem' }}>{t}</h3>
              <p className="muted" style={{ margin: 0 }}>{s}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap split" style={{ paddingBottom: 88 }}>
        <div className="card card-lg main" style={{ flexBasis: 600 }}>
          <h2 className="green" style={{ fontSize: '2rem' }}>Make a group enquiry</h2>
          <p style={{ marginBottom: 28 }}>We will reply to confirm a date and time, and send the forms for your group.</p>
          <GroupForm />
        </div>
        <aside className="side">
          <div className="card card-green" style={{ padding: 34, marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: 16 }}>Good to know</h2>
            <ul style={{ margin: 0, paddingLeft: 22 }}>{goodToKnow.map((g) => <li key={g} style={{ marginBottom: 10 }}>{g}</li>)}</ul>
          </div>
          {site.contactEmail ? (
            <div className="card" style={{ padding: 30 }}>
              <h3 className="green">Questions about a group visit?</h3>
              <p style={{ margin: 0 }}>Email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> and we will gladly help you plan.</p>
            </div>
          ) : null}
        </aside>
      </section>
    </>
  );
}
