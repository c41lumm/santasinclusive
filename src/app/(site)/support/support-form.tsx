'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm, Choices, TextField } from '@/components/form';
import { Gift } from '@/components/icons';
import { offerSponsorship } from '../form-actions';

const picks = [5, 10, 25, 50, 100];

export function SupportForm({ price }: { price: number }) {
  const [count, setCount] = useState(25);
  const children = count === 1 ? 'child will' : 'children will';
  return (
    <ActionForm action={offerSponsorship} submitLabel={`Sponsor ${count} ${count === 1 ? 'gift' : 'gifts'}`} block
      success={(pay) => (
        <div className="success" style={{ margin: 0 }}>
          <h2>Thank you for sponsoring {count} gifts</h2>
          <p>We will email you {pay === 'card' ? 'a secure link to pay by card' : 'an invoice'} within a few days, then a receipt and an update after Christmas.</p>
          <Link href="/">Back to the homepage</Link>
        </div>
      )}>
      <input type="hidden" name="gifts" value={count} />
      <h2 className="green" style={{ fontSize: '1.85rem' }}>Choose how many gifts to sponsor</h2>
      <p style={{ marginBottom: 24 }}>Each gift is chosen by the elves around a child&apos;s interests.</p>
      <div className="gift-picks" role="group" aria-label="Quick choices" id="gifts" tabIndex={-1}>
        {picks.map((n) => (
          <button type="button" key={n} className="gift-pick" aria-pressed={n === count} onClick={() => setCount(n)}>{n} gifts</button>
        ))}
      </div>
      <div className="counter">
        <button type="button" aria-label="Sponsor one fewer gift" onClick={() => setCount((c) => Math.max(1, c - 1))}>−</button>
        <div className="count" aria-live="polite">
          <div className="num">{count}</div>
          <div style={{ fontSize: '0.95rem' }}>{children} receive a gift</div>
        </div>
        <button type="button" aria-label="Sponsor one more gift" onClick={() => setCount((c) => Math.min(5000, c + 1))}>+</button>
      </div>
      <div className="gift-icons" aria-hidden="true">
        {Array.from({ length: Math.min(count, 24) }, (_, i) => <Gift key={i} size={28} color="#DE000C" />)}
      </div>
      {count > 24 ? <p style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>+ {count - 24} more</p> : null}
      <div className="total">
        <div>
          <p style={{ fontSize: '0.85rem' }}>Your sponsorship</p>
          <p className="amount" aria-live="polite">£{(count * price).toLocaleString('en-GB')}</p>
        </div>
        <p style={{ fontSize: '0.85rem', maxWidth: 240 }}>£{price} per gift.</p>
      </div>

      <h3 style={{ fontSize: '1.3rem' }}>About your company</h3>
      <TextField name="company" label="Company or organisation name" autoComplete="organization" />
      <TextField name="contact_name" label="Your name" autoComplete="name" />
      <TextField name="email" type="email" label="Email address" autoComplete="email" />
      <div style={{ margin: '24px 0 8px' }}>
        <div className="agree"><input type="checkbox" id="show_on_wall" name="show_on_wall" defaultChecked />
          <label htmlFor="show_on_wall">Show our company name on the thank you page of this website</label></div>
        <div className="agree"><input type="checkbox" id="logo_requested" name="logo_requested" />
          <label htmlFor="logo_requested">We would like to send our logo to be included</label></div>
      </div>
      <Choices type="radio" name="pay_method" legend="How would you like to pay?" mark={false} defaultValue="card" choices={[
        { value: 'card', label: 'Pay by card', hint: 'We will email you a secure payment link.' },
        { value: 'invoice', label: 'Send me an invoice' },
      ]} />
    </ActionForm>
  );
}
