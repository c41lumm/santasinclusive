-- The admin Inbox: emails sent to the grotto's own addresses arrive in Resend; this keeps track of what we did with them
create table inbox_state (
  email_id    text primary key,   -- Resend's id for the received email
  read_at     timestamptz,
  read_by     text,
  replied_at  timestamptz,
  replied_by  text,
  archived_at timestamptz
);
alter table inbox_state enable row level security;  -- server only
alter table messages add column inbox_email_id text; -- a reply sent from the Inbox, and the email it answers
create index messages_inbox_idx on messages (inbox_email_id);
