/**
 * Answer lists for the "about your visitor" questions. Families can also write anything in their own words.
 * Check this wording with your adviser before booking opens (see README).
 */
export const communicationOptions = [
  'Does not use speech', 'Uses some words or short phrases', 'Uses Makaton or signs', 'Uses British Sign Language',
  'Uses a communication device or app', 'Uses pictures or symbols', 'Needs extra time to answer',
];
export const mobilityOptions = [
  'Uses a wheelchair', 'Uses a walking frame or sticks', 'Needs step-free access', 'Needs to sit down often',
  'Needs a hoist or changing places toilet', 'Needs space to move around',
];
export const sensoryOptions = [
  'Sensitive to noise', 'Sensitive to bright or flashing lights', 'Does not like being touched', 'Likes deep pressure or hugs',
  'Blind or partially sighted', 'Deaf or hard of hearing', 'Finds crowds or waiting hard',
];
export const meetOptions = [
  'Sitting next to Santa', 'Santa sitting a little way away', 'Santa coming over to them', 'Waving from a distance',
  'Whatever feels right on the day',
];

/** Weeks of December for school and group visits */
export const groupWeeks = ['1 to 6 December', '7 to 13 December', '14 to 20 December', '21 to 24 December'];

export const photoChoices = [
  { value: 'share', label: 'Yes, you can take photos, and you may share them (for example on our website)' },
  { value: 'family_only', label: 'Yes, you can take photos for our family only' },
  { value: 'none', label: 'No photos, thank you' },
] as const;

export const channelChoices = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text message' },
  { value: 'whatsapp', label: 'WhatsApp' },
] as const;
