import type { Metadata } from 'next';
import Image from 'next/image';
import { site } from '@/lib/site';
import Link from 'next/link';
import { SupportForm } from './support-form';
import { ToyForm } from './toy-form';

export const metadata: Metadata = { title: 'Support the grotto' };

export default async function Support({ searchParams }: { searchParams: Promise<{ give?: string }> }) {
  const toys = (await searchParams).give === 'toys';
  return (
    <>
      <section className="wrap hero" style={{ paddingBlock: '24px 48px', justifyContent: 'space-between' }}>
        <div className="text" style={{ flexBasis: 560 }}>
          <p className="eyebrow">For people and companies</p>
          <h1 className="green" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.25rem)', maxWidth: 820 }}>Help us give every child a gift.</h1>
          <p className="lead" style={{ fontSize: '1.17rem', maxWidth: 720, margin: 0 }}>
            Our family funds the grotto and buys every gift ourselves. This year you or your company can join us by sponsoring
            gifts or donating toys for the children and adults who visit Santa.
          </p>
        </div>
        <Image src="/images/illustration-gifts.png" alt="" width={141} height={260} className="hero-art" priority />
      </section>

      <section className="wrap split" style={{ paddingBottom: 72 }}>
        <div className="card card-lg main">
          <div className="give-switch" role="group" aria-label="How would you like to help?">
            <Link href="/support" aria-current={!toys ? 'true' : undefined} scroll={false}>Sponsor gifts</Link>
            <Link href="/support?give=toys" aria-current={toys ? 'true' : undefined} scroll={false}>Donate toys</Link>
          </div>
          {toys ? <ToyForm /> : <SupportForm price={site.giftPricePounds} />}
          {toys ? null : <p className="small" style={{ marginTop: 14 }}>
            Santa&apos;s Inclusive Grotto is not a registered charity, so sponsorship is not a charitable donation and Gift Aid
            does not apply. You will receive a receipt. Please ask your accountant how sponsorship is treated for your company.
            Sponsorship is received by {site.company}, which runs the grotto.
          </p>}
        </div>
        <aside className="side">
          {toys ? null : <div className="card card-outline-green" style={{ marginBottom: 24 }}>
            <h2 className="green" style={{ fontSize: '1.6rem' }}>Where your sponsorship goes</h2>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 12 }}>100% of sponsorship is spent on toys for the children.</p>
            <p style={{ margin: 0 }}>If any funds are left over after Christmas, they will be donated to <a href="https://menphys.org.uk/" style={{ fontWeight: 700 }}>Menphys</a>, a children&apos;s charity.</p>
          </div>}
          <div className="card card-green" style={{ padding: 36, marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: 24 }}>How it works</h2>
            <ol className="stack" style={{ listStyle: 'none', padding: 0, gap: 18, margin: 0 }}>
              {(toys
                ? ['Tell us which toys you would like to give.', 'An elf emails you to arrange dropping them off, collecting them or where to send them.',
                  'The elves wrap each toy and match it to a visitor who will love it.', 'You receive a thank you, and an update after Christmas.']
                : ['Choose how many gifts you would like to sponsor.', 'Tell us about your company and pay by card or invoice.',
                  "The elves choose each gift around the child's interests.", 'You receive a thank you and a receipt, and an update after Christmas.'])
                .map((t, i) => <li key={t} className="fact"><span className="step-num sm" aria-hidden="true">{i + 1}</span><p>{t}</p></li>)}
            </ol>
          </div>
          {toys ? (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 className="green">Toys we always need</h3>
              <ul style={{ paddingLeft: 20, margin: '0 0 12px', fontWeight: 700 }}>
                <li>Light-up toys</li>
                <li>Sensory toys</li>
                <li>Festive cuddly toys</li>
              </ul>
              <p style={{ margin: 0 }}>Please give new toys, in their packaging. There is no need to wrap them: the elves wrap every gift.</p>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 className="green">Prefer to give toys?</h3>
              <p>If you would rather buy toys than give funds, tell us what you would like to give and we will arrange the rest.</p>
              <Link href="/support?give=toys" style={{ fontWeight: 700 }}>Donate toys instead</Link>
            </div>
          )}
        </aside>
      </section>
    </>
  );
}
