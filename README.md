# Santa's Inclusive Grotto

Website, booking system, admin and elf app for Santa's Inclusive Grotto, Leicester.
Stack: Next.js (App Router, TypeScript), Supabase (Postgres, auth, storage), SendGrid for email,
Twilio for text and WhatsApp, hosted on Vercel.

## What is built so far (phase 1: foundations)

**Database and booking engine** (`supabase/migrations/20261012000000_init.sql`)

- Season settings, opening hours per day, breaks, and bookable times generated from them.
  `regenerate_slots(day)` refuses to remove or block a time a family is booked into.
- `create_booking`: one visit per family (matched on email or mobile), no double booking of a time
  (the time is locked while booking), flagged contacts held for review, duplicate checks recorded.
- Waitlist: cancelling offers the time to the first matching family, offers made overnight are held
  from 08:00, unclaimed offers pass to the next family, claiming is one tap.
- Checks: likely duplicates (same email, mobile, address, similar visitor name, postcode area) and flags.
- Toy stock: orders from Amazon and Alibaba, elves check in deliveries (short deliveries are marked),
  elves record gifts handed over, live stock levels.
- Volunteers, shifts and rota assignments. Messages log. Photos with the family's consent recorded.
  Sponsorships.
- Row level security: the public can only use the booking functions and add form entries. Elves see
  visitors but not health details or contact details. Health details are in a separate table only the
  admin and lead elf can read. Santa only sees `santa_cards` (name, age, how to say hello, loves,
  dislikes, how to meet).
- `purge_season(year)` deletes visitor and health details after the season.

**Server code** (`src/`)

- `app/book/actions.ts`: validates the booking form, calls the database, sends the confirmation,
  and if the family already has a visit, sends the existing link to their own email or phone only.
- `lib/notify`: every message template in one place, sending by email, text and WhatsApp, each
  attempt logged.
- `app/api/cron/waitlist`: every 5 minutes, expires offers and messages new ones.
- `app/api/cron/reminders`: daily, a reminder 7 days before, a please-confirm 2 days before, and a
  nudge if the visitor details are missing.

Tested: the migration runs cleanly on Postgres 16, `supabase/tests/booking_engine.sql` exercises
bookings, duplicates, flags, the waitlist, changing hours and stock, and the row level security was
checked for the public, Santa, elves and the lead elf. `npm test` runs the slot rule tests and
`npm run typecheck` is clean.

## Setting up

1. **Supabase**: create a project in the London region. In the SQL editor run the migration, then
   `supabase/seed.sql` (or use the Supabase CLI: `supabase db push`). Then run
   `select regenerate_season(2026);` and set `booking_open` to true in `seasons` when you are ready.
2. **First admin**: sign up in Supabase Auth, then insert yourself into `staff` with role `admin`.
3. **Vercel**: import the repo, add the variables from `.env.example`. The waitlist job runs every
   5 minutes, which needs a Vercel Pro plan (the free plan only runs scheduled jobs once a day).
   Alternatively call the route from Supabase `pg_cron`.
4. **SendGrid**: authenticate your sending domain (SPF and DKIM) so emails do not land in spam.
5. **Twilio**: buy a UK number for texts. **Start WhatsApp now**: it needs Meta business
   verification and each message that starts a conversation must use a template Meta has approved.
   This can take days or weeks, so apply early. Texts and email work without it.

## Before going live

- Register with the ICO (data protection fee) and publish a privacy notice that names
  Liquid New Media Limited as the data controller.
- Complete a short data protection impact assessment, since the system holds health information
  about children and adults.
- Agree retention: run `purge_season(2026)` in January.
- Check the eligibility, consent and photo wording with your adviser.

## Next phases

2. Public pages from the designs: homepage, booking flow with time picker, visitor form, confirmation,
   manage booking, waitlist claim, early alerts, schools and groups, support, volunteer.
3. Admin: bookings, checks, visit times, toy stock, rota, then dashboard, waitlist, volunteers,
   sponsorship (Stripe Checkout), press releases.
4. Elf app: next up, today, gifts, deliveries, rota, photos, Santa's view.
