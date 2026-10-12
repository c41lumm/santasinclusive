/** Every message the system sends, in one place so wording stays consistent. */
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? '';
const manage = (token: string) => `${site()}/booking/${token}`;
const directions = 'https://www.google.com/maps/dir/?api=1&destination=20+Freeschool+Ln+Leicester+LE1+4FY';

export type Visit = { name: string; when: string; token: string; reference: string };

export const templates = {
  confirmation: (v: Visit) => ({
    subject: `You're booked in to see Santa, ${v.when}`,
    text: `You're booked in! Santa can't wait to meet ${v.name} on ${v.when}. Your reference is ${v.reference}. ` +
      `Tell Santa about ${v.name}, or change or cancel, here: ${manage(v.token)}`,
  }),
  // Held for an admin to check (flagged contact). Worded so it does not say why.
  pendingReview: (v: Visit) => ({
    subject: `We have your request to see Santa, ${v.when}`,
    text: `Thank you. We have your request for ${v.name} to see Santa on ${v.when} and will be in touch to confirm it soon. ` +
      `Your reference is ${v.reference}. Change or cancel: ${manage(v.token)}`,
  }),
  reminder7d: (v: Visit) => ({
    subject: `See you soon, ${v.when}`,
    text: `A reminder that ${v.name}'s visit to Santa is on ${v.when}. Directions: ${directions}. ` +
      `Can't make it? Tap to change: ${manage(v.token)}`,
  }),
  confirm48h: (v: Visit) => ({
    subject: `Please confirm ${v.name}'s visit`,
    text: `Can you confirm ${v.name}'s visit on ${v.when}? Tap to confirm: ${manage(v.token)}/confirm ` +
      `If you can't make it, tap to change or cancel: ${manage(v.token)}`,
  }),
  missingDetails: (v: Visit) => ({
    subject: `Tell Santa about ${v.name}`,
    text: `Santa would love to know more about ${v.name} before your visit. It takes about five minutes: ${manage(v.token)}`,
  }),
  alreadyBooked: (v: Visit) => ({
    subject: 'Your existing visit to Santa',
    text: `You already have a visit booked for ${v.when}. We offer one visit per family so everyone gets a turn, ` +
      `and brothers and sisters can all come to the same visit. Change it here: ${manage(v.token)}`,
  }),
  moved: (v: Visit) => ({
    subject: `Your visit has moved to ${v.when}`,
    text: `Your visit to Santa is now on ${v.when}. Your reference is still ${v.reference}. ` +
      `Change or cancel: ${manage(v.token)}`,
  }),
  cancelled: (v: Visit) => ({
    subject: 'Your visit to Santa is cancelled',
    text: `We have cancelled your visit on ${v.when} (reference ${v.reference}) and offered the time to another family. ` +
      `Thank you for letting us know.`,
  }),
  duplicateCancelled: (v: Visit) => ({
    subject: 'Your second visit to Santa',
    text: `We have cancelled the visit on ${v.when} (reference ${v.reference}), as your family already has one booked. ` +
      `We offer one visit per family so that everyone gets a turn, and brothers and sisters can all come to the same visit. ` +
      `If we have got this wrong, please get in touch and we will sort it out.`,
  }),
  // A family that claimed a waitlist offer has not told us who is coming yet
  claimed: (v: Visit) => ({
    subject: `You're booked in to see Santa, ${v.when}`,
    text: `You're booked in to see Santa on ${v.when}. Your reference is ${v.reference}. ` +
      `Please tell us who is coming and a little about them: ${manage(v.token)}`,
  }),
  waitlistJoined: (day: string, leaveToken: string) => ({
    subject: `You're on the waitlist for ${day}`,
    text: `You're on the waitlist for ${day}. If a visit opens up, we will message you straight away and hold it ` +
      `for you for a while, so you have time to claim it. To leave the list: ${site()}/waitlist/leave/${leaveToken}`,
  }),
  waitlistOffer: (when: string, claimToken: string, until: string) => ({
    subject: 'A visit to Santa has opened up',
    text: `Good news from Santa's Inclusive Grotto. A visit has opened on ${when}. It is held for you until ${until}. ` +
      `Tap to claim it: ${site()}/claim/${claimToken}`,
  }),
  /** A volunteer's shifts for the week, one per line */
  rota: (name: string, week: string, lines: string[]) => ({
    subject: `Your shifts at Santa's Inclusive Grotto, ${week}`,
    text: `Hi ${name}, thank you for helping. Your shifts for ${week}:\n${lines.join('\n')}\n` +
      `If you cannot make one, please let us know as soon as you can.`,
  }),
  runningLate: () => ({
    subject: 'Santa is running a little late',
    text: 'Santa is running about 10 minutes behind today. There is no need to rush, we will be ready for you.',
  }),
};

export type TemplateName = keyof typeof templates;
