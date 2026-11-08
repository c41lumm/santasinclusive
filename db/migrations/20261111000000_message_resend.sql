-- Resending messages and checking whether emails arrived
alter table messages
  add column subject text,                                                   -- the email subject, so it can be sent again
  add column delivery text,                                                  -- what Resend last saw: delivered, bounced, ...
  add column delivery_checked_at timestamptz,
  add column resend_of uuid references messages(id) on delete set null,      -- the message this one sends again
  add column resent_by text;
create index messages_resend_of_idx on messages (resend_of);
create index messages_provider_idx on messages (provider_id);
