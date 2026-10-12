-- Booking engine checks. Run against a local database after the migration and seed.sql.
-- Expected errors are part of the test: ALREADY_BOOKED, SLOT_FULL, SLOT_UNAVAILABLE, BOOKINGS_AFFECTED.
\set ON_ERROR_STOP 0
select set_config('app.role','service_role',false);
select regenerate_season(2026);
select count(*) filter (where not blocked) as open, count(*) filter (where blocked) as breaks from slots where day='2026-12-12';
update seasons set booking_open = true;
select starts_at, state from available_slots('2026-12-12') limit 3;

-- 1. booking
select * from create_booking(jsonb_build_object('slot_id',(select id from slots where day='2026-12-12' and starts_at='10:00'),
 'eligibility_confirmed',true,'data_consent',true,'contact_name','Kate K','email','kate@example.com','phone','07700 900123',
 'postcode','LE5 1AB','address_line','1 Holly Road','channels',jsonb_build_array('sms','email'),'photo_consent','share',
 'visitors',jsonb_build_array(jsonb_build_object('kind','visitor','first_name','Sam','age',6,'loves','Trains','dislikes','Noise','medical','None'),
   jsonb_build_object('kind','sibling','first_name','Ella','age',9,'sex','girl'))));
select details_complete, status from bookings;
-- 2. same mobile, different email -> blocked
select * from create_booking(jsonb_build_object('slot_id',(select id from slots where day='2026-12-14' and starts_at='10:00'),
 'eligibility_confirmed',true,'data_consent',true,'contact_name','Kate','email','other@example.com','phone','+44 7700 900123','visitors','[]'::jsonb));
-- 3. slot full
select * from create_booking(jsonb_build_object('slot_id',(select id from slots where day='2026-12-12' and starts_at='10:00'),
 'eligibility_confirmed',true,'data_consent',true,'contact_name','X','email','x@example.com','visitors','[]'::jsonb));
-- 4. blocked break slot
select * from create_booking(jsonb_build_object('slot_id',(select id from slots where day='2026-12-12' and starts_at='12:40'),
 'eligibility_confirmed',true,'data_consent',true,'contact_name','X','email','x@example.com','visitors','[]'::jsonb));
-- 5. likely duplicate: different contact, same address and similar name
select * from create_booking(jsonb_build_object('slot_id',(select id from slots where day='2026-12-18' and starts_at='10:20'),
 'eligibility_confirmed',true,'data_consent',true,'contact_name','Kate Kay','email','kk2@example.com','phone','07700 900999',
 'postcode','le51ab','address_line','1 Holly Rd','visitors',jsonb_build_array(jsonb_build_object('kind','visitor','first_name','Sammy','age',6))));
select reasons, score from duplicate_candidates;
-- 6. flagged contact -> pending review
insert into flags (email,label,reason,note,review_by) values ('flag@example.com','J. Carter','eligibility_concern','Said no one has additional needs','2026-12-31');
select status from create_booking(jsonb_build_object('slot_id',(select id from slots where day='2026-12-12' and starts_at='11:00'),
 'eligibility_confirmed',true,'data_consent',true,'contact_name','J','email','FLAG@example.com','visitors','[]'::jsonb));
-- 7. waitlist: join, cancel, offer, claim
insert into waitlist_entries (day,time_pref,contact_name,phone,eligibility_confirmed) values ('2026-12-12','morning','Wait Family','07700 900777',true);
select cancel_booking((select manage_token from bookings b join households h on h.id=b.household_id where h.email='kate@example.com')) is not null as offered;
select status, offer_expires_at is not null from waitlist_entries;
select reference is not null as claimed from claim_waitlist_offer((select offer_token from waitlist_entries));
select status from waitlist_entries;
-- 8. shorten a day with a booking at 10:00 -> refused
update opening_days set opens_at='11:00' where day='2026-12-12';
select regenerate_slots('2026-12-12');
update opening_days set opens_at='10:00' where day='2026-12-12';
-- 9. longer day adds times
update opening_days set closes_at='18:00' where day='2026-12-13';
select regenerate_slots('2026-12-13');
select count(*) filter (where not blocked) from slots where day='2026-12-13';
-- 10. stock
with u as (insert into auth.users default values returning id) insert into staff (user_id,name,role) select id,'Jess','elf' from u;
select set_config('app.uid',(select user_id::text from staff limit 1),false);
insert into gifts (name,age_band,category) values ('Wooden train set','3-5','Building');
insert into stock_orders (gift_id,supplier,qty_ordered) select id,'amazon',20 from gifts;
select check_in_delivery((select id from stock_orders),18);
select give_gift((select id from gifts),(select id from visitors where first_name='Sammy'));
select name, received, on_the_way, given, in_stock from stock_levels;
select status from stock_orders;
