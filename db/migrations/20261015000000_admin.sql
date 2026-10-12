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

-- Lead elves can read the rota and volunteers, and change assignments; admins already can through admin_all
create policy lead_read_volunteers on volunteers for select to authenticated using (is_lead());
create policy lead_edit_assignments on shift_assignments for all to authenticated using (is_lead()) with check (is_lead());
create policy lead_edit_shifts on shifts for update to authenticated using (is_lead()) with check (is_lead());

revoke execute on function admin_cancel_booking(uuid), admin_move_booking(uuid, uuid), admin_confirm_booking(uuid),
  admin_decide_duplicate(uuid, dup_status), ensure_shifts(int) from public, anon;
grant execute on function admin_cancel_booking(uuid), admin_move_booking(uuid, uuid), admin_confirm_booking(uuid),
  admin_decide_duplicate(uuid, dup_status), ensure_shifts(int) to authenticated;
