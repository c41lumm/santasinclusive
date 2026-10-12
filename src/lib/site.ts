/**
 * Details the designs leave as placeholders ([OPENING TIMES], [CONTACT EMAIL] and so on). Fill them in here.
 * Anything left empty is simply not shown on the site, so no placeholder text ever appears to families.
 * Opening times are not here: they come from the opening hours in the database.
 */
export const site = {
  name: "Santa's Inclusive Grotto",
  address: '20 Freeschool Lane, Leicester LE1 4FY',
  shortAddress: '20 Freeschool Lane',
  directions: 'https://www.google.com/maps/dir/?api=1&destination=20+Freeschool+Ln+Leicester+LE1+4FY',
  /** Freeschool Lane, Leicester (52.6361, -1.1383) */
  map: {
    embed: 'https://www.openstreetmap.org/export/embed.html?bbox=-1.1433%2C52.6339%2C-1.1333%2C52.6383&layer=mapnik&marker=52.63607%2C-1.13830',
    link: 'https://www.openstreetmap.org/?mlat=52.63607&mlon=-1.13830#map=18/52.63607/-1.13830',
  },
  instagram: { handle: '@santa_inclusive', url: 'https://www.instagram.com/santa_inclusive/' },
  company: 'Liquid New Media Limited',

  /** Public contact email, shown on the site and used for replies to our emails */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'elf@santasinclusivegrotto.co.uk',
  /** For example "Company number 12345678" */
  companyNumber: '',

  /** Access at the venue, shown under "Finding us". For example 'Step-free entrance and lift'. */
  access: [] as string[],

  /** Schools and groups */
  groupSessions: '',        // for example 'Weekday mornings from 1 to 18 December'
  maxGroupSize: '',         // for example '30 children'
  groupVenueNotes: [] as string[], // coach drop-off, parking, step-free access

  /** Volunteering */
  shiftTimes: '',           // for example 'Shifts are about four hours, morning or afternoon'
  volunteerChecks: '',      // for example 'All volunteers complete an enhanced DBS check, give references and attend a short briefing before their first shift.'

  /** Sponsorship: price per gift in pounds (the design shows £15, to be confirmed by the grotto) */
  giftPricePounds: 15,
};
