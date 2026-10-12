'use client';
import { useState } from 'react';
import { ActionForm, Choices, Select, TextArea, TextField, Tick } from '@/components/form';
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
/** Keep any answer saved earlier that is not in today's list, so it is not lost */
const withOwn = (options: string[], chosen: string[]) => [...options, ...chosen.filter((c) => !options.includes(c))];
const asChoices = (options: string[]) => options.map((o) => ({ value: o, label: o }));

/** The "About your child" form from the design, in four parts. */
export function DetailsForm({ action, visitors, photoConsent }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  visitors: BookingVisitor[]; photoConsent: string;
}) {
  const [people, setPeople] = useState<Person[]>(() => {
    const ps = visitors.map(fromVisitor);
    return ps.some((p) => p.kind === 'visitor') ? ps : [blankPerson(ps.length, 'visitor'), ...ps];
  });
  const [photo, setPhoto] = useState(photoConsent);
  const set = (key: number, change: Partial<Person>) => setPeople((ps) => ps.map((p) => (p.key === key ? { ...p, ...change } : p)));
  const add = (kind: Person['kind']) => setPeople((ps) => [...ps, blankPerson(Math.max(-1, ...ps.map((x) => x.key)) + 1, kind)]);
  const remove = (key: number) => setPeople((ps) => ps.filter((x) => x.key !== key));
  const main = people.filter((p) => p.kind === 'visitor');
  const siblings = people.filter((p) => p.kind === 'sibling');
  const details = { photo_consent: photo, visitors: people.map(toPayload) };

  // Field props for person p (at index i in the full list, which is what error messages point at)
  const field = (p: Person, i: number, name: Text) => ({
    name: `p${p.key}-${name}`, id: `visitors.${i}.${name}`, value: p[name],
    onChange: (v: string) => set(p.key, { [name]: v } as Partial<Person>),
  });
  const input = (p: Person, i: number, name: Text) => {
    const f = field(p, i, name);
    return { ...f, onChange: (e: React.ChangeEvent<HTMLInputElement>) => f.onChange(e.target.value) };
  };
  const list = (p: Person, i: number, name: Lists, options: string[]) => ({
    type: 'checkbox' as const, name: `p${p.key}-${name}`, id: `visitors.${i}.${name}`, layout: 'grid' as const,
    choices: asChoices(withOwn(options, p[name])), values: p[name], onChange: (v: string[]) => set(p.key, { [name]: v } as Partial<Person>),
  });

  return (
    <ActionForm action={action} submitLabel="Save and finish"
      secondary={<button type="submit" name="later" value="1" className="link-button">Save and come back later</button>}>
      <input type="hidden" name="details" value={JSON.stringify(details)} />

      {people.map((p, i) => {
        if (p.kind !== 'visitor') return null;
        const n = main.indexOf(p);
        const who = p.first_name || (main.length > 1 ? `visitor ${n + 1}` : 'them');
        const tag = main.length > 1 ? ` · ${p.first_name || `Visitor ${n + 1}`}` : '';
        return (
          <div key={p.key} id={i === 0 ? 'visitors' : undefined} tabIndex={-1}>
            <section aria-label={`About ${who}`} className="card card-lg form-part">
              <p className="eyebrow">Part 1 of 4{tag}</p>
              <h2>About the visitor</h2>
              <p className="intro">A few details so Santa can give them a warm welcome.</p>
              <TextField {...input(p, i, 'first_name')} label="What do they like to be called?" autoComplete="off" />
              <TextField {...input(p, i, 'age')} label="Age" inputMode="numeric" width="short" />
              <TextField {...input(p, i, 'pronouns')} label="Pronouns" optional hint="For example he, she or they. Santa will use these." width="medium" />
              {main.length > 1 ? (
                <button type="button" className="link-button danger" onClick={() => remove(p.key)}>Remove {p.first_name || `visitor ${n + 1}`} from this visit</button>
              ) : null}
            </section>

            <section aria-label={`Needs and support for ${who}`} className="card card-lg form-part">
              <p className="eyebrow">Part 2 of 4{tag}</p>
              <h2>Needs and support</h2>
              <p className="intro">Tell us what helps them feel comfortable. You can skip anything you would rather not share.</p>
              <TextArea {...field(p, i, 'condition')} label="Condition or diagnosis" optional
                hint="Share as much or as little as you like. It helps the team understand how to welcome them." />
              <Choices {...list(p, i, 'communication', communicationOptions)} legend={<>How do they communicate? <span className="optional">(tick all that apply)</span></>} mark={false} />
              <Choices {...list(p, i, 'mobility', mobilityOptions)} legend={<>Getting around <span className="optional">(tick all that apply)</span></>} mark={false} />
              <Choices {...list(p, i, 'sensory', sensoryOptions)} legend={<>Sensory needs <span className="optional">(tick all that apply)</span></>} mark={false} />
              <TextArea {...field(p, i, 'medical')} label="Medical needs or allergies" optional
                hint="For example medication, tube feeding, or allergies we should know about before giving a gift or treat." />
              <TextArea {...field(p, i, 'other_requirements')} label="Anything else we should do to make the visit work for you" optional
                placeholder="For example, a quieter time, a side entrance, or dimmer lights" />
              <p className="hint" style={{ marginBottom: 0 }}>Condition, medical needs and anything else here are only seen by our organisers.</p>
            </section>

            <section aria-label={`What makes ${who} smile`} className="card card-lg form-part">
              <p className="eyebrow">Part 3 of 4{tag}</p>
              <h2>What makes them smile</h2>
              <p className="intro">This is the part Santa and the elves read first.</p>
              <TextArea {...field(p, i, 'loves')} label="What do they love?"
                hint="Favourite characters, songs, colours, toys or activities. This helps Santa and the elves connect."
                placeholder="For example Bluey, trains, bubbles, Christmas lights" />
              <TextArea {...field(p, i, 'dislikes')} label="What do they dislike or find upsetting?"
                hint="Anything that could cause distress, so we can avoid it."
                placeholder="For example loud noises, sudden surprises, strangers touching them" />
              <TextArea {...field(p, i, 'calming')} label="What helps when they are upset?" optional
                placeholder="For example a favourite toy, a quiet corner, or a particular song" />
              <Choices type="radio" name={`p${p.key}-meet`} id={`visitors.${i}.meet_preference`} legend="How would they like to meet Santa?" mark={false}
                choices={asChoices(withOwn(meetOptions, p.meet_preference ? [p.meet_preference] : []))}
                values={p.meet_preference ? [p.meet_preference] : []} onChange={([v]) => set(p.key, { meet_preference: v })} />
              <TextArea {...field(p, i, 'gift_ideas')} label="Gift ideas" optional
                hint="Santa chooses a gift for every child. Tell us what they would enjoy, or anything to avoid, such as small parts." />
            </section>
          </div>
        );
      })}
      {people.length < 12 ? (
        <p style={{ marginTop: -8, marginBottom: 28 }}>
          <button type="button" className="btn btn-outline" onClick={() => add('visitor')}>Add another person with a disability</button>
        </p>
      ) : null}

      <section aria-labelledby="part4" className="card card-lg form-part">
        <p className="eyebrow">Part 4 of 4</p>
        <h2 id="part4">Family, photos and permission</h2>
        <p className="intro">Almost done.</p>
        <fieldset className="field">
          <legend>Brothers and sisters coming too <span className="optional">(optional)</span></legend>
          <p className="hint" style={{ marginBottom: 16 }}>So the elves can welcome them by name and have everything ready.</p>
          {people.map((p, i) => {
            if (p.kind !== 'sibling') return null;
            const n = siblings.indexOf(p) + 1;
            return (
              <div className="sub-card" key={p.key}>
                <p className="who">Brother or sister {n}</p>
                <div className="row-fields">
                  <TextField {...input(p, i, 'first_name')} label="Name" mark={false} autoComplete="off" />
                  <TextField {...input(p, i, 'age')} label="Age" mark={false} inputMode="numeric" />
                  <Select name={`p${p.key}-sex`} id={`visitors.${i}.sex`} label="Boy or girl" mark={false} placeholder="Choose"
                    options={[{ value: 'boy', label: 'Boy' }, { value: 'girl', label: 'Girl' }, { value: 'prefer_not', label: 'Prefer not to say' }]}
                    value={p.sex} onChange={(v) => set(p.key, { sex: v })} />
                </div>
                <button type="button" className="link-button danger" onClick={() => remove(p.key)}>Remove brother or sister {n}</button>
              </div>
            );
          })}
          {people.length < 12 ? (
            <button type="button" className="btn btn-outline" onClick={() => add('sibling')}>Add {siblings.length ? 'another' : 'a'} brother or sister</button>
          ) : null}
        </fieldset>

        <Choices type="radio" name="photo" id="photo_consent" legend="Photos on the day" mark={false}
          hint="We never share photos of visitors without your permission." choices={photoChoices} values={[photo]} onChange={([v]) => setPhoto(v)} />

        <div className="panel">
          <p style={{ fontWeight: 700, marginBottom: 6 }}>How we use this information</p>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            Only the Santa, elves and organisers who need it on the day can see it, and health details only our organisers. We use
            it to prepare for your visit, and we delete it after the season ends.
          </p>
        </div>
        <Tick name="consent" label="I agree that Santa's Inclusive Grotto can use the details above, including health and disability information, to prepare for our visit." />
      </section>
    </ActionForm>
  );
}
