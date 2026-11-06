-- Wording an admin has changed for a message (Admin > Message wording). A message with no row here uses the
-- wording in src/lib/notify/templates.ts. Subject and body hold placeholders such as {name}, filled in when sent.
create table message_wording (
  name       text primary key check (name ~ '^[a-zA-Z0-9]+$'),
  subject    text not null check (length(subject) between 1 and 200),
  body       text not null check (length(body) between 1 and 2000),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Only admins can read or change it. Sending reads it as the server (database owner), which row level security
-- does not apply to.
alter table message_wording enable row level security;
create policy admin_all on message_wording for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on message_wording to authenticated;
