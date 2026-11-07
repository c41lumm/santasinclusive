-- Who approved each helper application, and who added each helper on the Dashboard (the admin's name, as shown)
alter table volunteers add column approved_by text, add column approved_at timestamptz;
alter table staff add column added_by text;
