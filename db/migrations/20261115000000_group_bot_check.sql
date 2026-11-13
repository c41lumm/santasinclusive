-- Group enquiries the bot check was unsure about are kept, marked for an admin to check, instead of turned away
alter table group_enquiries add column unverified boolean not null default false;
