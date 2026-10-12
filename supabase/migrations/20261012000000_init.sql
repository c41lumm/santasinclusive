-- Santa's Inclusive Grotto: database and booking engine
-- Run on Supabase (Postgres 15+). Region: choose London (eu-west-2) for UK data.

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------
create type staff_role      as enum ('admin', 'lead_elf', 'elf', 'santa');
create type visit_type      as enum ('family', 'group');
create type booking_status  as enum ('pending_review', 'confirmed', 'cancelled', 'attended', 'no_show');
create type reply_status    as enum ('awaiting', 'confirmed', 'no_reply');
create type visit_stage     as enum ('waiting', 'arrived', 'with_santa', 'done');
create type channel         as enum ('email', 'sms', 'whatsapp');
create type photo_consent   as enum ('share', 'family_only', 'none');
create type visitor_kind    as enum ('visitor', 'sibling');
create type waitlist_status as enum ('waiting', 'offered', 'claimed', 'expired', 'removed');
create type flag_reason     as enum ('eligibility_concern', 'repeat_duplicates', 'other');
create type dup_status      as enum ('open', 'not_duplicate', 'cancelled_newer', 'contacting');

-- ---------------------------------------------------------------
-- Staff and roles
-- ---------------------------------------------------------------
create table staff (
  user_id    uuid primary key references auth.users on delete cascade,
  name       text not null,
  role       staff_role not null,
  phone      text,
  created_at timestamptz not null default now()
);

create function my_role() returns staff_role
language sql stable security definer set search_path = public as $$
  select role from staff where user_id = auth.uid()
$$;
create function is_admin() returns boolean language sql stable as $$ select coalesce(my_role() = 'admin', false) $$;
create function is_lead()  returns boolean language sql stable as $$ select coalesce(my_role() in ('admin', 'lead_elf'), false) $$;
create function is_staff() returns boolean language sql stable as $$ select my_role() is not null $$;
create function is_server() returns boolean language sql stable as $$ select coalesce(auth.role() = 'service_role', false) $$;

-- ---------------------------------------------------------------
-- Season, opening hours and slots
-- ---------------------------------------------------------------
create table seasons (
  year                  int primary key,
  first_day             date not null,
  last_day              date not null,
  visit_minutes         int  not null default 15 check (visit_minutes between 5 and 120),
  gap_minutes           int  not null default 5  check (gap_minutes between 0 and 60),
  families_per_slot     int  not null default 1  check (families_per_slot between 1 and 10),
  booking_open          boolean not null default false,
  siblings_get_gift     boolean not null default true,
  waitlist_hold_minutes int  not null default 120
);

create table opening_days (
  day       date primary key,
  opens_at  time not null default '10:00',
  closes_at time not null default '16:00',
  closed    boolean not null default false,
  check (closes_at > opens_at)
);

-- day null = applies to every day
create table blocked_times (
  id        uuid primary key default gen_random_uuid(),
  day       date,
  starts_at time not null,
  reason    text not null default 'Break',
  unique nulls not distinct (day, starts_at)
);

create table slots (
  id        uuid primary key default gen_random_uuid(),
  day       date not null references opening_days(day),
  starts_at time not null,
  ends_at   time not null,
  capacity  int  not null,
  blocked   boolean not null default false,
  unique (day, starts_at)
);

-- ---------------------------------------------------------------
-- Households, bookings and visitors
-- ---------------------------------------------------------------
create function norm_phone(p text) returns text language sql immutable as $$
  select case
    when p is null then null
    when regexp_replace(p, '\D', '', 'g') ~ '^0' then '44' || substr(regexp_replace(p, '\D', '', 'g'), 2)
    else regexp_replace(p, '\D', '', 'g') end
$$;
create function norm_postcode(p text) returns text language sql immutable as $$
  select nullif(upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')), '')
$$;

create table households (
  id           uuid primary key default gen_random_uuid(),
  contact_name text not null,
  email        citext,
  phone        text,
  phone_norm   text generated always as (norm_phone(phone)) stored,
  postcode     text,
  postcode_norm text generated always as (norm_postcode(postcode)) stored,
  address_line text,
  channels     channel[] not null default '{email}',
  created_at   timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index households_email_idx on households (email);
create index households_phone_idx on households (phone_norm);
create index households_postcode_idx on households (postcode_norm);

create table bookings (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique default ('SIG-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6))),
  manage_token     uuid not null unique default gen_random_uuid(),
  season           int  not null references seasons(year),
  slot_id          uuid not null references slots(id),
  household_id     uuid not null references households(id),
  type             visit_type not null default 'family',
  status           booking_status not null default 'confirmed',
  reply            reply_status not null default 'awaiting',
  stage            visit_stage not null default 'waiting',
  eligibility_confirmed boolean not null check (eligibility_confirmed),
  data_consent_at  timestamptz not null,
  details_complete boolean not null default false,
  group_name       text,
  group_staff      int,
  reminder_7d_at   timestamptz,
  reminder_48h_at  timestamptz,
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz
);
create index bookings_active_slot_idx on bookings (slot_id) where status in ('pending_review', 'confirmed');
-- One visit per family per season
create unique index one_active_booking_per_household
  on bookings (household_id, season)
  where status in ('pending_review', 'confirmed') and type = 'family';

create table visitors (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references bookings(id) on delete cascade,
  kind            visitor_kind not null,
  first_name      text not null,
  age             int check (age between 0 and 120),
  sex             text check (sex in ('boy', 'girl', 'prefer_not')),
  pronouns        text,
  communication   text[] not null default '{}',
  mobility        text[] not null default '{}',
  sensory         text[] not null default '{}',
  loves           text,
  dislikes        text,
  calming         text,
  meet_preference text,
  gift_ideas      text,
  santa_hello     text,  -- drafted from the form, checked by the lead elf
  photo_consent   photo_consent not null default 'none',
  created_at      timestamptz not null default now()
);
create index visitors_booking_idx on visitors (booking_id);
create index visitors_name_trgm on visitors using gin (first_name gin_trgm_ops);

-- Health details live apart so only admins and lead elves can read them
create table visitor_sensitive (
  visitor_id         uuid primary key references visitors(id) on delete cascade,
  condition          text,
  medical            text,
  other_requirements text
);

-- ---------------------------------------------------------------
-- Waitlist, early alerts, groups
-- ---------------------------------------------------------------
create table waitlist_entries (
  id               uuid primary key default gen_random_uuid(),
  day              date not null,
  time_pref        text not null default 'any' check (time_pref in ('any', 'morning', 'afternoon')),
  contact_name     text not null,
  email            citext,
  phone            text,
  channels         channel[] not null default '{sms}',
  eligibility_confirmed boolean not null check (eligibility_confirmed),
  status           waitlist_status not null default 'waiting',
  offer_slot_id    uuid references slots(id),
  offer_token      uuid unique,
  offer_expires_at timestamptz,
  created_at       timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index waitlist_waiting_idx on waitlist_entries (day, created_at) where status = 'waiting';

create table early_alerts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  contact    text not null,
  channels   channel[] not null default '{email}',
  is_group   boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create table group_enquiries (
  id           uuid primary key default gen_random_uuid(),
  organisation text not null,
  contact_name text not null,
  role         text,
  email        citext not null,
  phone        text not null,
  people       int  not null,
  staff        int  not null,
  age_range    text not null,
  weeks        text[] not null default '{}',
  time_pref    text[] not null default '{}',
  needs        text,
  status       text not null default 'new' check (status in ('new', 'offered', 'booked', 'declined')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Checks: duplicates and flags (admin only)
-- ---------------------------------------------------------------
create table duplicate_candidates (
  id         uuid primary key default gen_random_uuid(),
  booking_a  uuid not null references bookings(id) on delete cascade,
  booking_b  uuid not null references bookings(id) on delete cascade,
  reasons    text[] not null,
  score      int not null,
  status     dup_status not null default 'open',
  decided_by uuid references auth.users,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_a, booking_b),
  check (booking_a < booking_b)
);

create table flags (
  id         uuid primary key default gen_random_uuid(),
  email      citext,
  phone_norm text,
  label      text not null,
  reason     flag_reason not null,
  note       text not null,  -- what happened or was said, never a guess from appearance
  created_by uuid references auth.users,
  review_by  date not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  check (email is not null or phone_norm is not null)
);

-- ---------------------------------------------------------------
-- Toy stock
-- ---------------------------------------------------------------
create table gifts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  age_band   text not null check (age_band in ('0-2', '3-5', '6-8', '9-12', '13-17', '18+')),
  category   text not null,
  created_at timestamptz not null default now()
);

create table stock_orders (
  id           uuid primary key default gen_random_uuid(),
  gift_id      uuid not null references gifts(id),
  supplier     text not null check (supplier in ('amazon', 'alibaba', 'donated', 'other')),
  order_ref    text,
  qty_ordered  int  not null check (qty_ordered > 0),
  qty_received int  not null default 0 check (qty_received >= 0),
  status       text not null default 'on_the_way' check (status in ('on_the_way', 'received', 'short')),
  received_by  uuid references auth.users,
  received_at  timestamptz,
  created_by   uuid references auth.users,
  created_at   timestamptz not null default now()
);

create table gift_handouts (
  id         uuid primary key default gen_random_uuid(),
  gift_id    uuid not null references gifts(id),
  visitor_id uuid references visitors(id) on delete set null,
  given_by   uuid references auth.users,
  given_at   timestamptz not null default now()
);

create view stock_levels as
select g.id as gift_id, g.name, g.age_band, g.category,
       coalesce(o.received, 0) as received,
       coalesce(o.on_the_way, 0) as on_the_way,
       coalesce(h.given, 0) as given,
       coalesce(o.received, 0) - coalesce(h.given, 0) as in_stock
from gifts g
left join (select gift_id, sum(qty_received) as received,
                  sum(case when status = 'on_the_way' then qty_ordered - qty_received else 0 end) as on_the_way
           from stock_orders group by gift_id) o on o.gift_id = g.id
left join (select gift_id, count(*) as given from gift_handouts group by gift_id) h on h.gift_id = g.id
where is_staff();

-- ---------------------------------------------------------------
-- Volunteers and rota
-- ---------------------------------------------------------------
create table volunteers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references auth.users,
  name            text not null,
  email           citext not null,
  phone           text not null,
  role            staff_role not null check (role in ('santa', 'elf', 'lead_elf')),
  available_days  date[] not null default '{}',
  over_18         boolean not null,
  experience      text,
  why             text,
  own_suit        boolean,
  status          text not null default 'applied' check (status in ('applied', 'chat_booked', 'checks_done', 'approved', 'declined')),
  checks_confirmed_at timestamptz,
  created_at      timestamptz not null default now()
);

create table shifts (
  id            uuid primary key default gen_random_uuid(),
  day           date not null,
  name          text not null,
  starts_at     time not null,
  ends_at       time not null,
  santas_needed int  not null default 1,
  elves_needed  int  not null default 2,
  unique (day, name)
);

create table shift_assignments (
  shift_id     uuid not null references shifts(id) on delete cascade,
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  role         staff_role not null,
  primary key (shift_id, volunteer_id)
);

-- ---------------------------------------------------------------
-- Messages, photos, sponsorship
-- ---------------------------------------------------------------
create table messages (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references bookings(id) on delete set null,
  waitlist_id uuid references waitlist_entries(id) on delete set null,
  channel     channel not null,
  template    text not null,
  recipient   text not null,
  body        text not null,
  status      text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_id text,
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create table photos (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null,
  booking_id   uuid references bookings(id) on delete set null,
  consent      photo_consent not null,  -- copied at upload so it is clear what was agreed
  uploaded_by  uuid references auth.users,
  created_at   timestamptz not null default now(),
  check (consent <> 'none')
);

create table sponsorships (
  id            uuid primary key default gen_random_uuid(),
  company       text not null,
  contact_name  text not null,
  email         citext not null,
  gifts         int  not null check (gifts > 0),
  amount_pence  int  not null check (amount_pence > 0),
  pay_method    text not null check (pay_method in ('card', 'invoice')),
  show_on_wall  boolean not null default false,
  logo_requested boolean not null default false,
  status        text not null default 'pending' check (status in ('pending', 'paid', 'invoiced', 'cancelled')),
  stripe_session_id text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Booking engine
-- ---------------------------------------------------------------

-- Rebuild the bookable times for one day from its hours, the season settings and breaks.
-- Refuses to remove or block a time that families are booked into.
create function regenerate_slots(p_day date) returns int
language plpgsql security definer set search_path = public as $$
declare
  s seasons; d opening_days; t time; wanted time[] := '{}'; n int;
begin
  if not (is_admin() or is_server()) then raise exception 'NOT_ALLOWED'; end if;
  select * into s from seasons where year = extract(year from p_day)::int;
  if s is null then raise exception 'NO_SEASON'; end if;
  select * into d from opening_days where day = p_day;

  if d is not null and not d.closed then
    t := d.opens_at;
    while t + make_interval(mins => s.visit_minutes) <= d.closes_at
          and t + make_interval(mins => s.visit_minutes) > t loop
      wanted := wanted || t;
      t := t + make_interval(mins => s.visit_minutes + s.gap_minutes);
    end loop;
  end if;

  if exists (
    select 1 from slots sl join bookings b on b.slot_id = sl.id
    where sl.day = p_day and b.status in ('pending_review', 'confirmed')
      and (not (sl.starts_at = any(wanted))
           or exists (select 1 from blocked_times bt
                      where (bt.day = p_day or bt.day is null) and bt.starts_at = sl.starts_at))
  ) then
    raise exception 'BOOKINGS_AFFECTED' using hint = 'Move the families booked at these times first';
  end if;

  if exists (
    select 1 from slots sl
    where sl.day = p_day and sl.starts_at = any(wanted)
      and (select count(*) from bookings b where b.slot_id = sl.id and b.status in ('pending_review', 'confirmed')) > s.families_per_slot
  ) then
    raise exception 'BOOKINGS_AFFECTED' using hint = 'Some times have more families than the new limit';
  end if;

  -- remove unused times; keep ones with cancelled history but hide them
  delete from slots sl where sl.day = p_day and not (sl.starts_at = any(wanted))
    and not exists (select 1 from bookings b where b.slot_id = sl.id);
  update slots sl set blocked = true where sl.day = p_day and not (sl.starts_at = any(wanted));

  insert into slots (day, starts_at, ends_at, capacity, blocked)
  select p_day, w, w + make_interval(mins => s.visit_minutes), s.families_per_slot,
         exists (select 1 from blocked_times bt where (bt.day = p_day or bt.day is null) and bt.starts_at = w)
  from unnest(wanted) as w
  on conflict (day, starts_at) do update
    set ends_at = excluded.ends_at, capacity = excluded.capacity, blocked = excluded.blocked;

  get diagnostics n = row_count;
  return n;
end $$;

create function regenerate_season(p_year int) returns void
language plpgsql security definer set search_path = public as $$
declare d date;
begin
  if not (is_admin() or is_server()) then raise exception 'NOT_ALLOWED'; end if;
  for d in select day from opening_days where extract(year from day)::int = p_year order by day loop
    perform regenerate_slots(d);
  end loop;
end $$;

-- Public: times on a day with spaces left
create function available_slots(p_day date)
returns table (slot_id uuid, starts_at time, ends_at time, spaces_left int, state text)
language sql stable security definer set search_path = public as $$
  select sl.id, sl.starts_at, sl.ends_at,
         greatest(sl.capacity - count(b.id) filter (where b.status in ('pending_review', 'confirmed')), 0)::int,
         case when sl.blocked then 'break'
              when sl.capacity - count(b.id) filter (where b.status in ('pending_review', 'confirmed')) <= 0 then 'full'
              else 'open' end
  from slots sl
  join seasons s on s.year = extract(year from sl.day)::int and s.booking_open
  left join bookings b on b.slot_id = sl.id
  where sl.day = p_day
  group by sl.id
  order by sl.starts_at
$$;

-- Public: make a booking. p is the full booking form as JSON (see src/lib/booking-schema.ts).
create function create_booking(p jsonb)
returns table (reference text, manage_token uuid, status booking_status)
language plpgsql security definer set search_path = public as $$
declare
  v_slot slots; v_season seasons; v_house uuid; v_booking bookings; v_status booking_status := 'confirmed';
  v_email citext := nullif(trim(p->>'email'), '');
  v_phone text := nullif(trim(p->>'phone'), '');
  v_taken int; v jsonb; v_visitor uuid;
begin
  if coalesce((p->>'eligibility_confirmed')::boolean, false) is not true then raise exception 'ELIGIBILITY_REQUIRED'; end if;
  if coalesce((p->>'data_consent')::boolean, false) is not true then raise exception 'CONSENT_REQUIRED'; end if;

  select * into v_slot from slots where id = (p->>'slot_id')::uuid for update;
  if v_slot is null or v_slot.blocked then raise exception 'SLOT_UNAVAILABLE'; end if;
  select * into v_season from seasons where year = extract(year from v_slot.day)::int;
  if not v_season.booking_open then raise exception 'BOOKING_CLOSED'; end if;

  -- One visit per family: match on email or mobile
  select h.id into v_house from households h
  where (v_email is not null and h.email = v_email) or (v_phone is not null and h.phone_norm = norm_phone(v_phone))
  order by h.created_at limit 1;

  if v_house is not null and exists (
    select 1 from bookings b where b.household_id = v_house and b.season = v_season.year
      and b.status in ('pending_review', 'confirmed') and b.type = 'family') then
    raise exception 'ALREADY_BOOKED';  -- the app sends the existing booking link to their own email or phone
  end if;

  select count(*) into v_taken from bookings b where b.slot_id = v_slot.id and b.status in ('pending_review', 'confirmed');
  if v_taken >= v_slot.capacity then raise exception 'SLOT_FULL'; end if;

  -- Flagged contacts can still book, but an admin reviews before it is confirmed
  if exists (select 1 from flags f where f.active and ((v_email is not null and f.email = v_email)
             or (v_phone is not null and f.phone_norm = norm_phone(v_phone)))) then
    v_status := 'pending_review';
  end if;

  if v_house is null then
    insert into households (contact_name, email, phone, postcode, address_line, channels)
    values (p->>'contact_name', v_email, v_phone, p->>'postcode', p->>'address_line',
            coalesce((select array_agg(x::channel) from jsonb_array_elements_text(p->'channels') x), '{email}'))
    returning id into v_house;
  end if;

  insert into bookings (season, slot_id, household_id, type, status, eligibility_confirmed, data_consent_at)
  values (v_season.year, v_slot.id, v_house, 'family', v_status, true, now())
  returning * into v_booking;

  for v in select * from jsonb_array_elements(coalesce(p->'visitors', '[]'::jsonb)) loop
    insert into visitors (booking_id, kind, first_name, age, sex, pronouns, communication, mobility, sensory,
                          loves, dislikes, calming, meet_preference, gift_ideas, photo_consent)
    values (v_booking.id, (v->>'kind')::visitor_kind, v->>'first_name', (v->>'age')::int, v->>'sex', v->>'pronouns',
            coalesce((select array_agg(x) from jsonb_array_elements_text(v->'communication') x), '{}'),
            coalesce((select array_agg(x) from jsonb_array_elements_text(v->'mobility') x), '{}'),
            coalesce((select array_agg(x) from jsonb_array_elements_text(v->'sensory') x), '{}'),
            v->>'loves', v->>'dislikes', v->>'calming', v->>'meet_preference', v->>'gift_ideas',
            coalesce((p->>'photo_consent')::photo_consent, 'none'))
    returning id into v_visitor;
    if v ? 'condition' or v ? 'medical' or v ? 'other_requirements' then
      insert into visitor_sensitive (visitor_id, condition, medical, other_requirements)
      values (v_visitor, v->>'condition', v->>'medical', v->>'other_requirements');
    end if;
  end loop;

  update bookings b set details_complete = exists (
    select 1 from visitors vv where vv.booking_id = b.id and vv.kind = 'visitor' and vv.loves is not null and vv.dislikes is not null)
  where b.id = v_booking.id;

  perform find_duplicates_for(v_booking.id);
  return query select v_booking.reference, v_booking.manage_token, v_booking.status;
end $$;

-- Compare one booking with the rest of the season and record likely duplicates
create function find_duplicates_for(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into duplicate_candidates (booking_a, booking_b, reasons, score)
  select least(b.id, o.id), greatest(b.id, o.id), r.reasons, cardinality(r.reasons)
  from bookings b
  join households h on h.id = b.household_id
  join bookings o on o.season = b.season and o.id <> b.id and o.status in ('pending_review', 'confirmed')
  join households oh on oh.id = o.household_id
  cross join lateral (
    select array_remove(array[
      case when h.email is not null and h.email = oh.email then 'Same email address' end,
      case when h.phone_norm is not null and h.phone_norm = oh.phone_norm then 'Same mobile number' end,
      case when h.postcode_norm is not null and h.postcode_norm = oh.postcode_norm
             and h.address_line is not null and oh.address_line is not null
             and similarity(h.address_line, oh.address_line) > 0.6 then 'Same home address' end,
      case when exists (select 1 from visitors v1 join visitors v2 on v2.booking_id = o.id and v2.kind = 'visitor'
                        where v1.booking_id = b.id and v1.kind = 'visitor' and similarity(v1.first_name, v2.first_name) > 0.4)
           then 'Similar visitor name' end,
      case when h.postcode_norm is not null and left(h.postcode_norm, 4) = left(oh.postcode_norm, 4) then 'Same postcode area' end
    ], null) as reasons
  ) r
  where b.id = p_booking
    and h.id <> oh.id
    and (cardinality(r.reasons) >= 2
         or 'Same email address' = any(r.reasons) or 'Same mobile number' = any(r.reasons) or 'Same home address' = any(r.reasons))
  on conflict (booking_a, booking_b) do nothing;
end $$;

-- Public: cancel from the one-tap link. Frees the time and offers it to the waitlist.
create function cancel_booking(p_token uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_booking bookings;
begin
  update bookings set status = 'cancelled', cancelled_at = now()
  where manage_token = p_token and status in ('pending_review', 'confirmed')
  returning * into v_booking;
  if v_booking is null then raise exception 'NOT_FOUND'; end if;
  return offer_next_waitlist(v_booking.slot_id);  -- waitlist entry to message, or null
end $$;

-- Offer a free time to the first matching family on the waitlist. Returns the entry to message.
-- Offers made overnight are held from 08:00 so nobody loses a slot while asleep.
create function offer_next_waitlist(p_slot uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_slot slots; v_entry uuid; v_hold int; v_local timestamp; v_start timestamptz; v_free int;
begin
  select * into v_slot from slots where id = p_slot for update;
  if v_slot is null or v_slot.blocked or v_slot.day < (now() at time zone 'Europe/London')::date then return null; end if;
  select v_slot.capacity - count(*) into v_free from bookings
    where slot_id = p_slot and status in ('pending_review', 'confirmed');
  v_free := v_free - (select count(*) from waitlist_entries where offer_slot_id = p_slot and status = 'offered');
  if v_free <= 0 then return null; end if;

  select id into v_entry from waitlist_entries
  where status = 'waiting' and day = v_slot.day
    and (time_pref = 'any' or (time_pref = 'morning' and v_slot.starts_at < '12:30')
         or (time_pref = 'afternoon' and v_slot.starts_at >= '12:30'))
  order by created_at
  for update skip locked limit 1;
  if v_entry is null then return null; end if;

  select waitlist_hold_minutes into v_hold from seasons where year = extract(year from v_slot.day)::int;
  v_local := now() at time zone 'Europe/London';
  v_start := case when v_local::time between '08:00' and '20:00' then now()
                  when v_local::time > '20:00' then ((v_local::date + 1) + time '08:00') at time zone 'Europe/London'
                  else (v_local::date + time '08:00') at time zone 'Europe/London' end;

  update waitlist_entries set status = 'offered', offer_slot_id = p_slot, offer_token = gen_random_uuid(),
         offer_expires_at = v_start + make_interval(mins => v_hold)
  where id = v_entry;
  return v_entry;
end $$;

-- Run every few minutes: expire unclaimed offers and pass the time to the next family
create function expire_waitlist_offers() returns setof uuid
language plpgsql security definer set search_path = public as $$
declare r record; v_next uuid;
begin
  if not (is_admin() or is_server()) then raise exception 'NOT_ALLOWED'; end if;
  for r in update waitlist_entries set status = 'expired'
           where status = 'offered' and offer_expires_at < now()
           returning offer_slot_id loop
    v_next := offer_next_waitlist(r.offer_slot_id);
    if v_next is not null then return next v_next; end if;
  end loop;
end $$;

-- Public: claim an offered time with one tap. Creates the booking; visitor details follow.
create function claim_waitlist_offer(p_token uuid)
returns table (reference text, manage_token uuid)
language plpgsql security definer set search_path = public as $$
declare w waitlist_entries; v_house uuid; v_booking bookings; v_season int;
begin
  select * into w from waitlist_entries where offer_token = p_token for update;
  if w is null or w.status <> 'offered' or w.offer_expires_at < now() then raise exception 'OFFER_EXPIRED'; end if;
  perform 1 from slots where id = w.offer_slot_id for update;
  v_season := extract(year from w.day)::int;

  select h.id into v_house from households h
  where (w.email is not null and h.email = w.email) or (w.phone is not null and h.phone_norm = norm_phone(w.phone))
  order by h.created_at limit 1;
  if v_house is not null and exists (select 1 from bookings b where b.household_id = v_house and b.season = v_season
                                     and b.status in ('pending_review', 'confirmed') and b.type = 'family') then
    raise exception 'ALREADY_BOOKED';
  end if;
  if v_house is null then
    insert into households (contact_name, email, phone, channels)
    values (w.contact_name, w.email, w.phone, w.channels) returning id into v_house;
  end if;

  insert into bookings (season, slot_id, household_id, status, reply, eligibility_confirmed, data_consent_at)
  values (v_season, w.offer_slot_id, v_house,
          case when exists (select 1 from flags f where f.active and (f.email = w.email or f.phone_norm = norm_phone(w.phone)))
               then 'pending_review'::booking_status else 'confirmed' end,
          'confirmed', true, now())
  returning * into v_booking;
  update waitlist_entries set status = 'claimed' where id = w.id;
  return query select v_booking.reference, v_booking.manage_token;
end $$;

-- Staff: move a visit along on the day
create function set_visit_stage(p_booking uuid, p_stage visit_stage) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'NOT_ALLOWED'; end if;
  update bookings set stage = p_stage,
    status = case when p_stage = 'done' then 'attended'::booking_status else status end
  where id = p_booking;
end $$;

-- Staff: elves check in a delivery, counting what really arrived
create function check_in_delivery(p_order uuid, p_qty int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'NOT_ALLOWED'; end if;
  update stock_orders set qty_received = p_qty, received_at = now(), received_by = auth.uid(),
         status = case when p_qty < qty_ordered then 'short' else 'received' end
  where id = p_order and status = 'on_the_way';
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- Staff: elves record a gift handed over; it comes off stock
create function give_gift(p_gift uuid, p_visitor uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_left int;
begin
  if not is_staff() then raise exception 'NOT_ALLOWED'; end if;
  select coalesce(sum(qty_received), 0) - (select count(*) from gift_handouts where gift_id = p_gift)
    into v_left from stock_orders where gift_id = p_gift;
  if v_left <= 0 then raise exception 'OUT_OF_STOCK'; end if;
  insert into gift_handouts (gift_id, visitor_id, given_by) values (p_gift, p_visitor, auth.uid());
end $$;

-- Server only: find a family's existing booking so the link can be sent to their own contact details
create function find_existing_booking(p_email text, p_phone text)
returns table (booking_id uuid, manage_token uuid, reference text, day date, starts_at time, first_name text,
               email citext, phone text, channels channel[])
language sql stable security definer set search_path = public as $$
  select b.id, b.manage_token, b.reference, sl.day, sl.starts_at,
         coalesce((select v.first_name from visitors v where v.booking_id = b.id and v.kind = 'visitor' limit 1), 'your visitor'),
         h.email, h.phone, h.channels
  from households h
  join bookings b on b.household_id = h.id
  join slots sl on sl.id = b.slot_id
  where b.status in ('pending_review', 'confirmed') and b.type = 'family'
    and ((p_email is not null and h.email = p_email::citext) or (p_phone is not null and h.phone_norm = norm_phone(p_phone)))
  order by b.created_at desc
  limit 1
$$;

-- Santa sees only what he needs, for staff only
create view santa_cards as
select b.id as booking_id, sl.day, sl.starts_at, v.id as visitor_id, v.first_name, v.age,
       v.santa_hello, v.loves, v.dislikes, v.meet_preference, b.stage
from visitors v
join bookings b on b.id = v.booking_id
join slots sl on sl.id = b.slot_id
where v.kind = 'visitor' and b.status in ('confirmed', 'attended') and is_staff();

-- After the season: remove visitor details and health information
create function purge_season(p_year int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or is_server()) then raise exception 'NOT_ALLOWED'; end if;
  delete from visitors v using bookings b where v.booking_id = b.id and b.season = p_year;
  update households h set address_line = null
  where not exists (select 1 from bookings b where b.household_id = h.id and b.season > p_year);
  delete from waitlist_entries where extract(year from day)::int = p_year;
  delete from photos p using bookings b where p.booking_id = b.id and b.season = p_year and p.consent = 'family_only';
end $$;

-- ---------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------
do $$ declare t text;
begin
  foreach t in array array['staff','seasons','opening_days','blocked_times','slots','households','bookings','visitors',
    'visitor_sensitive','waitlist_entries','early_alerts','group_enquiries','duplicate_candidates','flags','gifts',
    'stock_orders','gift_handouts','volunteers','shifts','shift_assignments','messages','photos','sponsorships'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

create policy staff_read_self on staff for select to authenticated using (user_id = auth.uid());
create policy staff_read_setup on seasons for select to authenticated using (is_staff());
create policy staff_read_days on opening_days for select to authenticated using (is_staff());
create policy staff_read_slots on slots for select to authenticated using (is_staff());

-- Elves and the lead elf see bookings and visitors; Santa uses santa_cards only
create policy elves_read_bookings on bookings for select to authenticated using (my_role() in ('lead_elf', 'elf'));
create policy elves_read_visitors on visitors for select to authenticated using (my_role() in ('lead_elf', 'elf'));
create policy lead_edit_hello on visitors for update to authenticated using (is_lead()) with check (is_lead());
create policy lead_read_contacts on households for select to authenticated using (is_lead());
create policy lead_read_sensitive on visitor_sensitive for select to authenticated using (is_lead());

create policy staff_read_gifts on gifts for select to authenticated using (is_staff());
create policy staff_read_orders on stock_orders for select to authenticated using (is_staff());
create policy staff_read_shifts on shifts for select to authenticated using (is_staff());
create policy staff_read_assign on shift_assignments for select to authenticated using (is_staff());
create policy volunteer_read_self on volunteers for select to authenticated using (user_id = auth.uid());
create policy staff_add_photos on photos for insert to authenticated with check (is_staff() and uploaded_by = auth.uid());

-- Public forms can add a row but never read anything back
create policy public_add on early_alerts for insert to anon, authenticated with check (true);
create policy public_add on group_enquiries for insert to anon, authenticated with check (status = 'new');
create policy public_add on volunteers for insert to anon, authenticated with check (status = 'applied' and user_id is null);
create policy public_add on waitlist_entries for insert to anon, authenticated with check (status = 'waiting' and offer_token is null);
create policy public_add on sponsorships for insert to anon, authenticated with check (status = 'pending' and stripe_session_id is null);

-- Function permissions
revoke execute on all functions in schema public from public, anon;
grant execute on function available_slots(date), create_booking(jsonb), cancel_booking(uuid),
  claim_waitlist_offer(uuid), norm_phone(text), norm_postcode(text) to anon, authenticated;
grant execute on function my_role(), is_admin(), is_lead(), is_staff(), is_server(), regenerate_slots(date),
  regenerate_season(int), expire_waitlist_offers(), set_visit_stage(uuid, visit_stage), check_in_delivery(uuid, int),
  give_gift(uuid, uuid), purge_season(int), offer_next_waitlist(uuid), find_duplicates_for(uuid) to authenticated, service_role;
grant select on santa_cards, stock_levels to authenticated;
grant execute on function find_existing_booking(text, text) to service_role;
