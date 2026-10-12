'use client';
import { useState } from 'react';
import { ActionForm, Choices, TextArea, TextField } from '@/components/form';
import { communicationOptions, meetOptions, mobilityOptions, photoChoices, sensoryOptions } from '@/lib/options';
import type { FormState } from '@/lib/forms';
import type { BookingVisitor } from '@/lib/public-data';

type Text = 'first_name' | 'age' | 'sex' | 'pronouns' | 'loves' | 'dislikes' | 'calming' | 'meet_preference' | 'gift_ideas'
  | 'condition' | 'medical' | 'other_requirements';
type Lists = 'communication' | 'mobility' | 'sensory';
type Person = { key: number; id?: string; kind: 'visitor' | 'sibling' } & Record<Text, string> & Record<Lists, string[]>;

const fromVisitor = (v: BookingVisitor, key: number): Person => ({
  key, id: v.id, kind: v.kind, first_name: v.first_name, age: v.age?.toString() ?? '', sex: v.sex ?? '', pronouns: v.pronouns ?? '',
  communication: v.communication, mobility: v.mobility, sensory: v.sensory, loves: v.loves ?? '', dislikes: v.dislikes ?? '',
  calming: v.calming ?? '', meet_preference: v.meet_preference ?? '', gift_ideas: v.gift_ideas ?? '', condition: v.condition ?? '',
  medical: v.medical ?? '', other_requirements: v.other_requirements ?? '',
});
const blankPerson = (key: number, kind: Person['kind']): Person => ({
  key, kind, first_name: '', age: '', sex: '', pronouns: '', communication: [], mobility: [], sensory: [], loves: '', dislikes: '',
  calming: '', meet_preference: '', gift_ideas: '', condition: '', medical: '', other_requirements: '',
});
const toPayload = ({ key: _key, ...p }: Person) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v !== undefined));

const withOwn = (options: string[], chosen: string[]) => [...options, ...chosen.filter((c) => !options.includes(c))];

export function DetailsForm({ action, visitors, photoConsent }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  visitors: BookingVisitor[]; photoConsent: string;
}) {
  const [people, setPeople] = useState<Person[]>(() =>
    visitors.length ? visitors.map(fromVisitor) : [blankPerson(0, 'visitor')]);
  const [photo, setPhoto] = useState(photoConsent);
  const set = (key: number, change: Partial<Person>) => setPeople((ps) => ps.map((p) => (p.key === key ? { ...p, ...change } : p)));
  const details = { photo_consent: photo, visitors: people.map(toPayload) };

  return (
    <ActionForm action={action} submitLabel="Save">
      <input type="hidden" name="details" value={JSON.stringify(details)} />
      <div id="visitors" tabIndex={-1}>
        {people.map((p, i) => {
          const f = (name: Text) => ({
            name: `p${p.key}-${name}`, id: `visitors.${i}.${name}`, value: p[name],
            onChange: (v: string) => set(p.key, { [name]: v } as Partial<Person>),
          });
          const name = p.first_name || `Person ${i + 1}`;
          return (
            <details className="person" key={p.key} open={i === 0 || !p.id}>
              <summary>{name}{p.kind === 'sibling' ? ' (brother, sister or friend)' : ''}</summary>
              <div className="person-fields">
                <TextField {...f('first_name')} label="First name" onChange={(e) => set(p.key, { first_name: e.target.value })} />
                <TextField {...f('age')} label="Age" optional inputMode="numeric" width="short" onChange={(e) => set(p.key, { age: e.target.value })} />
              </div>
              <Choices type="radio" name={`p${p.key}-kind`} id={`visitors.${i}.kind`} legend="Are they" inline
                choices={[{ value: 'visitor', label: 'The person this visit is for' }, { value: 'sibling', label: 'A brother, sister or friend' }]}
                values={[p.kind]} onChange={([v]) => set(p.key, { kind: v as Person['kind'] })} />
              <Choices type="radio" name={`p${p.key}-sex`} id={`visitors.${i}.sex`} legend="Would Santa call them a boy or a girl?" optional inline
                hint="This helps Santa choose words and a gift."
                choices={[{ value: 'boy', label: 'Boy' }, { value: 'girl', label: 'Girl' }, { value: 'prefer_not', label: 'Neither or prefer not to say' }]}
                values={p.sex ? [p.sex] : []} onChange={([v]) => set(p.key, { sex: v })} />
              <TextField {...f('pronouns')} label="Pronouns" optional width="medium" hint="For example she/her, he/him or they/them."
                onChange={(e) => set(p.key, { pronouns: e.target.value })} />

              <h3>Meeting Santa</h3>
              <Choices type="radio" name={`p${p.key}-meet`} id={`visitors.${i}.meet_preference`} legend="How would they like to meet Santa?" optional
                choices={withOwn(meetOptions, p.meet_preference ? [p.meet_preference] : []).map((o) => ({ value: o, label: o }))}
                values={p.meet_preference ? [p.meet_preference] : []} onChange={([v]) => set(p.key, { meet_preference: v })} />
              <TextArea {...f('loves')} label="What do they love?" optional hint="Favourite things, characters, games or topics. Santa can talk about these." />
              <TextArea {...f('dislikes')} label="Is there anything they dislike or find hard?" optional hint="For example loud voices, beards, being asked questions." />
              <TextArea {...f('calming')} label="What helps if they become upset or overwhelmed?" optional />
              <TextArea {...f('gift_ideas')} label="Gift ideas" optional hint="Anything they would especially like, or should not have." />

              <h3>Communication, getting around and senses</h3>
              <Choices type="checkbox" name={`p${p.key}-communication`} id={`visitors.${i}.communication`} legend="Communication" optional
                choices={withOwn(communicationOptions, p.communication).map((o) => ({ value: o, label: o }))}
                values={p.communication} onChange={(v) => set(p.key, { communication: v })} />
              <Choices type="checkbox" name={`p${p.key}-mobility`} id={`visitors.${i}.mobility`} legend="Getting around" optional
                choices={withOwn(mobilityOptions, p.mobility).map((o) => ({ value: o, label: o }))}
                values={p.mobility} onChange={(v) => set(p.key, { mobility: v })} />
              <Choices type="checkbox" name={`p${p.key}-sensory`} id={`visitors.${i}.sensory`} legend="Senses" optional
                choices={withOwn(sensoryOptions, p.sensory).map((o) => ({ value: o, label: o }))}
                values={p.sensory} onChange={(v) => set(p.key, { sensory: v })} />

              <div className="private">
                <h4>Health and support needs</h4>
                <p className="hint">Only our organiser and lead elf can see this. Elves and Santa cannot.</p>
                <TextArea {...f('condition')} label="Disability or condition" optional />
                <TextArea {...f('medical')} label="Medical needs we should know about" optional hint="For example seizures, allergies or medication." />
                <TextArea {...f('other_requirements')} label="Anything else that would help" optional />
              </div>

              {people.length > 1 ? (
                <p><button type="button" className="link-button danger" onClick={() => setPeople((ps) => ps.filter((x) => x.key !== p.key))}>
                  Remove {name} from this visit
                </button></p>
              ) : null}
            </details>
          );
        })}
      </div>
      {people.length < 12 ? (
        <button type="button" className="button secondary"
          onClick={() => setPeople((ps) => [...ps, blankPerson(Math.max(...ps.map((x) => x.key)) + 1, 'sibling')])}>
          Add another person
        </button>
      ) : null}

      <div className="form-section">
        <Choices type="radio" name="photo" id="photo_consent" legend="Can our elves take photos of your visit?"
          choices={photoChoices} values={[photo]} onChange={([v]) => setPhoto(v)} />
      </div>
    </ActionForm>
  );
}
