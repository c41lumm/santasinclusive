# Santa's Inclusive Grotto

Website, booking system, admin and elf app for Santa's Inclusive Grotto, Leicester.
Stack: Next.js 16 (App Router, TypeScript), Neon (Postgres and Neon Auth for staff sign-in, Frankfurt
region), Resend for email, Twilio for texts, hosted on Vercel.

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
- `lib/notify`: every message template in one place, sending by email and text (WhatsApp is built in but switched off), each
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

Built to the approved designs in `design-handoff/` (see its `DESIGN.md`): Fredoka headings, Atkinson Hyperlegible
body text, Grotto Green and Santa Red, rounded cards and pill buttons. Images are in `public/images` with readable
names. The designs' accessibility rules are kept: real buttons and labels, 44px+ targets, strong contrast, no
animation, and every page works at phone width.

- `/`: homepage (HomeV2). Booking starts here: choose a day, then a time. When booking is closed, the picker is
  replaced by "Booking opens soon" and the "Be first to know" alert form.
- `/book/details` → `/book/sent`: who is coming and how to keep in touch, then "check your email/texts". There is
  no design for this step, so it follows the ChildForm layout. The same answer is shown whether or not the family
  had already booked, so the site never reveals who has booked.
- `/booking/[token]`: the family's own page from the link in their messages, using the **Confirmation** design
  ("You're booked in!", One last thing, Your reminders, Plans changed?, On the day). Showing it straight after booking,
  as the design does, would reveal whether a family had already booked; this way it is only shown from their own link.
  Add to calendar (`/booking/[token]/calendar`), change time, cancel, and "Are you still coming?" near the date.
- `/booking/[token]/about`: the **ChildForm** design, in four parts. "Save and finish" needs age, loves and dislikes
  for each person visiting Santa; "Save and come back later" saves whatever is there. Both need the consent for
  health and disability information.
- `/waitlist`, `/claim/[token]` (claim, or "No thanks, keep me on the list") and `/waitlist/leave/[token]`.
  Claiming goes straight to the About form. Confirming, claiming, declining and leaving are buttons, never just
  opening a link, as email scanners open links by themselves.
- `/groups`, `/volunteer` (Santa or Elf), `/support` (gift sponsorship; payment by card link or invoice, Stripe is
  phase 3), `/alerts`, `/privacy`, `/accessibility`.
- Every public form has a Vercel BotID check and a rate limit. BotID is invisible: visitors never see a challenge,
  which matters for people using screen readers or switch access. A page with a form must be listed in
  `src/instrumentation-client.ts`, or the check fails. Locally, BotID always says "not a bot".
- **Placeholders in the designs** (contact email, company number, access details, group sessions, shift times,
  volunteer checks, price per gift) are set in `src/lib/site.ts`. Anything left empty is not shown. Opening times come
  from the database. The contact email is elf@santasinclusivegrotto.co.uk.
- Database: `db/migrations/20261013000000_public_pages.sql` and `20261014000000_design_updates.sql` (decline an
  offer and stay on the list, leave the list, volunteer questions, opening hours, calendar times).

## Phase 3: admin area

`/admin`, for admins and lead elves, signed in at `/staff/sign-in` (password reset at `/staff/reset`; there is no
sign-up). Built to the admin designs (AdminBookings, AdminChecks, AdminSlots, AdminToys, AdminRota); the other pages
have no design and follow the same style.

- **Dashboard**: the season at a glance, what needs doing, and the next open days.
- **Bookings**: each day's visits with everyone's needs, message one family or the whole day, mark arrived, move,
  cancel (the time is offered to the waitlist), confirm a booking held for review, and add a booking for a family
  who phones.
- **Checks** (admin): possible duplicates and flags, with notes.
- **Visit times** (admin): visit length, gap, families per time, each day's hours and breaks, and opening or
  closing booking. Saving is refused if it would remove a time families are booked into.
- **Group enquiries** (admin): schools and groups from the `/groups` form, with their numbers, weeks, times and needs.
  Reply by email or phone, add the visit on Bookings, then mark it offered, booked or declined.
- **Waitlist**, **Early alerts** (send "booking is open" once to everyone who asked), **Messages** (every email and
  text, with the reason any failed), **Volunteers** (approve or decline; approved people appear on the rota) and
  **Sponsorship** (mark invoiced or paid): admin only.
- **Toy stock**: gifts needed by age, stock in and on the way, and deliveries.
- **Staff rota**: a morning and an afternoon shift for every open day, filled from volunteers' availability, and
  "Send this week's rota" to each person.
- Lead elves see Dashboard, Bookings, Toy stock and Staff rota. The database enforces the same rules (row level
  security), not only the menu.
- Database: `db/migrations/20261015000000_admin.sql`.
- **Locally**: messages are not sent unless `SEND_IN_DEV=1` is in `.env.local` (they are logged on the Messages page as
  "Not sent"). To use the admin area without signing in, set `DEV_STAFF_USER_ID` to the `user_id` of a row in
  `staff`. Both only work in `npm run dev`; the live site ignores them.

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
5. **Resend** (email): connect Resend in Vercel (it adds `RESEND_API_KEY`), add and verify your domain in Resend
   (choose the EU region, then add the DNS records it gives you), and set `EMAIL_FROM` in Vercel to an address on
   that domain, for example `Santa's Inclusive Grotto <hello@yourdomain.co.uk>`. Replies go to the contact
   email, elf@santasinclusivegrotto.co.uk (`src/lib/site.ts`). The free plan covers 3,000 emails a month and 100 a day.
   Check it locally with `npm run test:email -- you@example.com` (needs the same two values in `.env.local`).
6. **Twilio** (texts): in Vercel set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_SMS_FROM`. The simplest
   sender in the UK is a name such as `SantaGrotto` (up to 11 characters; families cannot reply, and do not need to).
   In Messaging > Settings > Geo permissions, allow the United Kingdom only.
   **WhatsApp is switched off for now.** To turn it on: get Meta business verification and approved message
   templates through Twilio (this can take weeks), send them through Twilio's templates in `src/lib/notify/send.ts`,
   then add `'whatsapp'` back to `channels` in `src/lib/booking-schema.ts` and `channelChoices` in `src/lib/options.ts`.

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

- Later in phase 3: Stripe Checkout for sponsorship, and press releases.
4. Elf app: next up, today, gifts, deliveries, rota, photos, Santa's view.
