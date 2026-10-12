import { z } from 'zod';

const list = z.array(z.string().max(80)).max(12).default([]);

/** UK mobiles only (texts are never sent abroad), stored as +447... */
export const ukMobile = z.string().trim()
  .transform((s) => s.replace(/[\s()-]/g, ''))
  .refine((s) => /^(?:\+44|0044|44|0)7\d{9}$/.test(s), { message: 'Please give a UK mobile number, starting 07' })
  .transform((s) => `+447${s.replace(/^(?:\+44|0044|44|0)7/, '')}`);

export const visitorSchema = z.object({
  kind: z.enum(['visitor', 'sibling']),
  first_name: z.string().trim().min(1).max(60),
  age: z.coerce.number().int().min(0).max(120).optional(),
  sex: z.enum(['boy', 'girl', 'prefer_not']).optional(),
  pronouns: z.string().max(30).optional(),
  communication: list,
  mobility: list,
  sensory: list,
  loves: z.string().max(500).optional(),
  dislikes: z.string().max(500).optional(),
  calming: z.string().max(500).optional(),
  meet_preference: z.string().max(120).optional(),
  gift_ideas: z.string().max(500).optional(),
  condition: z.string().max(1000).optional(),
  medical: z.string().max(1000).optional(),
  other_requirements: z.string().max(1000).optional(),
});

export const bookingSchema = z.object({
  slot_id: z.string().uuid(),
  contact_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().optional().or(z.literal('').transform(() => undefined)),
  phone: z.literal('').transform(() => undefined).or(ukMobile.optional()),
  postcode: z.string().trim().max(10).optional(),
  address_line: z.string().trim().max(120).optional(),
  channels: z.array(z.enum(['email', 'sms', 'whatsapp'])).min(1),
  photo_consent: z.enum(['share', 'family_only', 'none']).default('none'),
  eligibility_confirmed: z.literal(true),
  data_consent: z.literal(true),
  visitors: z.array(visitorSchema).min(1).max(12),
}).refine((b) => b.email || b.phone, { message: 'Please give an email address or mobile number' })
  .refine((b) => b.visitors.some((v) => v.kind === 'visitor'), { message: 'Please tell us who is visiting Santa' });

export type BookingInput = z.infer<typeof bookingSchema>;
