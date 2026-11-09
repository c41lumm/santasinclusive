/**
 * Every message the system sends, in one place so wording stays consistent.
 * Each one has default wording here with {placeholders}. An admin can change the wording in Admin > Message
 * wording; send() then uses that instead (see wording.ts). The same wording is used for email and text.
 */
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? '';
const manage = (token: string) => `${site()}/booking/${token}`;
const directions = 'https://www.google.com/maps/dir/?api=1&destination=20+Freeschool+Ln+Leicester+LE1+4FY';

export type Visit = { name: string; when: string; token: string; reference: string };

/** What each placeholder means, and an example used in the admin preview (full-length links, so text counts are right) */
const eg = '3f6c9a2e-71b4-4d0a-9c2e-5b8d1f7a6e42';
export const placeholders = {
  name: { label: 'First name', sample: 'Sam' },
  when: { label: 'Visit day and time', sample: 'Saturday 12 December at 10:20' },
  reference: { label: 'Booking reference', sample: 'SIG-4F2A1B' },
  booking_link: { label: 'Link to their booking', sample: `${site()}/booking/${eg}` },
  confirm_link: { label: 'Link to confirm the visit', sample: `${site()}/booking/${eg}/confirm` },
  directions: { label: 'Directions link', sample: directions },
  day: { label: 'Day', sample: 'Saturday 12 December' },
  leave_link: { label: 'Link to leave the waitlist', sample: `${site()}/waitlist/leave/${eg}` },
  claim_link: { label: 'Link to claim the visit', sample: `${site()}/claim/${eg}` },
  until: { label: 'Held until', sample: 'Saturday 12 December at 09:00' },
  week: { label: 'Week', sample: 'week of 14 December' },
  shifts: { label: 'Their shifts, one per line', sample: 'Monday 14 December, Morning\nWednesday 16 December, Afternoon' },
  book_link: { label: 'Link to book', sample: `${site()}/#book` },
  sign_in_link: { label: 'Link to set a password', sample: `${site()}/staff/reset` },
} as const;
export type Placeholder = keyof typeof placeholders;

type Def = {
  label: string; group: 'Bookings' | 'Waitlist' | 'Other';
  /** When it is sent, in plain words, for the admin */
  when: string;
  subject: string; body: string;
  /** The placeholders this message can use, and those it must keep (usually its link) */
  vars: readonly Placeholder[]; required: readonly Placeholder[];
};

const visitVars = ['name', 'when', 'reference', 'booking_link', 'confirm_link', 'directions'] as const;

export const messageDefs = {
  confirmation: {
    label: 'Booking confirmed', group: 'Bookings', when: 'Straight after a family books, or when an admin confirms a held request.',
    subject: "You're booked in to see Santa, {when}",
    body: "You're booked in! Santa can't wait to meet {name} on {when}. Your reference is {reference}. " +
      'Tell Santa about {name}, or change or cancel, here: {booking_link}',
    vars: visitVars, required: ['booking_link'],
  },
  pendingReview: {
    label: 'Request received (held for checking)', group: 'Bookings',
    when: 'When a booking is held for an admin to check. It never says why.',
    subject: 'We have your request to see Santa, {when}',
    body: 'Thank you. We have your request for {name} to see Santa on {when} and will be in touch to confirm it soon. ' +
      'Your reference is {reference}. Change or cancel: {booking_link}',
    vars: visitVars, required: ['booking_link'],
  },
  reminder7d: {
    label: 'Reminder a week before', group: 'Bookings', when: '5 to 7 days before the visit. Helpers can also send it from Bookings.',
    subject: 'See you soon, {when}',
    body: "A reminder that {name}'s visit to Santa is on {when}. Directions: {directions}. Can't make it? Tap to change: {booking_link}",
    vars: visitVars, required: ['booking_link'],
  },
  confirm48h: {
    label: 'Please confirm (2 days before)', group: 'Bookings', when: '1 to 2 days before the visit. Helpers can also send it from Bookings.',
    subject: "Please confirm {name}'s visit",
    body: "Can you confirm {name}'s visit on {when}? Tap to confirm: {confirm_link} If you can't make it, tap to change or cancel: {booking_link}",
    vars: visitVars, required: ['confirm_link'],
  },
  missingDetails: {
    label: 'Tell Santa about your visitor', group: 'Bookings',
    when: 'When a family has not told us about their visitor yet. Helpers can also send it from Bookings.',
    subject: 'Tell Santa about {name}',
    body: 'Santa would love to know more about {name} before your visit. It takes about five minutes: {booking_link}',
    vars: visitVars, required: ['booking_link'],
  },
  alreadyBooked: {
    label: 'Already booked', group: 'Bookings', when: 'When a family tries to book a second visit. Sent to their own email or phone only.',
    subject: 'Your existing visit to Santa',
    body: 'You already have a visit booked for {when}. We offer one visit per family so everyone gets a turn, ' +
      'and brothers and sisters can all come to the same visit. Change it here: {booking_link}',
    vars: visitVars, required: ['booking_link'],
  },
  moved: {
    label: 'Visit moved', group: 'Bookings', when: 'When a family or an admin moves a visit to another time.',
    subject: 'Your visit has moved to {when}',
    body: 'Your visit to Santa is now on {when}. Your reference is still {reference}. Change or cancel: {booking_link}',
    vars: visitVars, required: ['booking_link'],
  },
  cancelled: {
    label: 'Visit cancelled', group: 'Bookings', when: 'When a family or an admin cancels a visit.',
    subject: 'Your visit to Santa is cancelled',
    body: 'We have cancelled your visit on {when} (reference {reference}) and offered the time to another family. Thank you for letting us know.',
    vars: visitVars, required: [],
  },
  duplicateCancelled: {
    label: 'Second visit cancelled', group: 'Bookings', when: 'When an admin cancels a family’s second booking on the Checks page.',
    subject: 'Your second visit to Santa',
    body: 'We have cancelled the visit on {when} (reference {reference}), as your family already has one booked. ' +
      'We offer one visit per family so that everyone gets a turn, and brothers and sisters can all come to the same visit. ' +
      'If we have got this wrong, please get in touch and we will sort it out.',
    vars: visitVars, required: [],
  },
  claimed: {
    label: 'Waitlist time claimed', group: 'Waitlist', when: 'When a family claims a time offered from the waitlist.',
    subject: "You're booked in to see Santa, {when}",
    body: "You're booked in to see Santa on {when}. Your reference is {reference}. Please tell us who is coming and a little about them: {booking_link}",
    vars: visitVars, required: ['booking_link'],
  },
  waitlistJoined: {
    label: 'Joined the waitlist', group: 'Waitlist', when: 'Straight after a family joins the waitlist for a day.',
    subject: "You're on the waitlist for {day}",
    body: "You're on the waitlist for {day}. If a visit opens up, we will message you straight away and hold it " +
      'for you for a while, so you have time to claim it. To leave the list: {leave_link}',
    vars: ['day', 'leave_link'], required: ['leave_link'],
  },
  waitlistOffer: {
    label: 'A time has opened up', group: 'Waitlist', when: 'When a time opens and is held for the next family on the waitlist.',
    subject: 'A visit to Santa has opened up',
    body: "Good news from Santa's Inclusive Grotto. A visit has opened on {when}. It is held for you until {until}. Tap to claim it: {claim_link}",
    vars: ['when', 'until', 'claim_link'], required: ['claim_link'],
  },
  bookingOpen: {
    label: 'Early alert: booking is open', group: 'Other', when: 'When an admin sends early alerts on the Early alerts page.',
    subject: "🎅 Booking is now open at Santa's Inclusive Grotto",
    body: "Hi {name},\n\nThank you for signing up for early alerts from Santa's Inclusive Grotto. 🎄\n\n" +
      'Booking is now open! 🎉 Choose your day and time here:\n{book_link}\n\n' +
      "All the team at Santa's Inclusive Grotto ✨",
    vars: ['name', 'book_link'], required: ['book_link'],
  },
  rota: {
    label: 'Helper shifts', group: 'Other', when: 'When an admin or lead elf sends the week’s rota to helpers.',
    subject: "Your shifts at Santa's Inclusive Grotto, {week}",
    body: 'Hi {name}, thank you for helping. Your shifts for {week}:\n{shifts}\nIf you cannot make one, please let us know as soon as you can.',
    vars: ['name', 'week', 'shifts'], required: ['shifts'],
  },
  staffWelcome: {
    label: 'New helper welcome', group: 'Other', when: 'When an admin adds a helper on the Dashboard.',
    subject: "You're on the team at Santa's Inclusive Grotto",
    body: "Hi {name}, you've been added to the team at Santa's Inclusive Grotto. 🎄\n\n" +
      "To sign in, set your password here. Use this email address, then follow the link we send you:\n{sign_in_link}\n\n" +
      "All the team at Santa's Inclusive Grotto ✨",
    vars: ['name', 'sign_in_link'], required: ['sign_in_link'],
  },
  toyDonationThanks: {
    label: 'Thank you for offering toys', group: 'Other', when: 'Straight after someone offers to donate toys on the Support page.',
    subject: "Thank you for offering toys to Santa's Inclusive Grotto",
    body: "Hi {name}, thank you so much for offering toys for the children and adults who visit Santa. 🎁\n\n" +
      "One of our elves will email you in the next few days to arrange getting them to us.\n\n" +
      "All the team at Santa's Inclusive Grotto ✨",
    vars: ['name'], required: [],
  },
  runningLate: {
    label: 'Santa is running late', group: 'Other', when: 'When helpers send it from Bookings on the day.',
    subject: 'Santa is running a little late',
    body: 'Santa is running about 10 minutes behind today. There is no need to rush, we will be ready for you.',
    vars: [], required: [],
  },
} satisfies Record<string, Def>;

export type TemplateName = keyof typeof messageDefs;
export const isTemplateName = (n: string): n is TemplateName => Object.hasOwn(messageDefs, n);

/**
 * A message ready to send. `sms` is a separate text message version, when an admin has written one; otherwise
 * texts use `text`. `wording` lets send() swap in wording an admin has saved.
 */
export type Message = { subject: string; text: string; sms?: string; wording?: { name: TemplateName; vars: Partial<Record<Placeholder, string>> } };
export type Wording = { subject: string; body: string; sms_body?: string | null };

/** Puts the values into {placeholders}. Unknown placeholders are left as they are. */
export function fill(t: string, vars: Partial<Record<Placeholder, string>>) {
  return t.replace(/\{([a-z_]+)\}/g, (m, k: string) => vars[k as Placeholder] ?? m);
}

export function render(name: TemplateName, vars: Partial<Record<Placeholder, string>>, wording?: Wording): Message {
  const w = wording ?? messageDefs[name];
  const sms = wording?.sms_body ? fill(wording.sms_body, vars) : undefined;
  return { subject: fill(w.subject, vars), text: fill(w.body, vars), ...(sms ? { sms } : {}), wording: { name, vars } };
}

/** What a text message says: its own wording if it has one, otherwise the same as the email */
export const smsText = (m: Message) => m.sms ?? m.text;

/** The example values for one message, as the admin preview shows it */
export const sampleVars = (name: TemplateName) =>
  Object.fromEntries(messageDefs[name].vars.map((k) => [k, placeholders[k].sample])) as Partial<Record<Placeholder, string>>;

const visit = (v: Visit) => ({
  name: v.name, when: v.when, reference: v.reference, booking_link: manage(v.token),
  confirm_link: `${manage(v.token)}/confirm`, directions,
});

export const templates = {
  confirmation: (v: Visit) => render('confirmation', visit(v)),
  pendingReview: (v: Visit) => render('pendingReview', visit(v)),
  reminder7d: (v: Visit) => render('reminder7d', visit(v)),
  confirm48h: (v: Visit) => render('confirm48h', visit(v)),
  missingDetails: (v: Visit) => render('missingDetails', visit(v)),
  alreadyBooked: (v: Visit) => render('alreadyBooked', visit(v)),
  moved: (v: Visit) => render('moved', visit(v)),
  cancelled: (v: Visit) => render('cancelled', visit(v)),
  duplicateCancelled: (v: Visit) => render('duplicateCancelled', visit(v)),
  claimed: (v: Visit) => render('claimed', visit(v)),
  waitlistJoined: (day: string, leaveToken: string) => render('waitlistJoined', { day, leave_link: `${site()}/waitlist/leave/${leaveToken}` }),
  waitlistOffer: (when: string, claimToken: string, until: string) => render('waitlistOffer', { when, until, claim_link: `${site()}/claim/${claimToken}` }),
  /** A volunteer's shifts for the week, one per line */
  rota: (name: string, week: string, lines: string[]) => render('rota', { name, week, shifts: lines.join('\n') }),
  /** To everyone who asked for an early alert, when booking opens */
  bookingOpen: (name: string) => render('bookingOpen', { name, book_link: `${site()}/#book` }),
  runningLate: () => render('runningLate', {}),
  toyDonationThanks: (name: string) => render('toyDonationThanks', { name }),
  staffWelcome: (name: string) => render('staffWelcome', { name, sign_in_link: `${site()}/staff/reset` }),
} satisfies Record<TemplateName, (...args: never[]) => Message>;

/** Problems with wording an admin wants to save, in plain words. Empty when it is fine. */
export function wordingProblems(name: TemplateName, subject: string, body: string, sms?: string | null) {
  const def = messageDefs[name];
  const problems: { field: 'subject' | 'body' | 'sms_body'; message: string }[] = [];
  if (!subject.trim()) problems.push({ field: 'subject', message: 'Please give a subject' });
  if (subject.length > 200) problems.push({ field: 'subject', message: 'Please keep the subject under 200 characters' });
  if (!body.trim()) problems.push({ field: 'body', message: 'Please write the message' });
  if (body.length > 2000) problems.push({ field: 'body', message: 'Please keep the message under 2,000 characters' });
  if (sms != null && !sms.trim()) problems.push({ field: 'sms_body', message: 'Please write the text message, or untick "Send a different text"' });
  if (sms != null && sms.length > 1000) problems.push({ field: 'sms_body', message: 'Please keep the text message under 1,000 characters' });
  for (const [field, t] of [['subject', subject], ['body', body], ['sms_body', sms ?? '']] as const) {
    const unknown = [...t.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]).filter((k) => !(def.vars as readonly string[]).includes(k));
    if (unknown.length) problems.push({ field, message: `This message cannot use {${unknown[0]}}. Use the buttons to add details it can use.` });
  }
  for (const k of def.required) {
    if (!body.includes(`{${k}}`)) problems.push({ field: 'body', message: `The message must include {${k}} (${placeholders[k].label.toLowerCase()}), so people can use it.` });
    if (sms?.trim() && !sms.includes(`{${k}}`)) problems.push({ field: 'sms_body', message: `The text message must include {${k}} (${placeholders[k].label.toLowerCase()}), so people can use it.` });
  }
  return problems;
}
