'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm, Choices, Select, TextField, Tick } from '@/components/form';
import { channelChoices } from '@/lib/options';
import { joinWaitlist } from '../form-actions';

export function WaitlistForm({ days, day }: { days: { value: string; label: string }[]; day?: string }) {
  const [channels, setChannels] = useState<string[]>(['sms']);
  return (
    <ActionForm action={joinWaitlist} submitLabel="Join the waitlist"
      success={(d) => (
        <>
          <h2>You are on the waitlist for {d}</h2>
          <p>If a visit opens up, we will message you straight away and hold it for you, so you have time to claim it.</p>
          <p><Link href="/">Back to the homepage</Link></p>
        </>
      )}>
      <Select name="day" label="Which day would you like?" options={days} defaultValue={day} placeholder="Choose a day"
        hint="If you could come on more than one day, join the waitlist for each." />
      <Choices type="radio" name="time_pref" legend="What time of day?" inline defaultValue="any" choices={[
        { value: 'any', label: 'Any time' }, { value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' },
      ]} />
      <TextField name="contact_name" label="Your name" autoComplete="name" />
      <Choices type="checkbox" name="channels" legend="How should we tell you when a visit opens up?"
        hint="Texts reach most people fastest." choices={channelChoices} values={channels} onChange={setChannels} />
      <TextField name="phone" type="tel" label="UK mobile number" autoComplete="tel" width="medium"
        optional={channels.every((c) => c === 'email')} />
      <TextField name="email" type="email" label="Email address" autoComplete="email" optional={!channels.includes('email')} />
      <Tick name="eligibility_confirmed" label="Our family or group includes a child or an adult with a disability" />
      <Tick name="data_consent" label="I agree to you holding these details to offer us a visit"
        hint={<>We delete them after the season. <Link href="/privacy">How we look after your details</Link></>} />
    </ActionForm>
  );
}
