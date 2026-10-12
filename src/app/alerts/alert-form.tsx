'use client';
import Link from 'next/link';
import { ActionForm, TextField, Tick } from '@/components/form';
import { signUpForAlert } from '../form-actions';

export function AlertForm() {
  return (
    <ActionForm action={signUpForAlert} submitLabel="Get an alert"
      success={(via) => (
        <>
          <h2>Thank you</h2>
          <p>We will send you {via === 'email' ? 'an email' : 'a text'} as soon as booking opens.</p>
          <p><Link href="/">Back to the homepage</Link></p>
        </>
      )}>
      <TextField name="name" label="Your name" autoComplete="name" />
      <TextField name="contact" label="Email address or UK mobile number" autoComplete="email" />
      <div className="field choice-single">
        <div className="choice">
          <input type="checkbox" id="is_group" name="is_group" />
          <label htmlFor="is_group">I am asking for a school, charity or group</label>
        </div>
      </div>
      <Tick name="data_consent" label="I agree to you holding these details to send me the alert"
        hint={<><Link href="/privacy">How we look after your details</Link></>} />
    </ActionForm>
  );
}
