-- Santa's Inclusive Grotto: changes for the approved designs
-- Waitlist: decline an offer but stay on the list, and leave the list from a link. Volunteers: the
-- questions on the design. Homepage: opening hours.

-- ---------------------------------------------------------------
-- Waitlist
-- ---------------------------------------------------------------
alter table waitlist_entries
  add column manage_token uuid not null unique default gen_random_uuid(),  -- for the "leave the list" link
  add column declined_slot_ids uuid[] not null default '{}';               -- times they said no to

-- As before, but a family is never offered a time they have already said no to
create or replace function offer_next_waitlist(p_slot uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_slot slots; v_entry uuid; v_hold int; v_local timestamp; v_start timestamptz; v_visit timestamptz;
begin
  select * into v_slot from slots where id = p_slot for update;
  if v_slot is null or v_slot.blocked then return null; end if;
  if slot_taken(p_slot) >= v_slot.capacity then return null; end if;

  v_local := now() at time zone 'Europe/London';
  v_start := case when v_local::time between '08:00' and '20:00' then now()
                  when v_local::time > '20:00' then ((v_local::date + 1) + time '08:00') at time zone 'Europe/London'
                  else (v_local::date + time '08:00') at time zone 'Europe/London' end;
  v_visit := slot_starts(v_slot.day, v_slot.starts_at);
  if v_visit <= v_start + interval '30 minutes' then return null; end if;

  select id into v_entry from waitlist_entries
  where status = 'waiting' and day = v_slot.day and not (p_slot = any(declined_slot_ids))
    and (time_pref = 'any' or (time_pref = 'morning' and v_slot.starts_at < '12:30')
         or (time_pref = 'afternoon' and v_slot.starts_at >= '12:30'))
  order by created_at
  for update skip locked limit 1;
  if v_entry is null then return null; end if;

  select waitlist_hold_minutes into v_hold from seasons where year = extract(year from v_slot.day)::int;
  update waitlist_entries set status = 'offered', offer_slot_id = p_slot, offer_token = gen_random_uuid(),
         offer_starts_at = v_start,
         offer_expires_at = least(v_start + make_interval(mins => v_hold), v_visit - interval '15 minutes')
  where id = v_entry;
  return v_entry;
end $$;

-- Public: "No thanks, keep me on the list". The time goes straight to the next family; this family keeps
-- its place for any other time that opens on that day.
create function decline_waitlist_offer(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare w waitlist_entries;
begin
  select * into w from waitlist_entries where offer_token = p_token for update;
  if w is null or w.status <> 'offered' then raise exception 'OFFER_EXPIRED'; end if;
  update waitlist_entries
     set status = 'waiting', offer_slot_id = null, offer_token = null, offer_starts_at = null, offer_expires_at = null,
         declined_slot_ids = declined_slot_ids || w.offer_slot_id
   where id = w.id;
  perform offer_next_waitlist(w.offer_slot_id);
end $$;

-- Public: the waitlist entry behind a "leave the list" link, so the page can say which day it is for
create function get_waitlist_entry(p_token uuid) returns table (day date, status waitlist_status)
language sql stable security definer set search_path = public as $$
  select w.day, w.status from waitlist_entries w where w.manage_token = p_token
$$;

-- Public: leave the waitlist. A time being held for them goes to the next family.
create function leave_waitlist(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare w waitlist_entries;
begin
  select * into w from waitlist_entries where manage_token = p_token for update;
  if w is null then raise exception 'NOT_FOUND'; end if;
  if w.status not in ('waiting', 'offered') then return; end if;
  update waitlist_entries set status = 'removed', offer_token = null where id = w.id;
  if w.status = 'offered' then perform offer_next_waitlist(w.offer_slot_id); end if;
end $$;

-- ---------------------------------------------------------------
-- Volunteers: the questions on the volunteer design
-- ---------------------------------------------------------------
alter table volunteers
  add column town text,
  add column available_weeks text[] not null default '{}',
  add column day_types text[] not null default '{}',      -- weekdays, weekends, evenings
  add column checks_agreed boolean not null default false;

-- ---------------------------------------------------------------
-- Homepage: opening hours for the season, from the opening days
-- ---------------------------------------------------------------
create function season_hours(p_year int) returns table (opens_at text, closes_at text, every_day boolean)
language sql stable security definer set search_path = public as $$
  select to_char(min(od.opens_at), 'HH24:MI'), to_char(max(od.closes_at), 'HH24:MI'),
         count(*) filter (where od.closed) = 0
  from opening_days od where extract(year from od.day)::int = p_year
$$;

-- ---------------------------------------------------------------
-- Booking page: start and end in UTC, for "Add to calendar"
-- ---------------------------------------------------------------
create or replace function get_booking(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'reference', b.reference,
    'status', b.status,
    'reply', b.reply,
    'day', sl.day,
    'starts_at', to_char(sl.starts_at, 'HH24:MI'),
    'ends_at', to_char(sl.ends_at, 'HH24:MI'),
    'started', slot_starts(sl.day, sl.starts_at) <= now(),
    'starts_utc', to_char(slot_starts(sl.day, sl.starts_at) at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"'),
    'ends_utc', to_char(slot_starts(sl.day, sl.ends_at) at time zone 'UTC', 'YYYYMMDD"T"HH24MISS"Z"'),
    'contact_name', h.contact_name,
    'details_complete', b.details_complete,
    'photo_consent', coalesce((select v.photo_consent from visitors v where v.booking_id = b.id limit 1), 'none'),
    'visitors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'kind', v.kind, 'first_name', v.first_name, 'age', v.age, 'sex', v.sex, 'pronouns', v.pronouns,
        'communication', v.communication, 'mobility', v.mobility, 'sensory', v.sensory,
        'loves', v.loves, 'dislikes', v.dislikes, 'calming', v.calming, 'meet_preference', v.meet_preference,
        'gift_ideas', v.gift_ideas, 'condition', vs.condition, 'medical', vs.medical,
        'other_requirements', vs.other_requirements) order by v.kind, v.created_at)
      from visitors v left join visitor_sensitive vs on vs.visitor_id = v.id
      where v.booking_id = b.id), '[]'::jsonb))
  from bookings b
  join slots sl on sl.id = b.slot_id
  left join households h on h.id = b.household_id
  where b.manage_token = p_token
$$;

-- ---------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------
revoke execute on function decline_waitlist_offer(uuid), get_waitlist_entry(uuid), leave_waitlist(uuid),
  season_hours(int), offer_next_waitlist(uuid) from public, anon, authenticated;
grant execute on function decline_waitlist_offer(uuid), get_waitlist_entry(uuid), leave_waitlist(uuid),
  season_hours(int) to anon, authenticated;
