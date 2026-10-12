-- 2026 season: 1 to 24 December, 10:00 to 16:00, breaks at 12:40 and 13:00 (examples, change in admin)
insert into seasons (year, first_day, last_day) values (2026, '2026-12-01', '2026-12-24');
insert into opening_days (day) select d::date from generate_series('2026-12-01'::date, '2026-12-24'::date, interval '1 day') d;
insert into blocked_times (day, starts_at) values (null, '12:40'), (null, '13:00');
