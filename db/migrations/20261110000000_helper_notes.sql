-- A note an admin writes about a helper, such as which days they'd like to work
alter table volunteers add column notes text check (notes is null or length(notes) <= 1000);
