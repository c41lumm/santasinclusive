import { z } from 'zod';
import { channels, mustTick, optionalEmail, optionalMobile, requiredEmail, ukMobile } from '@/lib/booking-schema';

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optText = (max: number) => z.preprocess(blank, z.string().trim().max(max, `Please keep this under ${max} characters`).optional());
const name = z.string().trim().min(1, 'Please give your name').max(100);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please choose a day');
const whole = (label: string, min: number, max: number) =>
  z.coerce.number({ invalid_type_error: `Please give ${label} as a number` }).int().min(min, `Please give ${label}`).max(max, `Please check ${label}`);

export const waitlistSchema = z.object({
  day,
  time_pref: z.enum(['any', 'morning', 'afternoon']).default('any'),
  contact_name: name,
  email: optionalEmail,
  phone: optionalMobile,
  channels,
  eligibility_confirmed: mustTick('Please confirm your group includes a child or adult with a disability'),
  data_consent: mustTick('Please agree to us holding your details'),
}).refine((w) => w.email || w.phone, { message: 'Please give an email address or a UK mobile number', path: ['email'] })
  .refine((w) => !w.channels.includes('email') || w.email, { message: 'Please give an email address, or choose text instead', path: ['email'] })
  .refine((w) => w.channels.every((c) => c === 'email') || w.phone, { message: 'Please give a mobile number for texts or WhatsApp', path: ['phone'] });

/** One box for "email or mobile", as people find that simplest */
export const alertSchema = z.object({
  name,
  contact: z.string().trim().min(1, 'Please give an email address or UK mobile number').max(200),
  is_group: z.boolean().default(false),
  data_consent: mustTick('Please agree to us holding your details to send the alert'),
}).transform((a, ctx) => {
  if (a.contact.includes('@')) {
    const email = z.string().email().safeParse(a.contact);
    if (email.success) return { ...a, contact: a.contact.toLowerCase(), channels: ['email'] as const };
  } else {
    const phone = ukMobile.safeParse(a.contact);
    if (phone.success) return { ...a, contact: phone.data, channels: ['sms'] as const };
  }
  ctx.addIssue({ code: 'custom', path: ['contact'], message: 'Please give an email address or a UK mobile number starting 07' });
  return z.NEVER;
});

export const groupSchema = z.object({
  organisation: z.string().trim().min(1, 'Please give the name of your school or group').max(150),
  contact_name: name,
  role: optText(100),
  email: requiredEmail,
  phone: z.string().trim().regex(/^[+\d\s()-]{10,20}$/, 'Please give a phone number we can call'),
  people: whole('the number of people visiting Santa', 1, 200),
  staff: whole('the number of staff or carers', 0, 100),
  age_range: z.string().trim().min(1, 'Please give the ages').max(60),
  weeks: z.array(z.string().max(40)).max(6).default([]),
  time_pref: z.array(z.enum(['morning', 'afternoon'])).max(2).default([]),
  needs: optText(2000),
  data_consent: mustTick('Please agree to us holding these details'),
});

export const volunteerSchema = z.object({
  role: z.enum(['elf', 'lead_elf', 'santa'], { errorMap: () => ({ message: 'Please choose a role' }) }),
  name,
  email: requiredEmail,
  phone: ukMobile,
  available_days: z.array(day).min(1, 'Please choose at least one day you could help'),
  over_18: mustTick('Volunteers need to be 18 or over'),
  experience: optText(2000),
  why: optText(2000),
  own_suit: z.boolean().optional(),
  data_consent: mustTick('Please agree to us holding your details'),
});

export const sponsorSchema = z.object({
  company: z.string().trim().min(1, 'Please give your company or organisation name').max(150),
  contact_name: name,
  email: requiredEmail,
  gifts: whole('the number of gifts', 1, 5000),
  amount_pounds: z.coerce.number({ invalid_type_error: 'Please give an amount in pounds' })
    .min(1, 'Please give an amount of at least £1').max(100000, 'Please contact us about gifts this large'),
  pay_method: z.enum(['card', 'invoice'], { errorMap: () => ({ message: 'Please choose how you would like to pay' }) }),
  show_on_wall: z.boolean().default(false),
  logo_requested: z.boolean().default(false),
  data_consent: mustTick('Please agree to us holding these details'),
});
