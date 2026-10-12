'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm, Choices, TextField, Tick } from '@/components/form';
import { channelChoices } from '@/lib/options';
import { bookAction } from '../actions';

type Person = { key: number; kind: 'visitor' | 'sibling'; first_name: string; age: string };

/** The booking itself: who is coming and how to reach you. Everything about the visitors comes after. */
export function BookingForm({ slotId }: { slotId: string }) {
  const [people, setPeople] = useState<Person[]>([{ key: 0, kind: 'visitor', first_name: '', age: '' }]);
  const [channels, setChannels] = useState<string[]>(['email']);
  const update = (key: number, change: Partial<Person>) => setPeople((ps) => ps.map((p) => (p.key === key ? { ...p, ...change } : p)));
  const visitors = people.map(({ kind, first_name, age }) => ({ kind, first_name, age: age === '' ? undefined : age }));
  const add = (kind: Person['kind']) => setPeople((ps) => [...ps, { key: Math.max(...ps.map((x) => x.key)) + 1, kind, first_name: '', age: '' }]);
  const main = people.filter((p) => p.kind === 'visitor');
  const siblings = people.filter((p) => p.kind === 'sibling');

  const personFields = (p: Person, i: number, title: string) => (
    <div className="sub-card" key={p.key}>
      <p className="who">{title}</p>
      <div className="row-fields">
        <TextField name={`visitors.${i}.first_name`} label="What do they like to be called?" autoComplete="off" value={p.first_name}
          onChange={(e) => update(p.key, { first_name: e.target.value })} />
        <TextField name={`visitors.${i}.age`} label="Age" optional inputMode="numeric" value={p.age}
          onChange={(e) => update(p.key, { age: e.target.value })} />
      </div>
      {people.length > 1 && !(p.kind === 'visitor' && main.length === 1) ? (
        <button type="button" className="link-button danger" onClick={() => setPeople((ps) => ps.filter((x) => x.key !== p.key))}>
          Remove {p.first_name || title.toLowerCase()}
        </button>
      ) : null}
    </div>
  );

  return (
    <ActionForm action={bookAction} submitLabel="Book this visit">
      <input type="hidden" name="slot_id" value={slotId} />
      <input type="hidden" name="visitors" value={JSON.stringify(visitors)} />

      <section aria-labelledby="part1" className="card card-lg form-part">
        <p className="eyebrow">Part 1 of 2</p>
        <h2 id="part1">Who is coming</h2>
        <p className="intro">Just names for now. After booking you can tell Santa all about them.</p>
        <div id="visitors" tabIndex={-1}>
          {people.map((p, i) => p.kind === 'visitor'
            ? personFields(p, i, main.length > 1 ? `Visiting Santa ${main.indexOf(p) + 1}` : 'Visiting Santa')
            : null)}
          <p className="hint">If more than one person with a disability is coming, add them here.</p>
          <button type="button" className="btn btn-outline" onClick={() => add('visitor')} disabled={people.length >= 12}>
            Add another person with a disability
          </button>
          <h3 style={{ marginTop: 28 }}>Brothers and sisters coming too <span className="optional" style={{ fontFamily: 'inherit', fontSize: '1rem' }}>(optional)</span></h3>
          <p className="hint">So the elves can welcome them by name. Parents and carers do not need to be added.</p>
          {people.map((p, i) => p.kind === 'sibling' ? personFields(p, i, `Brother or sister ${siblings.indexOf(p) + 1}`) : null)}
          <button type="button" className="btn btn-outline" onClick={() => add('sibling')} disabled={people.length >= 12}>
            Add a brother or sister
          </button>
        </div>
      </section>

      <section aria-labelledby="part2" className="card card-lg form-part">
        <p className="eyebrow">Part 2 of 2</p>
        <h2 id="part2">How we keep in touch</h2>
        <p className="intro">We send your booking details, reminders before your visit, and a link to change plans.</p>
        <TextField name="contact_name" label="Your name" autoComplete="name" />
        <Choices type="checkbox" name="channels" legend="Send my booking and reminders by" layout="inline"
          hint="Choose as many as you like." choices={channelChoices.map((c) => ({ ...c, label: c.value === 'sms' ? 'Text' : c.label }))}
          values={channels} onChange={setChannels} mark={false} />
        <TextField name="email" type="email" label="Email address" autoComplete="email" optional={!channels.includes('email')} />
        <TextField name="phone" type="tel" label="UK mobile number" hint="For texts and WhatsApp." autoComplete="tel"
          width="medium" optional={channels.every((c) => c === 'email')} />
        <div className="grid-2">
          <TextField name="postcode" label="Postcode" autoComplete="postal-code" optional hint="Only used to make sure every family gets a turn." />
          <TextField name="address_line" label="First line of your address" autoComplete="address-line1" optional />
        </div>
        <div className="panel" style={{ marginTop: 8 }}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>Before you book</p>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            The grotto is only for families with a child or adult who has a disability, so every visit stays calm and unhurried.
            We hold your details to prepare for your visit and delete them after the season. <Link href="/privacy">How we look after your details</Link>
          </p>
        </div>
        <Tick name="eligibility_confirmed" label="Our family or group includes a child or an adult with a disability." />
        <Tick name="data_consent" label="I agree to Santa's Inclusive Grotto holding these details to prepare for our visit." />
      </section>
    </ActionForm>
  );
}
