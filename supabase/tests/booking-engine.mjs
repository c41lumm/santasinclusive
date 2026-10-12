import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync } from 'node:fs';

// Runs the migration on PGlite (Postgres in WebAssembly) with Supabase's roles and default grants, then checks
// bookings, the waitlist, permissions and the season purge. Usage: npm run test:db
const root = process.argv[2] ?? new URL('../..', import.meta.url).pathname;
const db = new PGlite({ extensions: { pgcrypto, citext, pg_trgm } });

// Stand-in for Supabase: roles, auth schema, and Supabase's default grants on the public schema
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role authenticator login noinherit; grant anon, authenticated, service_role to authenticator;
create schema auth; create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('app.role', true), '') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);
await db.exec(readFileSync(`${root}/supabase/migrations/20261012000000_init.sql`, 'utf8'));
await db.exec(readFileSync(`${root}/supabase/seed.sql`, 'utf8'));

let pass = 0, failN = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : failN++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };

/** Run as the SQL editor (postgres), or as an API caller with a Supabase role */
async function as(role, uid = '') {
  await db.exec(`set session authorization postgres; reset role; select set_config('app.role','',false), set_config('app.uid','',false);`);
  if (role === 'editor') return;
  await db.exec(`set session authorization authenticator; set role ${role};
    select set_config('app.role','${role}',false), set_config('app.uid','${uid}',false);`);
}
async function q(sql, params) { return (await db.query(sql, params)).rows; }
async function err(sql, params) { try { await db.query(sql, params); return null; } catch (e) { return e.message; } }

const slot = async (day, t) => (await q(`select id from slots where day=$1 and starts_at=$2`, [day, t]))[0].id;
const booking = (slotId, email, phone, extra = {}) => JSON.stringify({
  slot_id: slotId, eligibility_confirmed: true, data_consent: true, contact_name: 'Test', email, phone,
  channels: ['email'], visitors: [{ kind: 'visitor', first_name: 'Sam', loves: 'Trains', dislikes: 'Noise' }], ...extra });

// 4. The README setup step works from the SQL editor
await as('editor');
ok('regenerate_season runs from the SQL editor', (await err(`select regenerate_season(2026)`)) === null);
await db.exec(`update seasons set booking_open = true`);
ok('a signed-in non-staff user cannot regenerate', (await (async () => { await as('authenticated', '00000000-0000-0000-0000-000000000001'); return err(`select regenerate_season(2026)`); })())?.includes('NOT_ALLOWED'));

// 1. Function permissions
for (const role of ['anon', 'authenticated']) {
  await as(role, role === 'authenticated' ? '00000000-0000-0000-0000-000000000001' : '');
  for (const fn of [`find_existing_booking('a@b.com', null)`, `offer_next_waitlist(gen_random_uuid())`,
    `find_duplicates_for(gen_random_uuid())`, `create_booking('{}'::jsonb)`, `rate_limit_ok('x',1,1)`, `slot_taken(gen_random_uuid())`]) {
    const e = await err(`select ${fn}`);
    ok(`${role} cannot run ${fn.split('(')[0]}`, e?.includes('permission denied'), e ?? 'ran');
  }
  ok(`${role} can see the time picker`, (await q(`select * from available_slots('2026-12-12')`)).length === 18);
  ok(`${role} cannot read santa_cards rows`, role === 'anon'
    ? (await err(`select * from santa_cards`))?.includes('permission denied')
    : (await q(`select * from santa_cards`)).length === 0);
}

// Bookings (server only)
await as('service_role');
const s1000 = await slot('2026-12-12', '10:00'), s1020 = await slot('2026-12-12', '10:20'), s1100 = await slot('2026-12-12', '11:00');
const b1 = (await q(`select * from create_booking($1::jsonb)`, [booking(s1000, 'kate@example.com', '+447700900123')]))[0];
ok('server can book', b1?.status === 'confirmed');

// 3. UK mobiles only
let e = await err(`select * from create_booking($1::jsonb)`, [booking(s1020, 'us@example.com', '+1 202 555 0100')]);
ok('non-UK number refused when booking', e === 'INVALID_PHONE', e);
await as('anon');
e = await err(`insert into waitlist_entries (day,contact_name,phone,eligibility_confirmed,data_consent) values ('2026-12-12','X','+12025550100',true,true)`);
ok('non-UK number refused on the waitlist', e?.includes('check constraint'), e);
e = await err(`insert into waitlist_entries (day,contact_name,phone,eligibility_confirmed,data_consent) values ('2026-12-12','X','07700900777',true,false)`);
ok('waitlist needs consent', e?.includes('check constraint'), e);

// 5. Same answer for a full time whether or not the family has booked
await as('service_role');
e = await err(`select * from create_booking($1::jsonb)`, [booking(s1000, 'kate@example.com', null)]);
ok('existing family on a full time gets SLOT_FULL', e === 'SLOT_FULL', e);
e = await err(`select * from create_booking($1::jsonb)`, [booking(s1020, 'kate@example.com', null)]);
ok('existing family on a free time gets ALREADY_BOOKED', e === 'ALREADY_BOOKED', e);

// 2. Waitlist offer holds the place
await as('anon');
await db.exec(`insert into waitlist_entries (day,time_pref,contact_name,phone,eligibility_confirmed,data_consent) values ('2026-12-12','morning','Wait Family','07700 900777',true,true)`);
const offered = (await q(`select cancel_booking($1) as id`, [b1.manage_token]))[0].id;
ok('cancelling offers the time to the waitlist', offered !== null);
await as('editor');
const w = (await q(`select * from waitlist_entries where id=$1`, [offered]))[0];
ok('offer has a start time', w.offer_starts_at !== null);
await as('anon');
ok('offered time shows as full in the time picker', (await q(`select state from available_slots('2026-12-12') where slot_id=$1`, [s1000]))[0].state === 'full');
await as('service_role');
e = await err(`select * from create_booking($1::jsonb)`, [booking(s1000, 'new@example.com', null)]);
ok('a member of the public cannot book an offered time', e === 'SLOT_FULL', e);
// Admin fills the time another way: the claim must now be refused
await as('editor');
const hh = (await q(`insert into households (contact_name,email) values ('Admin add','admin-add@example.com') returning id`))[0].id;
const extra = (await q(`insert into bookings (season,slot_id,household_id,eligibility_confirmed,data_consent_at) values (2026,$1,$2,true,now()) returning id`, [s1000, hh]))[0].id;
await as('anon');
e = await err(`select * from claim_waitlist_offer($1)`, [w.offer_token]);
ok('claim refused when the time was filled another way', e === 'SLOT_FULL', e);
await as('editor');
await db.query(`delete from bookings where id=$1`, [extra]);
await as('anon');
const claimed = (await q(`select * from claim_waitlist_offer($1)`, [w.offer_token]))[0];
ok('waitlist family can claim the held time', !!claimed?.reference);
await as('editor');
const cb = (await q(`select b.data_consent_at, w.created_at from bookings b, waitlist_entries w where b.reference=$1 and w.id=$2`, [claimed.reference, offered]))[0];
ok('claimed booking records the real consent time', +cb.data_consent_at === +cb.created_at);
ok('time now has exactly one booking', (await q(`select count(*)::int n from bookings where slot_id=$1 and status in ('confirmed','pending_review')`, [s1000]))[0].n === 1);

// Past times
await as('editor');
await db.exec(`insert into opening_days (day) values (current_date) on conflict do nothing;
  insert into slots (day, starts_at, ends_at, capacity) values (current_date, '00:00', '00:15', 1)`);
const past = (await q(`select id from slots where day=current_date and starts_at='00:00'`))[0].id;
await as('service_role');
e = await err(`select * from create_booking($1::jsonb)`, [booking(past, 'past@example.com', null)]);
ok('a time that has started cannot be booked', e === 'SLOT_UNAVAILABLE', e);
await as('anon');
ok('started times are left out of the time picker', (await q(`select * from available_slots(current_date)`)).length === 0);

// Flagged contact and tap-to-confirm
await as('editor');
await db.exec(`insert into flags (email,label,reason,note,review_by) values ('flag@example.com','J','eligibility_concern','Said no one has additional needs','2026-12-31')`);
await as('service_role');
const fb = (await q(`select * from create_booking($1::jsonb)`, [booking(s1100, 'FLAG@example.com', null)]))[0];
ok('flagged contact is held for review', fb.status === 'pending_review');
await as('anon');
await q(`select confirm_attendance($1)`, [fb.manage_token]);
await as('editor');
ok('tap-to-confirm records the reply', (await q(`select reply from bookings where manage_token=$1`, [fb.manage_token]))[0].reply === 'confirmed');

// Elves cannot see booking links; Santa sees cards
await as('service_role');
await q(`select * from create_booking($1::jsonb)`, [booking(await slot('2026-12-13', '10:00'), 'cards@example.com', '07700900555')]);
await as('editor');
const [elf, santa] = (await q(`insert into auth.users select gen_random_uuid() from generate_series(1,2) returning id`)).map((r) => r.id);
await db.query(`insert into staff (user_id,name,role) values ($1,'Jess','elf'),($2,'Nick','santa')`, [elf, santa]);
await as('authenticated', elf);
e = await err(`select manage_token from bookings`);
ok('elves cannot read booking links', e?.includes('permission denied'), e);
ok('elves can read bookings', (await q(`select id, status from bookings`)).length > 0);
await as('authenticated', santa);
ok('Santa sees cards', (await q(`select * from santa_cards`)).length > 0);
ok('Santa cannot read bookings', (await q(`select id from bookings`)).length === 0);

// Rate limit
await as('service_role');
const hits = [];
for (let i = 0; i < 4; i++) hits.push((await q(`select rate_limit_ok('k', 3, 60) as ok`))[0].ok);
ok('rate limit allows 3 then refuses', JSON.stringify(hits) === '[true,true,true,false]', JSON.stringify(hits));

// Stock still works
await as('editor');
await db.exec(`insert into gifts (name,age_band,category) values ('Train','3-5','Building');
  insert into stock_orders (gift_id,supplier,qty_ordered) select id,'amazon',1 from gifts;`);
await as('authenticated', elf);
await q(`select check_in_delivery((select id from stock_orders), 1)`);
await q(`select give_gift((select id from gifts), null)`);
e = await err(`select give_gift((select id from gifts), null)`);
ok('stock cannot go below zero', e === 'OUT_OF_STOCK', e);

// Messages exist before purge, so the purge has something to remove
await as('editor');
await db.query(`insert into messages (booking_id, channel, template, recipient, body) select id, 'email', 'confirmation', 'kate@example.com', 'Sam' from bookings limit 1`);
await q(`select purge_season(2026)`);
const left = (await q(`select (select count(*) from visitors)::int v, (select count(*) from households)::int h,
  (select count(*) from messages)::int m, (select count(*) from waitlist_entries)::int w, (select count(*) from flags)::int f,
  (select count(*) from bookings)::int b`))[0];
ok('purge removes visitors, contacts, messages, waitlist and flags, keeps booking counts',
  left.v === 0 && left.h === 0 && left.m === 0 && left.w === 0 && left.f === 0 && left.b > 0, JSON.stringify(left));

console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
