-- Helpers accept or decline the shifts they are put on, and can see the whole rota
alter table shift_assignments
  add column status text not null default 'asked' check (status in ('asked', 'accepted', 'declined')),
  add column responded_at timestamptz;

-- A helper's answer to one of their own shifts
create function respond_to_shift(p_shift uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'NOT_ALLOWED'; end if;
  update shift_assignments a set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  from volunteers v
  where a.shift_id = p_shift and a.volunteer_id = v.id and v.user_id = app.uid();
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- The team rota for helpers: who is on each shift (names and roles only), without anyone's contact details
create function team_rota(p_from date, p_to date)
returns table (day date, shift_name text, starts_at time, ends_at time, name text, role staff_role, status text, is_me boolean)
language sql stable security definer set search_path = public as $$
  select s.day, s.name, s.starts_at, s.ends_at, v.name, a.role, a.status, v.user_id = app.uid()
  from shifts s
  join shift_assignments a on a.shift_id = s.id
  join volunteers v on v.id = a.volunteer_id
  where is_staff() and s.day between p_from and p_to and a.status <> 'declined'
  order by s.day, s.starts_at, a.role, v.name
$$;

revoke all on function respond_to_shift(uuid, boolean), team_rota(date, date) from public, anon;
grant execute on function respond_to_shift(uuid, boolean), team_rota(date, date) to authenticated;
