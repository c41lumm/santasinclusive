# Santa's Inclusive Grotto

Website, booking system, admin and elf app for Santa's Inclusive Grotto, Leicester.
Stack: Next.js 16 (App Router, TypeScript), Neon (Postgres and Neon Auth for staff sign-in, London
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
  and add form entries. Booking goes through the server, after a Cloudflare Turnstile check and a rate
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
- `app/book/actions.ts`: validates the booking form, checks Turnstile and the rate limit, calls the
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

## Setting up

1. **Neon**: the project is "Santas Inclusive London" (`snowy-salad-03576920`, AWS London), linked in
   `.neon`, with services declared in `neon.ts`. The migration, `db/seed.sql` and
   `regenerate_season(2026)` have been run on the `main` branch. Set `booking_open` to true in `seasons`
   when you are ready. Locally, `neon env pull` writes the connection details to `.env.local`; add
   `NEON_AUTH_COOKIE_SECRET` there yourself (`openssl rand -base64 32`).
   To try changes safely, `neon checkout <branch-name>` makes an isolated copy of the database.
2. **Staff sign-in**: sign-up and Google sign-in are turned off in Neon Auth. Create each staff account
   with `neon neon-auth user create --email <email> --name "<name>"`, then add them to `staff` with
   their role (`admin`, `lead_elf`, `elf` or `santa`):
   `insert into staff (user_id, name, role) select id, name, 'admin' from neon_auth."user" where email = '<email>';`
   Before going live: add your domain (`neon neon-auth domain add https://<your-domain>`), turn off
   localhost (`neon neon-auth domain allow-localhost disable`), and set a custom email provider for
   password resets (`neon neon-auth config email-provider update ...`).
3. **Vercel**: import the repo, add the variables from `.env.example` (Vercel's Neon integration can
   add the database ones). The waitlist job runs every 5 minutes, which needs a Vercel Pro plan (the
   free plan only runs scheduled jobs once a day). Alternatively call the route from Neon's `pg_cron`.
4. **Cloudflare Turnstile** (free): add a widget for your domain and put the site key and secret key in
   the environment variables. The booking form must show the widget and pass its token to
   `createBooking`. Without the secret key, the check is skipped in development and refused on the live site.
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
- Photos (phase 4) need a file store in the UK. Neon's file storage is not offered in London yet, so
  choose a UK store (for example AWS S3 in eu-west-2) or wait for Neon to add London.
- Check the eligibility, consent and photo wording with your adviser.

## Next phases

2. Public pages from the designs (including `/booking/[token]/confirm`, which calls `confirm_attendance`,
   and Turnstile on the booking form): homepage, booking flow with time picker, visitor form, confirmation,
   manage booking, waitlist claim, early alerts, schools and groups, support, volunteer.
3. Admin: bookings (approving a booking held for review sends the confirmation; booking links are read
   through the server), checks, visit times, toy stock, rota, then dashboard, waitlist, volunteers,
   sponsorship (Stripe Checkout), press releases.
4. Elf app: next up, today, gifts, deliveries, rota, photos, Santa's view.
