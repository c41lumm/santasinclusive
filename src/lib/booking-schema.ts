import { z } from 'zod';

/** Blank answers are stored as "not given", not as empty text */
const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optText = (max: number) => z.preprocess(blank, z.string().trim().max(max, `Please keep this under ${max} characters`).optional());
const list = z.array(z.string().max(80)).max(12).default([]);

/** UK mobiles only (texts are never sent abroad), stored as +447... */
export const ukMobile = z.string().trim()
  .transform((s) => s.replace(/[\s()-]/g, ''))
  .refine((s) => /^(?:\+44|0044|44|0)7\d{9}$/.test(s), { message: 'Please give a UK mobile number, starting 07' })
  .transform((s) => `+447${s.replace(/^(?:\+44|0044|44|0)7/, '')}`);

export const optionalMobile = z.preprocess(blank, ukMobile.optional());
export const optionalEmail = z.preprocess(blank, z.string().trim().email('Please check the email address').max(200).optional());
export const requiredEmail = z.string().trim().min(1, 'Please give an email address').email('Please check the email address').max(200);
export const mustTick = (message: string) => z.literal(true, { errorMap: () => ({ message }) });
export const channels = z.array(z.enum(['email', 'sms', 'whatsapp'])).min(1, 'Please choose how we should contact you');

export const visitorSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(['visitor', 'sibling']),
  first_name: z.string().trim().min(1, 'Please give a first name for everyone coming').max(60),
  age: z.preprocess(blank, z.coerce.number({ invalid_type_error: 'Please give age as a number' })
    .int('Please give age as a whole number').min(0).max(120, 'Please check the age').optional()),
  sex: z.preprocess(blank, z.enum(['boy', 'girl', 'prefer_not']).optional()),
  pronouns: optText(30),
  communication: list,
  mobility: list,
  sensory: list,
  loves: optText(500),
  dislikes: optText(500),
  calming: optText(500),
  meet_preference: optText(120),
  gift_ideas: optText(500),
  condition: optText(1000),
  medical: optText(1000),
  other_requirements: optText(1000),
});

const visitors = z.array(visitorSchema).min(1, 'Please tell us who is coming').max(12, 'Up to 12 people can come to one visit')
  .refine((vs) => vs.some((v) => v.kind === 'visitor'), { message: 'Please tell us who is visiting Santa' });
const photoConsent = z.enum(['share', 'family_only', 'none']).default('none');

export const bookingSchema = z.object({
  slot_id: z.string().uuid('Please choose a time'),
  contact_name: z.string().trim().min(1, 'Please give your name').max(100),
  email: optionalEmail,
  phone: optionalMobile,
  postcode: optText(10),
  address_line: optText(120),
  channels,
  photo_consent: photoConsent,
  eligibility_confirmed: mustTick('Please confirm your group includes a child or adult with a disability'),
  data_consent: mustTick('Please agree to us holding your details so we can prepare for your visit'),
  visitors,
}).refine((b) => b.email || b.phone, { message: 'Please give an email address or a UK mobile number', path: ['email'] })
  .refine((b) => !b.channels.includes('email') || b.email, { message: 'Please give an email address, or choose text instead', path: ['email'] })
  .refine((b) => b.channels.every((c) => c === 'email') || b.phone, { message: 'Please give a mobile number for texts or WhatsApp', path: ['phone'] });

export type BookingInput = z.infer<typeof bookingSchema>;

/** The "About your child" form on a family's booking page. Checks run together, so every problem shows at once. */
const detailsBase = z.object({ photo_consent: photoConsent, visitors, consent: z.boolean() });
type Details = z.infer<typeof detailsBase>;

function checkConsent(d: Details, ctx: z.RefinementCtx) {
  if (!d.consent) ctx.addIssue({ code: 'custom', path: ['consent'], message: 'Please agree that we can use these details, including health and disability information, to prepare for your visit' });
}

/** "Save and come back later" */
export const detailsSchema = detailsBase.superRefine(checkConsent);

/** "Save and finish" also needs what the design marks as required for each person visiting Santa */
export const finishedDetailsSchema = detailsBase.superRefine((d, ctx) => {
  d.visitors.forEach((v, i) => {
    if (v.kind !== 'visitor') return;
    const who = v.first_name || 'each person visiting Santa';
    if (v.age === undefined) ctx.addIssue({ code: 'custom', path: ['visitors', i, 'age'], message: `Please give ${who}'s age` });
    if (!v.loves) ctx.addIssue({ code: 'custom', path: ['visitors', i, 'loves'], message: `Please tell us what ${who} loves` });
    if (!v.dislikes) ctx.addIssue({ code: 'custom', path: ['visitors', i, 'dislikes'], message: `Please tell us what ${who} dislikes or finds upsetting` });
  });
  checkConsent(d, ctx);
});
