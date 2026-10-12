import { z } from 'zod';
import { channels, mustTick, optionalEmail, optionalMobile, requiredEmail, ukMobile } from '@/lib/booking-schema';

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optText = (max: number) => z.preprocess(blank, z.string().trim().max(max, `Please keep this under ${max} characters`).optional());
const name = z.string().trim().min(1, 'Please give your name').max(100);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please choose a day');
const whole = (label: string, min: number, max: number) =>
  z.coerce.number({ invalid_type_error: `Please give ${label} as a number` }).int().min(min, `Please give ${label}`).max(max, `Please check ${label}`);

// Email only, to keep it simple: offers go out by email
export const waitlistSchema = z.object({
  day,
  time_pref: z.enum(['any', 'morning', 'afternoon']).default('any'),
  contact_name: name,
  email: requiredEmail,
  eligibility_confirmed: mustTick('Please confirm your group includes a child or adult with a disability'),
  data_consent: mustTick('Please agree to us holding your details'),
});

/** One box for "email or mobile", as in the design, then how to send the alert */
/** Early alerts are by email only, to keep it simple */
export const alertSchema = z.object({
  name,
  contact: requiredEmail.transform((e) => e.toLowerCase()),
  is_group: z.boolean().default(false),
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
  time_pref: z.array(z.enum(['morning', 'early_afternoon', 'any'])).max(3).default([]),
  needs: optText(2000),
  data_consent: mustTick('Please agree to us holding these details'),
});

export const volunteerSchema = z.object({
  role: z.enum(['santa', 'elf'], { errorMap: () => ({ message: 'Please choose Santa or Elf' }) }),
  name: z.string().trim().min(1, 'Please give your full name').max(100),
  email: requiredEmail,
  phone: ukMobile,
  town: optText(80),
  over_18: z.enum(['yes', 'no'], { errorMap: () => ({ message: 'Please tell us if you are 18 or over' }) })
    .refine((v) => v === 'yes', { message: 'Volunteers need to be 18 or over. Thank you for wanting to help.' }),
  available_weeks: z.array(z.string().max(40)).min(1, 'Please tick at least one week you could help').max(6),
  day_types: z.array(z.enum(['Weekdays', 'Weekends', 'Evenings'])).min(1, 'Please tick which days suit you'),
  experience: optText(2000),
  own_suit: z.enum(['yes', 'no']).optional(),
  why: z.string().trim().min(1, 'Please tell us why you would like to volunteer').max(2000),
  checks_agreed: mustTick('Please confirm you understand the checks'),
  data_consent: mustTick('Please agree to us holding your details'),
});

/** The amount is worked out on the server from the number of gifts, not taken from the page */
export const sponsorSchema = z.object({
  company: z.string().trim().min(1, 'Please give your company or organisation name').max(150),
  contact_name: name,
  email: requiredEmail,
  gifts: whole('the number of gifts', 1, 5000),
  pay_method: z.enum(['card', 'invoice'], { errorMap: () => ({ message: 'Please choose how you would like to pay' }) }),
  show_on_wall: z.boolean().default(false),
  logo_requested: z.boolean().default(false),
});
