# Santa's Inclusive Grotto

Website, booking system, admin and elf app for Santa's Inclusive Grotto, Leicester.
Stack: Next.js 16 (App Router, TypeScript), Neon (Postgres and Neon Auth for staff sign-in, Frankfurt
region), SendGrid for email, Twilio for text and WhatsApp, hosted on Vercel.

## What is built so far (phase 1: foundations)

**Database and booking engine** (`db/migrations/20261012000000_init.sql`)

- Season settings, opening hours per day, breaks, and bookable times generated from them.
  `regenerate_slots(day)` refuses to remove or block a time a family is booked into.
- `create_booking` (server only): one visit per family (matched on email or mobile), no double booking
  of a time (the time is locked while booking, and a time held for a waitlist family counts as taken),
  times that have started cannot be booked, UK mobiles only, flagged contacts held for review,
  duplicate checks recorded.
- Waitlist: cancelling offers the time to the first matching family, offers made overnight are held
  from 08:00, an offer always ends 15 minutes before the visit, unclaimed offers pass to the next family,
  claiming is one tap. The waitlist form must ask for data consent (`data_consent`).
- `confirm_attendance`: the tap-to-confirm link in the message sent 2 days before.
- Checks: likely duplicates (same email, mobile, address, similar visitor name, postcode area) and flags.
- Toy stock: orders from Amazon and Alibaba, elves check in deliveries (short deliveries are marked),
  elves record gifts handed over, live stock levels.
- Volunteers, shifts and rota assignments. Messages log. Photos with the family's consent recorded.
  Sponsorships.
- Row level security: the public can only see the time picker, use the cancel, claim and confirm links,
  and add form entries. Booking goes through the server, after a Vercel BotID check and a rate
  limit. Signed-in users can only run the functions their role needs. Elves see visitors but not health
  details, contact details or the private booking links. Health details are in a separate table only the
  admin and lead elf can read. Santa only sees `santa_cards` (name, age, how to say hello, loves,
  dislikes, how to meet).
- `purge_season(year)` deletes visitor and health details, family contact details, every message sent,
  the waitlist, flags, group enquiries and used early alerts. Booking rows stay without personal details,
  for the numbers. Volunteers and sponsorships are kept (they have their own retention).

**Server code** (`src/`)

- `lib/db.ts`: how the app talks to the database. `db()` is the server's own connection (scheduled jobs,
  the booking form, messages). `asPublic()` and `asStaff()` run queries in a transaction as the `anon` or
  `authenticated` role, with the staff member's Neon Auth user id in `request.jwt.claims`, so the row
  level security and function permissions in the migration apply.
- `lib/auth/server.ts` and `app/api/auth/[...path]`: staff sign-in with Neon Auth (email and password).
  Families never sign in. Sign-up is turned off.
- `app/book/actions.ts`: validates the booking form, checks BotID and the rate limit, calls the
  database, and sends the confirmation (or a "we have your request" message if it is held for review).
  If the family already has a visit, it sends the existing link to their own email or phone only. The
  form gets the same answer in every one of these cases ("we have sent the details to you"), so it never
  reveals whether someone has booked: the confirmation page should say to check email or texts.
- `lib/notify`: every message template in one place, sending by email, text and WhatsApp, each
  attempt logged.
- `app/api/cron/waitlist`: every 5 minutes, expires offers and messages new ones once their hold
  starts. A failed message is retried, up to 6 attempts.
- `app/api/cron/reminders`: daily, a reminder 5 to 7 days before, a tap-to-confirm 1 to 2 days before,
  and a nudge if the visitor details are missing. A missed run or failed message is caught up next day.

Tested: `npm run test:db` runs the migration on PGlite (Postgres in WebAssembly), switching roles the
way `lib/db.ts` does, and checks bookings, the waitlist (including that a held time cannot be booked twice), permissions for the
public, signed-in users, elves and Santa, rate limits, stock and the season purge. `npm test` runs the
slot rule and phone number tests, and `npm run typecheck` is clean.

## Phase 2: public pages

All pages are built for accessibility: Atkinson Hyperlegible type, large text and targets, strong focus outlines,
labelled fields with an error summary that links to each problem, no animation, a dark version, and they work at
phone width. Copy is in plain English; check it with your adviser before booking opens.

- `/`: homepage. Shows "Book a visit" when booking is open, otherwise "Get an alert".
- `/book` → `/book/details` → `/book/sent`: choose a day and time, say who is coming, then "check your messages".
  The same answer is shown whether or not the family had already booked.
- `/booking/[token]`: the family's own page from the link in their messages: see the visit, tell Santa about each
  visitor (all optional; health details are kept separately), change time, cancel, and confirm they are coming.
- `/claim/[token]`: claim a waitlist offer. Confirming and claiming are buttons, never just opening a link, as email
  scanners open links by themselves.
- `/waitlist`, `/alerts`, `/groups`, `/volunteer`, `/support` (sponsorship requests; payment is phase 3), `/privacy`.
- Every public form has a Vercel BotID check and a rate limit. BotID is invisible: visitors never see a challenge,
  which matters for people using screen readers or switch access. A page with a form must be listed in
  `src/instrumentation-client.ts`, or the check fails. Locally, BotID always says "not a bot".
- Database functions for these pages are in `db/migrations/20261013000000_public_pages.sql`.

## Setting up

1. **Neon**: the project is "Santas Inclusive Frankfurt" (`orange-surf-93156790`, AWS Frankfurt), linked in
   `.neon`, with services declared in `neon.ts`. The migration, `db/seed.sql` and
   `regenerate_season(2026)` have been run on the `main` branch. Set `booking_open` to true in `seasons`
   when you are ready. Locally, `neon env pull` writes the connection details to `.env.local`; add
   `NEON_AUTH_COOKIE_SECRET` there yourself (`openssl rand -base64 32`).
   To try changes safely, `neon checkout <branch-name>` makes an isolated copy of the database.
   **Migrations**: new files go in `db/migrations`. `npm run db:migrate` applies any not yet applied to the
   branch in `.env.local`, recording them in `schema_migrations`. Apply them to `main` before merging code that
   needs them.
2. **Staff sign-in**: sign-up and Google sign-in are turned off in Neon Auth. Create each staff account
   with `neon neon-auth user create --email <email> --name "<name>"`, then add them to `staff` with
   their role (`admin`, `lead_elf`, `elf` or `santa`):
   `insert into staff (user_id, name, role) select id, name, 'admin' from neon_auth."user" where email = '<email>';`
   Before going live: add your domain (`neon neon-auth domain add https://<your-domain>`), turn off
   localhost (`neon neon-auth domain allow-localhost disable`), and set a custom email provider for
   password resets (`neon neon-auth config email-provider update ...`).
3. **Vercel** (Pro plan, live at https://santasinclusive.vercel.app): import the repo, add the variables
   from `.env.example`. Server code runs in Frankfurt (`regions` in `vercel.json`), next to the database,
   so personal data stays in the EU. That address is a trusted domain in Neon Auth; add any new domain
   with `neon neon-auth domain add`. The waitlist job runs every 5 minutes, which needs a Vercel Pro plan (the
   free plan only runs scheduled jobs once a day). Alternatively call the route from Neon's `pg_cron`.
4. **Vercel BotID** (bot check on the public forms): nothing to set up for the free basic check. For the stronger
   check, turn on Vercel BotID Deep Analysis in the project's Firewall → Rules (Pro plan, $1 per 1,000 checks;
   one check per form sent). To test on the live site, send a form from a real browser: tools like `curl` are
   refused, as they should be.
5. **SendGrid**: authenticate your sending domain (SPF and DKIM) so emails do not land in spam.
6. **Twilio**: buy a UK number for texts. In Messaging > Settings > Geo permissions, allow the United
   Kingdom only. **Start WhatsApp now**: it needs Meta business
   verification and each message that starts a conversation must use a template Meta has approved.
   This can take days or weeks, so apply early. Texts and email work without it.

## Before going live

- Register with the ICO (data protection fee) and publish a privacy notice that names
  Liquid New Media Limited as the data controller.
- Complete a short data protection impact assessment, since the system holds health information
  about children and adults.
- Agree retention: run `purge_season(2026)` in January, and delete family-only photo files
  (the purge removes their rows but not the files).
- Check the copy on every public page, especially the homepage, `/privacy` and the answer lists in
  `src/lib/options.ts`.
- Data is hosted in the EU (Frankfurt), which UK GDPR allows without extra safeguards: say "stored in the
  EU" in the privacy notice and the data protection impact assessment.
- Photos (phase 4) are planned for Neon file storage (`neon buckets`), in the same Frankfurt project. It
  is an early-access service, so check it is available to the account before building on it.
- Check the eligibility, consent and photo wording with your adviser.

## Next phases

3. Admin: bookings (approving a booking held for review sends the confirmation; booking links are read
   through the server), checks, visit times, toy stock, rota, then dashboard, waitlist, volunteers,
   sponsorship (Stripe Checkout), press releases.
4. Elf app: next up, today, gifts, deliveries, rota, photos, Santa's view.
