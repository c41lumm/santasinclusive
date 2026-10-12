import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readdirSync, readFileSync } from 'node:fs';

// Runs the migration on PGlite (Postgres in WebAssembly), then checks
// bookings, the waitlist, permissions and the season purge. Requests switch role the way src/lib/db.ts does. Usage: npm run test:db
const root = process.argv[2] ?? new URL('../..', import.meta.url).pathname;
const db = new PGlite({ extensions: { pgcrypto, citext, pg_trgm } });

for (const f of readdirSync(`${root}/db/migrations`).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(`${root}/db/migrations/${f}`, 'utf8'));
}
await db.exec(readFileSync(`${root}/db/seed.sql`, 'utf8'));

let pass = 0, failN = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : failN++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };

/** Run as the server or SQL editor (owner, nothing set), or as a request role with claims, like src/lib/db.ts */
async function as(role, uid = '') {
  await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  if (role === 'editor' || role === 'server') return;
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(uid ? { role, sub: uid } : { role })]);
  await db.exec(`set role ${role}`);
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

// A request role without claims must not count as the server (a code path that forgets the claims)
await db.exec(`set role anon`);
ok('a switched role never counts as the server', (await q(`select is_server() as s`))[0].s === false);
await db.exec(`set role authenticated`);
ok('nor inside an owner-rights function', (await err(`select regenerate_season(2026)`))?.includes('NOT_ALLOWED'));
await as('editor');
ok('the owner with nothing set counts as the server', (await q(`select is_server() as s`))[0].s === true);

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
await as('server');
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
await as('server');
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
await as('server');
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
await as('server');
e = await err(`select * from create_booking($1::jsonb)`, [booking(past, 'past@example.com', null)]);
ok('a time that has started cannot be booked', e === 'SLOT_UNAVAILABLE', e);
await as('anon');
ok('started times are left out of the time picker', (await q(`select * from available_slots(current_date)`)).length === 0);

// Flagged contact and tap-to-confirm
await as('editor');
await db.exec(`insert into flags (email,label,reason,note,review_by) values ('flag@example.com','J','eligibility_concern','Said no one has additional needs','2026-12-31')`);
await as('server');
const fb = (await q(`select * from create_booking($1::jsonb)`, [booking(s1100, 'FLAG@example.com', null)]))[0];
ok('flagged contact is held for review', fb.status === 'pending_review');
await as('anon');
await q(`select confirm_attendance($1)`, [fb.manage_token]);
await as('editor');
ok('tap-to-confirm records the reply', (await q(`select reply from bookings where manage_token=$1`, [fb.manage_token]))[0].reply === 'confirmed');

// Elves cannot see booking links; Santa sees cards
await as('server');
await q(`select * from create_booking($1::jsonb)`, [booking(await slot('2026-12-13', '10:00'), 'cards@example.com', '07700900555')]);
await as('editor');
const [elf, santa] = [crypto.randomUUID(), crypto.randomUUID()];
await db.query(`insert into staff (user_id,name,role) values ($1,'Jess','elf'),($2,'Nick','santa')`, [elf, santa]);
await as('authenticated', elf);
e = await err(`select manage_token from bookings`);
ok('elves cannot read booking links', e?.includes('permission denied'), e);
ok('elves can read bookings', (await q(`select id, status from bookings`)).length > 0);
await as('authenticated', santa);
ok('Santa sees cards', (await q(`select * from santa_cards`)).length > 0);
ok('Santa cannot read bookings', (await q(`select id from bookings`)).length === 0);

// Rate limit
await as('server');
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

// Phase 2: public pages
await as('editor');
const [p1000, p1100, p1240] = [await slot('2026-12-15', '10:00'), await slot('2026-12-15', '11:00'), await slot('2026-12-15', '12:40')];
await as('anon');
const season = (await q(`select * from current_season()`))[0];
ok('current season is 2026', season?.year === 2026 && season.booking_open === true);
const days = await q(`select * from available_days(2026)`);
const december = days.filter((d) => new Date(d.day).getUTCMonth() === 11);
ok('24 December days in the date picker', december.length === 24, String(december.length));
ok('a day shows its free places', days.find((d) => new Date(d.day).toISOString().startsWith('2026-12-14'))?.spaces_left === 16);
await as('server');
const pb = (await q(`select * from create_booking($1::jsonb)`, [JSON.stringify({ slot_id: p1000,
  eligibility_confirmed: true, data_consent: true, contact_name: 'Pat', email: 'pat@example.com', channels: ['email'],
  photo_consent: 'share', visitors: [{ kind: 'visitor', first_name: 'Ada', medical: 'Epilepsy' }, { kind: 'sibling', first_name: 'Bo' }] })]))[0];
await as('anon');
let page = (await q(`select get_booking($1) as b`, [pb.manage_token]))[0].b;
ok('booking page shows the booking', page?.reference === pb.reference && page.visitors.length === 2 && page.starts_at === '10:00');
ok('booking page shows the health details the family gave', page.visitors.find((v) => v.first_name === 'Ada')?.medical === 'Epilepsy');
ok('booking page has no contact details', !JSON.stringify(page).includes('pat@example.com'));
ok('a wrong link shows nothing', (await q(`select get_booking(gen_random_uuid()) as b`))[0].b === null);
const ada = page.visitors.find((v) => v.first_name === 'Ada');
await as('editor');
await db.query(`update visitors set santa_hello = 'Hello Ada, I hear you love trains' where id = $1`, [ada.id]);
await as('anon');
await q(`select update_booking_details($1, $2::jsonb)`, [pb.manage_token, JSON.stringify({ photo_consent: 'none', visitors: [
  { id: ada.id, kind: 'visitor', first_name: 'Ada', loves: 'Trains', dislikes: 'Loud bangs', sensory: ['Sensitive to noise'] },
  { kind: 'sibling', first_name: 'Cy', age: 4 }] })]);
page = (await q(`select get_booking($1) as b`, [pb.manage_token]))[0].b;
ok('details saved, sibling swapped', page.visitors.map((v) => v.first_name).sort().join() === 'Ada,Cy' && page.details_complete === true);
ok('clearing health details removes them', page.visitors.find((v) => v.first_name === 'Ada').medical === null);
await as('editor');
ok('the lead elf\'s hello is kept', (await q(`select santa_hello from visitors where id = $1`, [ada.id]))[0].santa_hello?.startsWith('Hello Ada'));
ok('photo consent updated', (await q(`select distinct photo_consent from visitors v join bookings b on b.id = v.booking_id where b.reference = $1`, [pb.reference]))[0].photo_consent === 'none');
await as('anon');
e = await err(`select update_booking_details($1, $2::jsonb)`, [pb.manage_token, JSON.stringify({ visitors: [{ id: ada.id, kind: 'sibling', first_name: 'Ada' }] })]);
ok('a booking must keep someone visiting Santa', e === 'VISITOR_REQUIRED', e);
e = await err(`select update_booking_details($1, $2::jsonb)`, [pb.manage_token, JSON.stringify({ visitors: [{ id: crypto.randomUUID(), kind: 'visitor', first_name: 'X' }] })]);
ok('cannot edit someone else\'s visitor', e === 'NOT_FOUND', e);
// Move: the old time goes to the waitlist
await as('editor');
await db.exec(`insert into waitlist_entries (day,contact_name,phone,eligibility_confirmed,data_consent) values ('2026-12-15','Next Family','07700900888',true,true)`);
await as('anon');
await q(`select move_booking($1, $2)`, [pb.manage_token, p1100]);
page = (await q(`select get_booking($1) as b`, [pb.manage_token]))[0].b;
ok('booking moved to the new time', page.starts_at === '11:00');
await as('editor');
ok('old time offered to the waitlist', (await q(`select status from waitlist_entries where contact_name = 'Next Family'`))[0].status === 'offered');
await as('anon');
e = await err(`select move_booking($1, $2)`, [pb.manage_token, p1000]);
ok('cannot move to a time held for the waitlist', e === 'SLOT_FULL', e);
e = await err(`select move_booking($1, $2)`, [pb.manage_token, p1240]);
ok('cannot move to a break', e === 'SLOT_UNAVAILABLE', e);

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
