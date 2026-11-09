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
// Email and text for now. WhatsApp can be added back here once Meta has approved the message templates (see README).
export const channels = z.array(z.enum(['email', 'sms'])).min(1, 'Please choose how we should contact you');

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
}).superRefine(contactRules);

/** An email address for email and a mobile for texts. Channels needs at least one, so there is always a way to reach them. */
function contactRules(b: { channels: string[]; email?: string; phone?: string }, ctx: z.RefinementCtx) {
  if (b.channels.includes('email') && !b.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Please give an email address, or choose text instead' });
  if (b.channels.includes('sms') && !b.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Please give a mobile number for texts' });
}

// The same checks on their own. Zod skips a form's own checks while any field has a problem, so without this
// a family would only be told about a missing email or mobile after fixing everything else.
const contactSchema = z.object({ channels, email: optionalEmail, phone: optionalMobile }).superRefine(contactRules);

/** Helpers changing a booking's contact details */
export const contactEditSchema = z.object({
  contact_name: z.string().trim().min(1, 'Please give their name').max(100),
  email: optionalEmail, phone: optionalMobile, channels,
}).superRefine(contactRules);

export type BookingInput = z.infer<typeof bookingSchema>;

/** Checks the booking form, reporting every problem at once */
export function checkBooking(input: unknown): z.SafeParseReturnType<unknown, BookingInput> {
  const result = bookingSchema.safeParse(input);
  if (result.success) return result;
  const seen = new Set(result.error.issues.map((i) => `${i.path.join('.')}:${i.message}`));
  const contact = contactSchema.safeParse(input);
  const extra = contact.success ? [] : contact.error.issues.filter((i) => !seen.has(`${i.path.join('.')}:${i.message}`));
  // In the order the form asks, so the list of problems reads top to bottom
  const order = ['slot_id', 'visitors', 'contact_name', 'channels', 'email', 'phone', 'postcode', 'address_line', 'eligibility_confirmed', 'data_consent'];
  const rank = (i: z.ZodIssue) => { const n = order.indexOf(String(i.path[0])); return n < 0 ? order.length : n; };
  return { success: false, error: new z.ZodError([...result.error.issues, ...extra].sort((a, b) => rank(a) - rank(b))) };
}

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
