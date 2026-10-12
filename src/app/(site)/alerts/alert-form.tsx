'use client';
import { ActionForm, TextField } from '@/components/form';
import { signUpForAlert } from '../form-actions';

/** "Be first to know when booking opens", as on the homepage design */
export function AlertForm() {
  return (
    <ActionForm action={signUpForAlert} submitLabel="Send me an alert"
      secondary={<span className="small">We only use this to tell you when booking opens.</span>}
      success={(via) => (
        <div className="success">
          <h2>Thank you, you are on the list</h2>
          <p>We will send you {via} as soon as booking opens, before we announce it anywhere else.</p>
        </div>
      )}>
      <div className="grid-2">
        <TextField name="name" label="Your name" autoComplete="name" />
        <TextField name="contact" type="email" label="Email address" autoComplete="email" />
      </div>
      <div className="choice" style={{ marginBottom: 18 }}>
        <input type="checkbox" id="is_group" name="is_group" style={{ width: 22, height: 22, accentColor: 'var(--green)' }} />
        <label htmlFor="is_group">I am booking for a school or group</label>
      </div>
    </ActionForm>
  );
}
