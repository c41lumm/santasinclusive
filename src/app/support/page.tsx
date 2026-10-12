import type { Metadata } from 'next';
import Image from 'next/image';
import { site } from '@/lib/site';
import { QuoteMark } from '@/components/icons';
import { SupportForm } from './support-form';

export const metadata: Metadata = { title: 'Support the grotto' };

export default function Support() {
  return (
    <>
      <section className="wrap hero" style={{ paddingBlock: '24px 48px', justifyContent: 'space-between' }}>
        <div className="text" style={{ flexBasis: 560 }}>
          <p className="eyebrow">For companies and organisations</p>
          <h1 className="green" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.25rem)', maxWidth: 820 }}>Help us give every child a gift.</h1>
          <p className="lead" style={{ fontSize: '1.17rem', maxWidth: 720, margin: 0 }}>
            Our family funds the grotto and buys every gift ourselves. This year your company can join us by sponsoring gifts
            for the children who visit Santa.
          </p>
        </div>
        <Image src="/images/illustration-gifts.png" alt="" width={141} height={260} className="hero-art" priority />
      </section>

      <section className="wrap split" style={{ paddingBottom: 72 }}>
        <div className="card card-lg main">
          <SupportForm price={site.giftPricePounds} />
          <p className="small" style={{ marginTop: 14 }}>
            Santa&apos;s Inclusive Grotto is not a registered charity, so sponsorship is not a charitable donation and Gift Aid
            does not apply. You will receive a receipt. Please ask your accountant how sponsorship is treated for your company.
            Sponsorship is received by {site.company}, which runs the grotto.
          </p>
        </div>
        <aside className="side">
          <figure className="card" style={{ marginBottom: 24, padding: 28 }}>
            <QuoteMark />
            <blockquote style={{ margin: '12px 0' }}>You made Christmas very special for those who otherwise wouldn’t have gotten to see Santa.</blockquote>
            <figcaption style={{ fontWeight: 700, color: 'var(--green)' }}>A parent</figcaption>
          </figure>
          <div className="card card-outline-green" style={{ marginBottom: 24 }}>
            <h2 className="green" style={{ fontSize: '1.6rem' }}>Where your sponsorship goes</h2>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 12 }}>100% of sponsorship is spent on toys for the children.</p>
            <p style={{ margin: 0 }}>If any funds are left over after Christmas, they will be donated to <a href="https://menphys.org.uk/" style={{ fontWeight: 700 }}>Menphys</a>, a children&apos;s charity.</p>
          </div>
          <div className="card card-green" style={{ padding: 36, marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: 24 }}>How it works</h2>
            <ol className="stack" style={{ listStyle: 'none', padding: 0, gap: 18, margin: 0 }}>
              {['Choose how many gifts you would like to sponsor.', 'Tell us about your company and pay by card or invoice.',
                "The elves choose each gift around the child's interests.", 'You receive a thank you and a receipt, and an update after Christmas.']
                .map((t, i) => <li key={t} className="fact"><span className="step-num sm" aria-hidden="true">{i + 1}</span><p>{t}</p></li>)}
            </ol>
          </div>
          {site.contactEmail ? (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 className="green">Prefer to give toys?</h3>
              <p>If your team would rather buy toys than give funds, get in touch and we will tell you what is most helpful.</p>
              <a href={`mailto:${site.contactEmail}?subject=Giving%20toys`} style={{ fontWeight: 700 }}>Email us about giving toys</a>
            </div>
          ) : null}
        </aside>
      </section>
    </>
  );
}
