-- Santa's Inclusive Grotto: the admin area (phase 3)
-- Writes the admin pages make that need more than a plain update: each checks the caller's role itself.

-- Messages can be about a volunteer (the rota), as well as a booking or waitlist entry
alter table messages add column volunteer_id uuid references volunteers(id) on delete set null;
create index messages_volunteer_idx on messages (volunteer_id);

-- Admin or lead elf: cancel a booking from the bookings page. The time is offered to the waitlist.
create function admin_cancel_booking(p_booking uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_slot uuid;
begin
  if not (is_lead() or is_server()) then raise exception 'NOT_ALLOWED'; end if;
  update bookings set status = 'cancelled', cancelled_at = now()
  where id = p_booking and status in ('pending_review', 'confirmed')
  returning slot_id into v_slot;
  if v_slot is null then raise exception 'NOT_FOUND'; end if;
  return offer_next_waitlist(v_slot);
end $$;

-- Admin or lead elf: move a booking to another time. Unlike the family's own move, this works while
-- public booking is closed and for times that have started (for example on the day).
create function admin_move_booking(p_booking uuid, p_slot uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; new_slot slots;
begin
  if not (is_lead() or is_server()) then raise exception 'NOT_ALLOWED'; end if;
  select * into b from bookings where id = p_booking and status in ('pending_review', 'confirmed') for update;
  if b is null then raise exception 'NOT_FOUND'; end if;
  if b.slot_id = p_slot then return; end if;
  perform 1 from slots where id in (b.slot_id, p_slot) order by id for update;
  select * into new_slot from slots where id = p_slot;
  if new_slot is null or new_slot.blocked then raise exception 'SLOT_UNAVAILABLE'; end if;
  if extract(year from new_slot.day)::int <> b.season then raise exception 'SLOT_UNAVAILABLE'; end if;
  if slot_taken(new_slot.id) >= new_slot.capacity then raise exception 'SLOT_FULL'; end if;
  update bookings set slot_id = p_slot, reply = 'awaiting', reminder_7d_at = null, reminder_48h_at = null where id = b.id;
  perform offer_next_waitlist(b.slot_id);
end $$;

-- Admin: confirm a booking that was held for review (a flagged contact)
create function admin_confirm_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or is_server()) then raise exception 'NOT_ALLOWED'; end if;
  update bookings set status = 'confirmed' where id = p_booking and status = 'pending_review';
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- Admin: record the decision on a possible duplicate
create function admin_decide_duplicate(p_id uuid, p_status dup_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or is_server()) then raise exception 'NOT_ALLOWED'; end if;
  update duplicate_candidates set status = p_status, decided_by = app.uid(), decided_at = now() where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- Admin or lead elf: make sure every open day has its two shifts. Morning runs from half an hour before opening
-- to 13:00, afternoon from 12:30 to half an hour after closing, overlapping for the handover.
create function ensure_shifts(p_year int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not (is_lead() or is_server()) then raise exception 'NOT_ALLOWED'; end if;
  insert into shifts (day, name, starts_at, ends_at)
  select od.day, s.name,
         case s.name when 'Morning' then od.opens_at - interval '30 minutes' else time '12:30' end,
         case s.name when 'Morning' then time '13:00' else od.closes_at + interval '30 minutes' end
  from opening_days od cross join (values ('Morning'), ('Afternoon')) as s(name)
  where extract(year from od.day)::int = p_year and not od.closed
  on conflict (day, name) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;


-- Visit times: a day can have its own breaks instead of the every-day ones ("Breaks for this day only")
alter table opening_days add column own_breaks boolean not null default false;

create or replace function regenerate_slots(p_day date) returns int
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
                      where (bt.day = p_day or (bt.day is null and not coalesce(d.own_breaks, false))) and bt.starts_at = sl.starts_at))
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
         exists (select 1 from blocked_times bt where (bt.day = p_day or (bt.day is null and not coalesce(d.own_breaks, false))) and bt.starts_at = w)
  from unnest(wanted) as w
  on conflict (day, starts_at) do update
    set ends_at = excluded.ends_at, capacity = excluded.capacity, blocked = excluded.blocked;

  get diagnostics n = row_count;
  return n;
end $$;

-- Lead elves can read the rota and volunteers, and change assignments; admins already can through admin_all
create policy lead_read_volunteers on volunteers for select to authenticated using (is_lead());
create policy lead_edit_assignments on shift_assignments for all to authenticated using (is_lead()) with check (is_lead());
create policy lead_edit_shifts on shifts for update to authenticated using (is_lead()) with check (is_lead());

revoke execute on function admin_cancel_booking(uuid), admin_move_booking(uuid, uuid), admin_confirm_booking(uuid),
  admin_decide_duplicate(uuid, dup_status), ensure_shifts(int) from public, anon;
grant execute on function admin_cancel_booking(uuid), admin_move_booking(uuid, uuid), admin_confirm_booking(uuid),
  admin_decide_duplicate(uuid, dup_status), ensure_shifts(int) to authenticated;
