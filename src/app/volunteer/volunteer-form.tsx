'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm, Choices, TextArea, TextField, Tick } from '@/components/form';
import { applyToVolunteer } from '../form-actions';

export function VolunteerForm({ days }: { days: { value: string; label: string }[] }) {
  const [role, setRole] = useState<string[]>([]);
  return (
    <ActionForm action={applyToVolunteer} submitLabel="Send application"
      success={() => (
        <>
          <h2>Thank you for offering to help</h2>
          <p>We will be in touch to arrange a chat, and the checks the role needs.</p>
          <p><Link href="/">Back to the homepage</Link></p>
        </>
      )}>
      <Choices type="radio" name="role" legend="What would you like to do?" values={role} onChange={setRole} choices={[
        { value: 'elf', label: 'Elf', hint: 'Welcoming families, helping on the day and looking after the gifts.' },
        { value: 'lead_elf', label: 'Lead elf', hint: 'Running a shift and supporting the other elves. Ideal if you have experience with disabled children or adults.' },
        { value: 'santa', label: 'Santa', hint: 'Meeting every visitor in the way that suits them.' },
      ]} />
      {role[0] === 'santa' ? (
        <Choices type="radio" name="own_suit" legend="Do you have your own Santa suit?" inline optional
          choices={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
      ) : null}
      <TextField name="name" label="Your name" autoComplete="name" />
      <TextField name="email" type="email" label="Email address" autoComplete="email" />
      <TextField name="phone" type="tel" label="UK mobile number" autoComplete="tel" width="medium" />
      <Choices type="checkbox" name="available_days" legend="Which days could you help?" choices={days} />
      <TextArea name="experience" label="Any experience with disabled children or adults?" optional rows={4}
        hint="Paid or unpaid, at work or in your family. None is fine too." />
      <TextArea name="why" label="Why would you like to help?" optional rows={4} />
      <Tick name="over_18" label="I am 18 or over" />
      <Tick name="data_consent" label="I agree to you holding these details to consider my application"
        hint={<><Link href="/privacy">How we look after your details</Link></>} />
    </ActionForm>
  );
}
