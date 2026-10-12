'use client';
import Link from 'next/link';
import { ActionForm, Choices, TextField, Tick } from '@/components/form';
import { offerSponsorship } from '../form-actions';

export function SupportForm() {
  return (
    <ActionForm action={offerSponsorship} submitLabel="Send"
      success={() => (
        <>
          <h2>Thank you</h2>
          <p>We will email you within a few days with a secure payment link or an invoice.</p>
          <p><Link href="/">Back to the homepage</Link></p>
        </>
      )}>
      <TextField name="company" label="Company or organisation" autoComplete="organization" />
      <TextField name="contact_name" label="Your name" autoComplete="name" />
      <TextField name="email" type="email" label="Email address" autoComplete="email" />
      <TextField name="gifts" label="How many gifts would you like to sponsor?" inputMode="numeric" width="short" />
      <TextField name="amount_pounds" label="How much would you like to give, in pounds?" inputMode="decimal" width="short" />
      <Choices type="radio" name="pay_method" legend="How would you like to pay?" choices={[
        { value: 'card', label: 'By card', hint: 'We will email you a secure payment link.' },
        { value: 'invoice', label: 'By invoice' },
      ]} />
      <div className="field choices">
        <div className="choice"><input type="checkbox" id="show_on_wall" name="show_on_wall" />
          <label htmlFor="show_on_wall">Show our name on the sponsors&apos; wall in the grotto</label></div>
        <div className="choice"><input type="checkbox" id="logo_requested" name="logo_requested" />
          <label htmlFor="logo_requested">We would like to send our logo</label></div>
      </div>
      <Tick name="data_consent" label="I agree to you holding these details to arrange our sponsorship"
        hint={<><Link href="/privacy">How we look after your details</Link></>} />
    </ActionForm>
  );
}
