'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm, Choices, TextArea, TextField, Tick } from '@/components/form';
import { volunteerDayTypes, volunteerWeeks } from '@/lib/options';
import { site } from '@/lib/site';
import { applyToVolunteer } from '../form-actions';

const roles = [
  { value: 'santa', name: 'Santa', img: '/images/illustration-santa-waving.png', w: 121, h: 170,
    what: 'Meets each visitor with warmth and patience. You will read what each family has shared and adapt, whether that is sitting close, waving from a distance, or moving slowly. Santa suit provided.' },
  { value: 'elf', name: 'Elf (helper)', img: '/images/illustration-elf.png', w: 97, h: 170,
    what: "Welcomes families, guides them through the grotto, hands over the gifts and helps keep the space calm. You will see each visitor's notes before they arrive." },
];

export function VolunteerForm() {
  const [role, setRole] = useState('santa');
  return (
    <ActionForm action={applyToVolunteer} submitLabel="Send my application" block
      success={(r) => (
        <div className="success" style={{ margin: 0 }}>
          <h2>Thank you for offering to be {r}</h2>
          <p>We will read your application and be in touch to arrange a short chat.</p>
          <Link href="/">Back to the homepage</Link>
        </div>
      )}>
      <fieldset id="role" tabIndex={-1} className="field" style={{ marginBottom: 32 }}>
        <legend style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: '1.85rem', color: 'var(--green)', marginBottom: 16 }}>Choose a role</legend>
        <div className="role-cards">
          {roles.map((r) => (
            <label className="role-card" key={r.value}>
              <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} />
              <Image src={r.img} alt="" width={r.w} height={r.h} />
              <span className="name">{r.name}</span>
              <span className="what">{r.what}</span>
              <span className="pick"><span className="on">Selected</span><span className="off">Choose {r.name.split(' ')[0]}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <h2 className="green" style={{ fontSize: '1.85rem', marginBottom: 8 }}>Apply to be {role === 'santa' ? 'Santa' : 'an elf'}</h2>
      <p style={{ marginBottom: 28 }}>It takes about five minutes. We will be in touch to arrange a chat.</p>
      <TextField name="name" label="Full name" autoComplete="name" />
      <TextField name="email" type="email" label="Email address" autoComplete="email" />
      <TextField name="phone" type="tel" label="Mobile number" autoComplete="tel" width="medium" />
      <TextField name="town" label="Town or city" optional autoComplete="address-level2" width="medium" />
      <Choices type="radio" name="over_18" legend="Are you 18 or over?" choices={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
      <Choices type="checkbox" name="available_weeks" legend="When could you help?" layout="grid"
        hint="Tick every week you could do at least one shift." choices={volunteerWeeks.map((w) => ({ value: w, label: w }))} />
      <Choices type="checkbox" name="day_types" legend="Which days suit you?" layout="grid" choices={volunteerDayTypes.map((d) => ({ value: d, label: d }))} />
      {role === 'santa' ? (
        <>
          <TextArea name="santa_experience" id="experience" label="Have you played Santa before?" optional hint="Tell us about it. It does not have to be at a grotto." />
          <Choices type="radio" name="own_suit" legend="We provide the Santa suit. Would you prefer to wear your own?" mark={false}
            choices={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
        </>
      ) : (
        <TextArea name="elf_experience" id="experience" label="Experience with children or adults with disabilities" optional
          hint="Professional, family or voluntary experience all count. No experience is also fine." />
      )}
      <TextArea name="why" label="Why would you like to volunteer?" />
      <div className="panel" style={{ margin: '8px 0 20px' }}>
        <p style={{ fontWeight: 700, marginBottom: 6 }}>Keeping everyone safe</p>
        <p style={{ margin: 0, fontSize: '0.95rem' }}>
          {site.volunteerChecks || 'Every volunteer has the safety checks their role needs before meeting any families. We will explain them when we chat.'}
        </p>
      </div>
      <Tick name="checks_agreed" label="I understand the checks listed above, and agree to them if I am offered a role." />
      <Tick name="data_consent" label="I agree to Santa's Inclusive Grotto holding my details to manage volunteering." />
    </ActionForm>
  );
}
