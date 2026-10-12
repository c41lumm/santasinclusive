-- Santa's Inclusive Grotto: functions for the public pages (phase 2)
-- Everything here is reached either by the time picker or by a family's own unguessable link.

-- ---------------------------------------------------------------
-- Season and days, for the homepage and the date picker
-- ---------------------------------------------------------------

-- Public: the season that is on now or coming next
create function current_season()
returns table (year int, first_day date, last_day date, booking_open boolean)
language sql stable security definer set search_path = public as $$
  select s.year, s.first_day, s.last_day, s.booking_open from seasons s
  where s.last_day >= (now() at time zone 'Europe/London')::date
  order by s.year limit 1
$$;

-- Public: each open day of a season, with how many places are left on times that have not started
create function available_days(p_year int)
returns table (day date, spaces_left int)
language sql stable security definer set search_path = public as $$
  select sl.day,
         coalesce(sum(greatest(sl.capacity - slot_taken(sl.id), 0))
                  filter (where not sl.blocked and slot_starts(sl.day, sl.starts_at) > now()), 0)::int
  from slots sl
  join seasons s on s.year = p_year and s.booking_open
  join opening_days od on od.day = sl.day and not od.closed
  where extract(year from sl.day)::int = p_year and sl.day >= (now() at time zone 'Europe/London')::date
  group by sl.day
  order by sl.day
$$;

-- ---------------------------------------------------------------
-- A family's booking, from their manage link
-- ---------------------------------------------------------------

-- Public: everything the family told us, for their own booking page. Null if the link is wrong.
-- Contact details are not included: the link may be forwarded, so changes to them go through us.
create function get_booking(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'reference', b.reference,
    'status', b.status,
    'reply', b.reply,
    'day', sl.day,
    'starts_at', to_char(sl.starts_at, 'HH24:MI'),
    'ends_at', to_char(sl.ends_at, 'HH24:MI'),
    'started', slot_starts(sl.day, sl.starts_at) <= now(),
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

-- Public: save the visitor details form from the family's booking page. Visitors keep their id, so the
-- lead elf's checked "how Santa says hello" is kept; visitors left out of the list are removed.
create function update_booking_details(p_token uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; sl slots; v jsonb; v_id uuid; v_photo photo_consent;
begin
  select * into b from bookings where manage_token = p_token and status in ('pending_review', 'confirmed') for update;
  if b is null then raise exception 'NOT_FOUND'; end if;
  select * into sl from slots where id = b.slot_id;
  if slot_starts(sl.day, sl.starts_at) <= now() then raise exception 'TOO_LATE'; end if;
  if jsonb_typeof(p->'visitors') <> 'array' or jsonb_array_length(p->'visitors') > 12 then raise exception 'INVALID'; end if;
  if not exists (select 1 from jsonb_array_elements(p->'visitors') x where x->>'kind' = 'visitor') then
    raise exception 'VISITOR_REQUIRED';
  end if;
  v_photo := coalesce((p->>'photo_consent')::photo_consent, 'none');

  delete from visitors where booking_id = b.id
    and id not in (select (x->>'id')::uuid from jsonb_array_elements(p->'visitors') x where x->>'id' is not null);

  for v in select * from jsonb_array_elements(p->'visitors') loop
    if v->>'id' is not null then
      update visitors set kind = (v->>'kind')::visitor_kind, first_name = v->>'first_name', age = (v->>'age')::int,
             sex = v->>'sex', pronouns = v->>'pronouns',
             communication = coalesce((select array_agg(x) from jsonb_array_elements_text(v->'communication') x), '{}'),
             mobility = coalesce((select array_agg(x) from jsonb_array_elements_text(v->'mobility') x), '{}'),
             sensory = coalesce((select array_agg(x) from jsonb_array_elements_text(v->'sensory') x), '{}'),
             loves = v->>'loves', dislikes = v->>'dislikes', calming = v->>'calming',
             meet_preference = v->>'meet_preference', gift_ideas = v->>'gift_ideas', photo_consent = v_photo
      where id = (v->>'id')::uuid and booking_id = b.id
      returning id into v_id;
      if v_id is null then raise exception 'NOT_FOUND'; end if;
    else
      insert into visitors (booking_id, kind, first_name, age, sex, pronouns, communication, mobility, sensory,
                            loves, dislikes, calming, meet_preference, gift_ideas, photo_consent)
      values (b.id, (v->>'kind')::visitor_kind, v->>'first_name', (v->>'age')::int, v->>'sex', v->>'pronouns',
              coalesce((select array_agg(x) from jsonb_array_elements_text(v->'communication') x), '{}'),
              coalesce((select array_agg(x) from jsonb_array_elements_text(v->'mobility') x), '{}'),
              coalesce((select array_agg(x) from jsonb_array_elements_text(v->'sensory') x), '{}'),
              v->>'loves', v->>'dislikes', v->>'calming', v->>'meet_preference', v->>'gift_ideas', v_photo)
      returning id into v_id;
    end if;

    if coalesce(v->>'condition', v->>'medical', v->>'other_requirements') is null then
      delete from visitor_sensitive where visitor_id = v_id;
    else
      insert into visitor_sensitive (visitor_id, condition, medical, other_requirements)
      values (v_id, v->>'condition', v->>'medical', v->>'other_requirements')
      on conflict (visitor_id) do update
        set condition = excluded.condition, medical = excluded.medical, other_requirements = excluded.other_requirements;
    end if;
    v_id := null;
  end loop;

  update bookings set details_complete = exists (
    select 1 from visitors vv where vv.booking_id = b.id and vv.kind = 'visitor' and vv.loves is not null and vv.dislikes is not null)
  where id = b.id;
end $$;

-- Public: move a booking to another time from the family's booking page. The old time is offered to the waitlist.
create function move_booking(p_token uuid, p_slot uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; old_slot slots; new_slot slots; s seasons;
begin
  select * into b from bookings where manage_token = p_token and status in ('pending_review', 'confirmed') for update;
  if b is null then raise exception 'NOT_FOUND'; end if;
  if b.slot_id = p_slot then return; end if;
  -- Lock both times in the same order every time, so two families swapping cannot deadlock
  perform 1 from slots where id in (b.slot_id, p_slot) order by id for update;
  select * into old_slot from slots where id = b.slot_id;
  if slot_starts(old_slot.day, old_slot.starts_at) <= now() then raise exception 'TOO_LATE'; end if;
  select * into new_slot from slots where id = p_slot;
  if new_slot is null or new_slot.blocked or slot_starts(new_slot.day, new_slot.starts_at) <= now() then
    raise exception 'SLOT_UNAVAILABLE';
  end if;
  select * into s from seasons where year = extract(year from new_slot.day)::int;
  if s.year <> b.season or not s.booking_open then raise exception 'BOOKING_CLOSED'; end if;
  if slot_taken(new_slot.id) >= new_slot.capacity then raise exception 'SLOT_FULL'; end if;

  update bookings set slot_id = p_slot, reply = 'awaiting', reminder_7d_at = null, reminder_48h_at = null
  where id = b.id;
  perform offer_next_waitlist(old_slot.id);
end $$;

-- Public: a waitlist offer from its claim link, so the page can show it before the family taps to claim.
-- (Claiming is a button, never just opening the link: email scanners open links by themselves.)
create function get_offer(p_token uuid)
returns table (status waitlist_status, day date, starts_at text, expires_at timestamptz, expired boolean)
language sql stable security definer set search_path = public as $$
  select w.status, sl.day, to_char(sl.starts_at, 'HH24:MI'), w.offer_expires_at, w.offer_expires_at < now()
  from waitlist_entries w join slots sl on sl.id = w.offer_slot_id
  where w.offer_token = p_token
$$;

-- ---------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------
revoke execute on function current_season(), available_days(int), get_booking(uuid), get_offer(uuid),
  update_booking_details(uuid, jsonb), move_booking(uuid, uuid) from public;
grant execute on function current_season(), available_days(int), get_booking(uuid), get_offer(uuid),
  update_booking_details(uuid, jsonb), move_booking(uuid, uuid) to anon, authenticated;
