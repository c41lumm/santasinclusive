/**
 * Answer lists for the "about your visitor" questions. Families can also write anything in their own words.
 * Wording from the approved designs (ChildForm, GroupBookings, Volunteer).
 */
export const communicationOptions = [
  'Speaks in sentences', 'Uses a few words', 'Uses a communication device or app', 'Uses sign language or Makaton',
  'Uses sounds, gestures or facial expressions', 'Communicates best with a parent or carer helping',
];
export const mobilityOptions = [
  'Walks independently', 'Needs help to walk', 'Uses a wheelchair', 'Needs a quiet space to change or rest',
  'Needs a hoist or changing table',
];
export const sensoryOptions = [
  'Sensitive to loud noise', 'Sensitive to bright or flashing lights', 'Does not like being touched', 'Sensitive to smells',
  'Needs ear defenders or headphones', 'Needs to move around or stim',
];
export const meetOptions = [
  "Sit on Santa's lap", 'Sit beside Santa', 'Say hello from a distance', 'Let us see how they feel on the day',
];

/** Weeks of December for school and group visits */
export const groupWeeks = ['1 to 4 December', '7 to 11 December', '14 to 18 December', 'Any of these'];
export const groupTimes = [
  { value: 'morning', label: 'Morning' }, { value: 'early_afternoon', label: 'Early afternoon' }, { value: 'any', label: 'No preference' },
] as const;
export const volunteerWeeks = ['1 to 7 December', '8 to 14 December', '15 to 21 December', '22 to 24 December'];
export const volunteerDayTypes = ['Weekdays', 'Weekends', 'Evenings'];

export const photoChoices = [
  { value: 'share', label: 'Photos of the visitor are fine to share by the grotto team' },
  { value: 'family_only', label: 'Photos for our family only' },
  { value: 'none', label: 'No photos please' },
] as const;

export const channelChoices = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text message' },
  { value: 'whatsapp', label: 'WhatsApp' },
] as const;
