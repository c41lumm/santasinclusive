-- People and companies offering toys, as an alternative to sponsoring gifts
create table toy_donations (
  id            uuid primary key default gen_random_uuid(),
  giver         text not null check (giver in ('person', 'company')),
  company       text check (company is null or length(company) <= 150),
  contact_name  text not null check (length(contact_name) <= 100),
  email         citext not null,
  phone         text,
  toys          text not null check (length(toys) <= 1500),
  how_many      int check (how_many is null or how_many between 1 and 5000),
  delivery      text not null check (delivery in ('drop_off', 'collect', 'post')),
  show_on_wall  boolean not null default false,
  status        text not null default 'offered' check (status in ('offered', 'arranged', 'received', 'cancelled')),
  notes         text check (notes is null or length(notes) <= 1000),
  created_at    timestamptz not null default now(),
  check (giver = 'person' or company is not null)
);
alter table toy_donations enable row level security;
create policy public_add on toy_donations for insert to anon, authenticated with check (status = 'offered' and notes is null);
create policy admin_all on toy_donations for all to authenticated using (is_admin()) with check (is_admin());
grant insert on toy_donations to anon;
grant select, insert, update, delete on toy_donations to authenticated;
