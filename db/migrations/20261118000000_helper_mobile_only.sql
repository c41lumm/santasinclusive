-- Helpers can be added with just a mobile: they go on the rota and get their shifts by text, without a sign-in
alter table volunteers alter column email drop not null;
alter table volunteers add constraint volunteers_contact_check check (email is not null or coalesce(phone, '') <> '');
