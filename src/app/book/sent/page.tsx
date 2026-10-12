import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Check your messages' };

const names: Record<string, string> = { email: 'email', sms: 'texts', whatsapp: 'WhatsApp' };

/** The same page whatever happened, so it never reveals whether someone had already booked */
export default async function Sent({ searchParams }: { searchParams: Promise<{ via?: string }> }) {
  const { via = '' } = await searchParams;
  const where = via.split(',').map((c) => names[c]).filter(Boolean);
  const list = where.length > 1 ? `${where.slice(0, -1).join(', ')} and ${where.at(-1)}` : where[0] ?? 'messages';
  return (
    <div className="wrap page" style={{ maxWidth: 1140 }}>
      <section className="hero" style={{ marginBottom: 40 }} role="status">
        <Image src="/images/illustration-santa-waving.png" alt="Santa smiling and waving" width={213} height={300} className="hero-art" style={{ maxHeight: 300 }} />
        <div className="text" style={{ flexBasis: 460 }}>
          <p className="status-pill">Nearly done</p>
          <h1>Check your {list}</h1>
          <p className="lead" style={{ fontSize: '1.2rem' }}>We have sent your booking, with your own link to see it, change it and tell Santa about your visitors.</p>
        </div>
      </section>
      <div className="split">
        <section className="card main" aria-labelledby="next-h">
          <h2 id="next-h" style={{ fontSize: '1.75rem', fontWeight: 600 }}>What happens next</h2>
          <ol className="stack" style={{ listStyle: 'none', padding: 0, gap: 18, margin: 0 }}>
            <li className="fact"><span className="step-num" aria-hidden="true">1</span><p>Open the link in our message and tell us about your visitor. It takes about five minutes, and Santa and the elves read it before you arrive.</p></li>
            <li className="fact"><span className="step-num" aria-hidden="true">2</span><p>We will remind you a week before, and ask you to confirm two days before, with directions.</p></li>
            <li className="fact"><span className="step-num" aria-hidden="true">3</span><p>If plans change, use the same link to move or cancel. Your time then goes to a family on the waitlist.</p></li>
          </ol>
        </section>
        <aside className="side stack">
          <section className="card card-sand">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Nothing arrived?</h2>
            <p>Give it 15 minutes and check your spam folder.{site.contactEmail ? <> If it is still not there, email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.</> : null}</p>
            <Link href="/">Back to the homepage</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
