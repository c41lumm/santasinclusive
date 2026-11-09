'use client';
import Link from 'next/link';
import { ActionForm, Choices, TextField, Tick } from '@/components/form';
import type { FormState } from '@/lib/forms';

export function ContactForm({ action, back, h }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>; back: string;
  h: { contact_name: string; email: string | null; phone: string | null; channels: string[] };
}) {
  return (
    <ActionForm action={action} submitLabel="Save"
      secondary={<Link href={back} style={{ fontWeight: 700 }}>Cancel</Link>}
      success={(t) => (
        <div className="success">
          <p style={{ fontWeight: 700, marginTop: 0 }}>{t}</p>
          <p style={{ margin: 0 }}><Link href={back}>Back to the booking</Link></p>
        </div>
      )}>
      <TextField name="contact_name" label="Contact name" defaultValue={h.contact_name} autoComplete="off" autoCapitalize="words" />
      <TextField name="email" type="email" label="Email address" optional defaultValue={h.email ?? ''} autoComplete="off"
        autoCapitalize="none" spellCheck={false} inputMode="email" />
      <TextField name="phone" type="tel" label="Mobile number" optional defaultValue={h.phone ?? ''} autoComplete="off" inputMode="tel" width="medium" />
      <Choices type="checkbox" name="channels" legend="Send their booking and reminders by" layout="inline"
        choices={[{ value: 'email', label: 'Email' }, { value: 'sms', label: 'Text message' }]} defaultValue={h.channels} />
      <Tick name="send_confirmation" optional label="Send their booking confirmation again, to these details"
        hint="Useful when an email address was missing or mistyped, so they get the links to their booking." />
    </ActionForm>
  );
}
