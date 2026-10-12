'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm, Choices, TextField, Tick } from '@/components/form';
import { channelChoices, photoChoices } from '@/lib/options';
import { bookAction } from '../actions';

type Person = { key: number; kind: 'visitor' | 'sibling'; first_name: string; age: string };

export function BookingForm({ slotId }: { slotId: string }) {
  const [people, setPeople] = useState<Person[]>([{ key: 0, kind: 'visitor', first_name: '', age: '' }]);
  const [channels, setChannels] = useState<string[]>(['email']);
  const update = (key: number, change: Partial<Person>) => setPeople((ps) => ps.map((p) => (p.key === key ? { ...p, ...change } : p)));
  const visitors = people.map(({ kind, first_name, age }) => ({ kind, first_name, age: age === '' ? undefined : age }));

  return (
    <ActionForm action={bookAction} submitLabel="Book this visit">
      <input type="hidden" name="slot_id" value={slotId} />
      <input type="hidden" name="visitors" value={JSON.stringify(visitors)} />

      <section className="form-section" aria-labelledby="who">
        <h2 id="who">Everyone seeing Santa</h2>
        <p className="hint">
          Add everyone who will see Santa, including brothers and sisters. You can tell Santa more about each person after
          booking.
        </p>
        <div id="visitors" tabIndex={-1}>
          {people.map((p, i) => (
            <div className="person" key={p.key}>
              <div className="person-head">
                <h3>Person {i + 1}</h3>
                {people.length > 1 ? (
                  <button type="button" className="link-button danger" onClick={() => setPeople((ps) => ps.filter((x) => x.key !== p.key))}>
                    Remove<span className="visually-hidden"> person {i + 1}</span>
                  </button>
                ) : null}
              </div>
              <div className="person-fields">
                <TextField name={`visitors.${i}.first_name`} label="First name" autoComplete="off" value={p.first_name}
                  onChange={(e) => update(p.key, { first_name: e.target.value })} />
                <TextField name={`visitors.${i}.age`} label="Age" optional inputMode="numeric" width="short" value={p.age}
                  onChange={(e) => update(p.key, { age: e.target.value })} />
              </div>
              <Choices type="radio" name={`kind-${p.key}`} id={`visitors.${i}.kind`} legend="Are they" inline
                choices={[
                  { value: 'visitor', label: 'The person this visit is for' },
                  { value: 'sibling', label: 'A brother, sister or friend' },
                ]}
                values={[p.kind]} onChange={([v]) => update(p.key, { kind: v as Person['kind'] })} />
            </div>
          ))}
        </div>
        {people.length < 12 ? (
          <button type="button" className="button secondary"
            onClick={() => setPeople((ps) => [...ps, { key: Math.max(...ps.map((x) => x.key)) + 1, kind: 'sibling', first_name: '', age: '' }])}>
            Add another person
          </button>
        ) : null}
      </section>

      <section className="form-section" aria-labelledby="you">
        <h2 id="you">Your details</h2>
        <TextField name="contact_name" label="Your name" autoComplete="name" />
        <Choices type="checkbox" name="channels" legend="How should we send your booking details and reminders?"
          hint="Choose as many as you like." choices={channelChoices} values={channels} onChange={setChannels} />
        <TextField name="email" type="email" label="Email address" autoComplete="email" optional={!channels.includes('email')} />
        <TextField name="phone" type="tel" label="UK mobile number" hint="For texts and WhatsApp." autoComplete="tel"
          width="medium" optional={channels.every((c) => c === 'email')} />
        <TextField name="postcode" label="Postcode" autoComplete="postal-code" width="short" optional
          hint="We use this only to make sure each family gets a turn." />
        <TextField name="address_line" label="First line of your address" autoComplete="address-line1" optional />
      </section>

      <section className="form-section" aria-labelledby="photos">
        <h2 id="photos">Photos</h2>
        <Choices type="radio" name="photo_consent" legend="Can our elves take photos of your visit?"
          hint="You can change your mind at any time." choices={photoChoices} defaultValue="none" />
      </section>

      <section className="form-section" aria-labelledby="agree">
        <h2 id="agree">Before you book</h2>
        <Tick name="eligibility_confirmed" label="Our family or group includes a child or an adult with a disability" />
        <Tick name="data_consent"
          label="I agree to you holding these details, and anything I tell you about our visitors, to prepare for our visit"
          hint={<>We delete them after the season. <Link href="/privacy">How we look after your details</Link></>} />
      </section>
    </ActionForm>
  );
}
