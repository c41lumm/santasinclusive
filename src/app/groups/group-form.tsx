'use client';
import Link from 'next/link';
import { ActionForm, Choices, TextArea, TextField, Tick } from '@/components/form';
import { groupWeeks } from '@/lib/options';
import { sendGroupEnquiry } from '../form-actions';

export function GroupForm() {
  return (
    <ActionForm action={sendGroupEnquiry} submitLabel="Send enquiry"
      success={() => (
        <>
          <h2>Thank you</h2>
          <p>We will be in touch within a few days to offer you a time.</p>
          <p><Link href="/">Back to the homepage</Link></p>
        </>
      )}>
      <TextField name="organisation" label="School, charity or group" autoComplete="organization" />
      <TextField name="contact_name" label="Your name" autoComplete="name" />
      <TextField name="role" label="Your role" optional width="medium" />
      <TextField name="email" type="email" label="Email address" autoComplete="email" />
      <TextField name="phone" type="tel" label="Phone number" autoComplete="tel" width="medium" />
      <TextField name="people" label="How many people will meet Santa?" inputMode="numeric" width="short" />
      <TextField name="staff" label="How many staff or carers will come with them?" inputMode="numeric" width="short" />
      <TextField name="age_range" label="Ages" hint="For example 5 to 11, or adults." width="medium" />
      <Choices type="checkbox" name="weeks" legend="Which weeks could you come?" optional
        choices={groupWeeks.map((w) => ({ value: w, label: w }))} />
      <Choices type="checkbox" name="time_pref" legend="What time of day suits you?" optional inline
        choices={[{ value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }]} />
      <TextArea name="needs" label="Anything we should plan for?" optional rows={4}
        hint="Access, communication, sensory needs, or how your group would like to meet Santa. Please do not include names or health details." />
      <Tick name="data_consent" label="I agree to you holding these details to arrange our visit"
        hint={<><Link href="/privacy">How we look after your details</Link></>} />
    </ActionForm>
  );
}
