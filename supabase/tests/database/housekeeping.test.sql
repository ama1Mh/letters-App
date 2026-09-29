-- pgTAP tests for 20260929200000_housekeeping.sql: the daily purge job exists, is not callable by
-- clients, removes only old rate-limit buckets and old finished notifications, and never touches
-- pending notifications.
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose, as in the other files.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000c01', 'k01@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000c02', 'k02@example.test', '{}');
update public.profiles set username = 'kim_house', display_name = 'Kim', onboarded_at = now()
  where id = '00000000-0000-0000-0000-000000000c01';
update public.profiles set username = 'lee_house', display_name = 'Lee', onboarded_at = now()
  where id = '00000000-0000-0000-0000-000000000c02';

insert into public.api_rate_limits (user_id, action, window_start, count) values
  ('00000000-0000-0000-0000-000000000c01', 'send_letter_day', now() - interval '3 days', 5),
  ('00000000-0000-0000-0000-000000000c01', 'send_letter_day', date_trunc('day', now()), 2);

insert into public.letters (id, sender_id, recipient_id, body, status, scheduled_at, delivered_at) values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02', 'a', 'delivered', now(), now()),
  ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02', 'b', 'delivered', now(), now()),
  ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02', 'c', 'delivered', now(), now());
insert into public.notification_outbox (id, user_id, letter_id, type, status, sent_at, created_at) values
  ('c1100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000c02', 'c1000000-0000-0000-0000-000000000001', 'letter_delivered', 'sent', now() - interval '40 days', now() - interval '40 days'),
  ('c1100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000c02', 'c1000000-0000-0000-0000-000000000003', 'letter_delivered', 'sent', now(), now());
insert into public.notification_outbox (id, user_id, letter_id, type, status, created_at) values
  ('c1100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000c02', 'c1000000-0000-0000-0000-000000000002', 'letter_delivered', 'pending', now() - interval '40 days');

select is(
  (select schedule from cron.job where jobname = 'purge-housekeeping'),
  '17 3 * * *',
  'the purge job runs daily'
);
select is(
  (select command from cron.job where jobname = 'purge-housekeeping'),
  'select public.purge_housekeeping();',
  'the job only calls the purge function'
);
select ok(not has_function_privilege('authenticated', 'public.purge_housekeeping()', 'execute'), 'clients cannot run the purge');
select ok(not has_function_privilege('anon', 'public.purge_housekeeping()', 'execute'), 'anon cannot run the purge');

select lives_ok($$ select public.purge_housekeeping() $$, 'the purge runs');

select is((select count(*)::int from public.api_rate_limits where user_id = '00000000-0000-0000-0000-000000000c01'), 1,
  'the old rate-limit bucket is gone and today''s is kept');
select ok(not exists (select 1 from public.notification_outbox where id = 'c1100000-0000-0000-0000-000000000001'),
  'an old sent notification is purged');
select ok(exists (select 1 from public.notification_outbox where id = 'c1100000-0000-0000-0000-000000000003'),
  'a recent sent notification is kept');
select ok(exists (select 1 from public.notification_outbox where id = 'c1100000-0000-0000-0000-000000000002'),
  'a pending notification is never purged, however old');
select is((select count(*)::int from public.letters where sender_id = '00000000-0000-0000-0000-000000000c01'), 3,
  'letters are never purged');

select * from finish();
rollback;
