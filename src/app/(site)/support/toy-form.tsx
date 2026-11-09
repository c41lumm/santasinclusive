'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm, Choices, TextArea, TextField } from '@/components/form';
import { offerToys } from '../form-actions';

export function ToyForm() {
  const [giver, setGiver] = useState('person');
  const company = giver === 'company';
  return (
    <ActionForm action={offerToys} submitLabel="Offer toys" block
      success={(delivery) => (
        <div className="success" style={{ margin: 0 }}>
          <h2>Thank you for offering toys</h2>
          <p>We have emailed you a thank you. One of our elves will be in touch in the next few days to arrange
            {delivery === 'collect' ? ' collecting them' : delivery === 'post' ? ' where to send them' : ' a time to drop them off'}.</p>
          <Link href="/">Back to the homepage</Link>
        </div>
      )}>
      <h2 className="green" style={{ fontSize: '1.85rem' }}>Donate toys</h2>
      <p style={{ marginBottom: 24 }}>Rather give toys than funds? Tell us what you would like to give, and we will arrange getting them to the elves.</p>
      <Choices type="radio" name="giver" legend="Who is giving the toys?" mark={false} values={[giver]} onChange={(v) => setGiver(v[0] ?? 'person')}
        choices={[{ value: 'person', label: 'Me, or my family' }, { value: 'company', label: 'A company or organisation' }]} layout="inline" />
      {company ? <TextField name="company" label="Company or organisation name" autoComplete="organization" /> : null}
      <TextField name="contact_name" label="Your name" autoComplete="name" />
      <TextField name="email" type="email" label="Email address" autoComplete="email" inputMode="email" />
      <TextField name="phone" type="tel" label="Mobile number" optional autoComplete="tel" inputMode="tel" width="medium"
        hint="In case it is easier to arrange by phone." />
      <TextArea name="toys" label="Which toys would you like to give?" rows={4} maxLength={1500}
        hint="For example: 10 light-up toys, some sensory toys and a few festive cuddly toys. Not sure? Say so and we will suggest what helps most." />
      <TextField name="how_many" type="number" label="Roughly how many toys?" optional inputMode="numeric" min={1} max={5000} width="short" />
      <Choices type="radio" name="delivery" legend="How will the toys reach us?" mark={false} defaultValue="drop_off" choices={[
        { value: 'drop_off', label: 'I will drop them off', hint: 'We will arrange a time at the grotto in Leicester city centre.' },
        { value: 'collect', label: 'Please collect them', hint: 'In and around Leicester.' },
        { value: 'post', label: 'I will post them or have them delivered', hint: 'For example, ordered online. We will send you the address.' },
      ]} />
      {company ? (
        <div className="agree" style={{ margin: '8px 0 16px' }}><input type="checkbox" id="show_on_wall" name="show_on_wall" defaultChecked />
          <label htmlFor="show_on_wall">Show our company name on the thank you page of this website</label></div>
      ) : null}
    </ActionForm>
  );
}
