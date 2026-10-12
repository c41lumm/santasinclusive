'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm, Choices, Select, TextField, Tick } from '@/components/form';
import { joinWaitlist } from '../form-actions';

const tellBy = [{ value: 'sms', label: 'Text' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'email', label: 'Email' }];

export function WaitlistForm({ days, day }: { days: { value: string; label: string }[]; day?: string }) {
  const [channels, setChannels] = useState<string[]>(['sms', 'whatsapp', 'email']);
  const [times, setTimes] = useState<string[]>(['any']);
  return (
    <ActionForm action={joinWaitlist} submitLabel="Join the waitlist" block
      success={(d) => (
        <section aria-labelledby="on-list" className="card card-lg">
          <p className="eyebrow">You&apos;re on the list</p>
          <h2 id="on-list" className="green" style={{ fontSize: '1.75rem' }}>You are on the waitlist for {d}</h2>
          <p>We have sent a confirmation, with a link to leave the list if your plans change.</p>
          <h3>What happens next</h3>
          <ol style={{ paddingLeft: 24 }}>
            <li>If a family cancels, we message the first person on the list.</li>
            <li>You have a short time to claim the slot with one tap.</li>
            <li>If you do not claim it, we offer it to the next family.</li>
          </ol>
          <div className="panel" style={{ margin: 0 }}>
            <p style={{ fontWeight: 700, margin: 0 }}>Want to look at other dates too?</p>
            <p style={{ margin: '4px 0 12px' }}>You can join the waitlist for more than one date.</p>
            <Link href="/#book" style={{ fontWeight: 700 }}>See other dates</Link>
          </div>
        </section>
      )}>
      <Select name="day" label="Which day would you like?" options={days} defaultValue={day} placeholder="Choose a day" mark={false} />
      <TextField name="contact_name" label="Your name" autoComplete="name" mark={false} />
      <TextField name="phone" type="tel" label="Mobile number" autoComplete="tel" mark={false} width="medium"
        optional={channels.every((c) => c === 'email')} />
      {channels.includes('email') ? <TextField name="email" type="email" label="Email address" autoComplete="email" mark={false} /> : null}
      <Choices type="checkbox" name="times" id="time_pref" legend="Which times could you make?" layout="inline" mark={false}
        choices={[{ value: 'any', label: 'Any time' }, { value: 'morning', label: 'Mornings' }, { value: 'afternoon', label: 'Afternoons' }]}
        values={times} onChange={setTimes} />
      <Choices type="checkbox" name="channels" legend="Tell me by" layout="inline" mark={false} choices={tellBy} values={channels} onChange={setChannels} />
      <Tick name="eligibility_confirmed" label="Our family or group includes a child or an adult with a disability." />
      <Tick name="data_consent" label="I agree to Santa's Inclusive Grotto holding these details to offer us a visit."
        hint={<>We delete them after the season. <Link href="/privacy">How we look after your details</Link></>} />
      <p className="small" style={{ margin: '8px 0 0' }}>Joining is free and you can leave the list at any time.</p>
    </ActionForm>
  );
}
