/** Every message the system sends, in one place so wording stays consistent. */
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? '';
const manage = (token: string) => `${site()}/booking/${token}`;
const directions = 'https://www.google.com/maps/dir/?api=1&destination=20+Freeschool+Ln+Leicester+LE1+4FY';

export type Visit = { name: string; when: string; token: string; reference: string };

export const templates = {
  confirmation: (v: Visit) => ({
    subject: `You're booked in to see Santa, ${v.when}`,
    text: `You're booked in! Santa can't wait to meet ${v.name} on ${v.when}. Your reference is ${v.reference}. ` +
      `Change or cancel any time: ${manage(v.token)}`,
  }),
  reminder7d: (v: Visit) => ({
    subject: `See you next week, ${v.when}`,
    text: `A reminder that ${v.name}'s visit to Santa is on ${v.when}. Directions: ${directions}. ` +
      `Can't make it? Tap to change: ${manage(v.token)}`,
  }),
  confirm48h: (v: Visit) => ({
    subject: `Please confirm ${v.name}'s visit`,
    text: `Can you confirm ${v.name}'s visit on ${v.when}? Reply YES to confirm, or tap to change your booking: ${manage(v.token)}`,
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
  waitlistOffer: (when: string, claimToken: string, until: string) => ({
    subject: 'A visit to Santa has opened up',
    text: `Good news from Santa's Inclusive Grotto. A visit has opened on ${when}. It is held for you until ${until}. ` +
      `Tap to claim it: ${site()}/claim/${claimToken}`,
  }),
  runningLate: () => ({
    subject: 'Santa is running a little late',
    text: 'Santa is running about 10 minutes behind today. There is no need to rush, we will be ready for you.',
  }),
};

export type TemplateName = keyof typeof templates;
