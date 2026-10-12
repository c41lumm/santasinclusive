'use client';
import Link from 'next/link';
import { ActionForm, Choices, TextArea, TextField, Tick } from '@/components/form';
import { groupTimes, groupWeeks } from '@/lib/options';
import { sendGroupEnquiry } from '../form-actions';

export function GroupForm() {
  return (
    <ActionForm action={sendGroupEnquiry} submitLabel="Send group enquiry" block
      success={() => (
        <div className="success" style={{ margin: 0 }}>
          <h2>Thank you, we have your enquiry</h2>
          <p>We will reply to confirm a date and time, and send the forms for your group.</p>
          <Link href="/">Back to the homepage</Link>
        </div>
      )}>
      <TextField name="organisation" label="School or organisation name" autoComplete="organization" />
      <div className="grid-2">
        <TextField name="contact_name" label="Your name" autoComplete="name" />
        <TextField name="role" label="Your role" optional />
      </div>
      <div className="grid-2">
        <TextField name="email" type="email" label="Email address" autoComplete="email" />
        <TextField name="phone" type="tel" label="Phone number" autoComplete="tel" />
      </div>
      <div className="grid-2">
        <TextField name="people" label="Number of children or young people visiting" inputMode="numeric" />
        <TextField name="staff" label="Number of staff and carers" inputMode="numeric" />
      </div>
      <TextField name="age_range" label="Age range" hint="For example 5 to 11, or 16 to 19." width="medium" />
      <Choices type="checkbox" name="weeks" legend="Which weeks could you visit?" layout="grid" mark={false}
        choices={groupWeeks.map((w) => ({ value: w, label: w }))} />
      <Choices type="checkbox" name="time_pref" legend="Preferred time of day" layout="grid" mark={false} choices={groupTimes} />
      <TextArea name="needs" label="Anything we should know about your group" optional rows={3}
        hint="For example wheelchair users, sensory needs, or a group that needs a very quiet visit. You will be able to add details for each child later." />
      <Tick name="data_consent" label="I agree to Santa's Inclusive Grotto holding these details to arrange our visit." />
    </ActionForm>
  );
}
