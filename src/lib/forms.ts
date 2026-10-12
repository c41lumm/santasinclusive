import type { ZodError } from 'zod';

/** What a form's server action returns: nothing (it redirected), or the problems to show */
export type FormState = { errors?: { field?: string; message: string }[]; done?: string };

export function zodErrors(error: ZodError): FormState {
  const seen = new Set<string>();
  const errors = error.issues.flatMap((i) => {
    const field = i.path.join('.') || undefined;
    const key = `${field}:${i.message}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ field, message: i.message }];
  });
  return { errors };
}

export const problem = (message: string, field?: string): FormState => ({ errors: [{ field, message }] });

/** Error codes from the database and the form checks, in words families understand */
export const messages: Record<string, string> = {
  SLOT_FULL: 'Sorry, someone has just booked that time. Please choose another.',
  SLOT_UNAVAILABLE: 'That time is not available any more. Please choose another.',
  BOOKING_CLOSED: 'Booking is not open at the moment.',
  ELIGIBILITY_REQUIRED: 'Please confirm your group includes a child or adult with a disability.',
  CONSENT_REQUIRED: 'Please agree to us holding your details so we can prepare for your visit.',
  CONTACT_REQUIRED: 'Please give an email address or mobile number.',
  INVALID_PHONE: 'Please give a UK mobile number, starting 07.',
  VISITOR_REQUIRED: 'Please tell us who is visiting Santa.',
  NOT_FOUND: 'We could not find this booking. Please use the link in your latest message from us.',
  TOO_LATE: 'This visit has already started, so it cannot be changed here. Please speak to an elf.',
  OFFER_EXPIRED: 'Sorry, this offer has ended and the time has passed to the next family.',
  ALREADY_BOOKED: 'You already have a visit booked. We have sent its details to you.',
  NOT_VERIFIED: 'We could not check the form was sent by a person. Please refresh the page and try again.',
  TOO_MANY: 'There have been too many attempts from your connection. Please wait a while and try again.',
  ERROR: 'Something went wrong. Please try again, or contact us if it keeps happening.',
};

/** The error code a database function raised, if it is one we know */
export function dbCode(e: unknown) {
  const code = e instanceof Error ? e.message : '';
  return code in messages ? code : 'ERROR';
}

/** Reading FormData: blank answers become undefined, ticked boxes become true */
export const text = (fd: FormData, name: string) => fd.get(name)?.toString();
export const ticked = (fd: FormData, name: string) => fd.get(name) === 'on';
export const all = (fd: FormData, name: string) => fd.getAll(name).map(String);
