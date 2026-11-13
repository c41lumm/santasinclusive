-- Admins can be put on the Helper rota too (in the elves' column), so they need a volunteer record like other helpers
alter table volunteers drop constraint volunteers_role_check;
alter table volunteers add constraint volunteers_role_check check (role in ('santa', 'elf', 'lead_elf', 'admin'));

-- Existing admins: an approved record, available any day of the season, linked to their sign-in
insert into volunteers (user_id, name, email, phone, role, over_18, status, available_weeks, approved_at)
select s.user_id, s.name, u.email, coalesce(s.phone, ''), 'admin', true, 'approved',
       coalesce((select array[extract(day from first_day)::int || ' to ' || extract(day from last_day)::int || ' December']
                 from seasons order by year desc limit 1), '{}'), now()
from staff s join neon_auth."user" u on u.id = s.user_id
where s.role = 'admin' and not exists (select 1 from volunteers v where v.user_id = s.user_id)
on conflict (user_id) do nothing;
