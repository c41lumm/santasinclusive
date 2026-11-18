-- Admins and lead elves book schools and groups straight onto times, as one or more back-to-back bookings
alter table bookings
  add column group_size      int check (group_size is null or group_size between 1 and 500),
  add column group_age_range text check (group_age_range is null or length(group_age_range) <= 60),
  add column group_notes     text check (group_notes is null or length(group_notes) <= 2000),
  add column group_phone     text check (group_phone is null or length(group_phone) <= 30),
  add column group_enquiry_id uuid references group_enquiries(id) on delete set null;

-- p: slot_ids (uuid[]), group_name, contact_name, email, phone, group_size, group_staff, age_range, notes, enquiry_id
create function admin_add_group_booking(p jsonb)
returns table (booking_id uuid, reference text, day date, starts_at time)
language plpgsql security definer set search_path = public as $$
declare
  v_house uuid; v_slot slots; v_season seasons; v_id uuid; v_ids uuid[];
begin
  if not (is_lead() or is_server()) then raise exception 'NOT_ALLOWED'; end if;
  select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(p->'slot_ids') x;
  if v_ids is null or array_length(v_ids, 1) = 0 then raise exception 'SLOT_UNAVAILABLE'; end if;
  if nullif(trim(p->>'group_name'), '') is null or nullif(trim(p->>'contact_name'), '') is null or nullif(trim(p->>'email'), '') is null then
    raise exception 'CONTACT_REQUIRED';
  end if;

  -- Check every time first (locking them), so a group is never half booked
  for v_slot in select * from slots where id = any(v_ids) order by starts_at for update loop
    if v_slot.blocked or slot_starts(v_slot.day, v_slot.starts_at) <= now() then raise exception 'SLOT_UNAVAILABLE'; end if;
    if slot_taken(v_slot.id) >= v_slot.capacity then raise exception 'SLOT_FULL'; end if;
  end loop;
  if (select count(*) from slots where id = any(v_ids)) <> array_length(v_ids, 1) then raise exception 'SLOT_UNAVAILABLE'; end if;

  insert into households (contact_name, email, channels) values (trim(p->>'contact_name'), trim(p->>'email'), '{email}')
  returning id into v_house;

  for v_slot in select * from slots where id = any(v_ids) order by starts_at loop
    select * into v_season from seasons where year = extract(year from v_slot.day)::int;
    insert into bookings (season, slot_id, household_id, type, status, eligibility_confirmed, data_consent_at, details_complete,
                          group_name, group_staff, group_size, group_age_range, group_notes, group_phone, group_enquiry_id)
    values (v_season.year, v_slot.id, v_house, 'group', 'confirmed', true, now(), true,
            trim(p->>'group_name'), nullif(p->>'group_staff', '')::int, nullif(p->>'group_size', '')::int,
            nullif(trim(p->>'age_range'), ''), nullif(trim(p->>'notes'), ''), nullif(trim(p->>'phone'), ''),
            nullif(p->>'enquiry_id', '')::uuid)
    returning id into v_id;
    booking_id := v_id; day := v_slot.day; starts_at := v_slot.starts_at;
    select b.reference into reference from bookings b where b.id = v_id;
    return next;
  end loop;

  if nullif(p->>'enquiry_id', '') is not null then
    update group_enquiries set status = 'booked' where id = (p->>'enquiry_id')::uuid;
  end if;
end $$;

revoke all on function admin_add_group_booking(jsonb) from public, anon;
grant execute on function admin_add_group_booking(jsonb) to authenticated;

-- Staff read bookings column by column (the private link is never readable); add the new group columns
grant select (group_size, group_age_range, group_notes, group_phone, group_enquiry_id) on bookings to authenticated;
