-- pgTAP tests for 20260930090000_notification_schedule.sql: the send-notifications job exists and
-- only calls invoke_send_notifications(), which clients cannot run, which does nothing until both
-- Vault secrets exist, skips the HTTP call when nothing is due, and otherwise queues exactly one
-- POST with the stored key. Everything (including the Vault secrets) is rolled back.
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose, as in the other files.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select is(
  (select schedule from cron.job where jobname = 'send-notifications'),
  '* * * * *',
  'the sender job runs every minute'
);
select is(
  (select command from cron.job where jobname = 'send-notifications'),
  'select public.invoke_send_notifications();',
  'the job only calls invoke_send_notifications()'
);
select ok(not has_function_privilege('authenticated', 'public.invoke_send_notifications()', 'execute'),
  'clients cannot trigger the sender');
select ok(not has_function_privilege('anon', 'public.invoke_send_notifications()', 'execute'),
  'anon cannot trigger the sender');
select is(
  (select prosecdef from pg_proc where oid = 'public.invoke_send_notifications()'::regprocedure),
  true,
  'SECURITY DEFINER (reads Vault as its owner)'
);
select is(
  (select proconfig from pg_proc where oid = 'public.invoke_send_notifications()'::regprocedure),
  array['search_path=""'],
  'with an empty search_path'
);

-- A due notification exists from here on.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000d01', 'n01@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000d02', 'n02@example.test', '{}');
update public.profiles set username = 'nia_sched', display_name = 'Nia', onboarded_at = now()
  where id = '00000000-0000-0000-0000-000000000d01';
update public.profiles set username = 'omar_sched', display_name = 'Omar', onboarded_at = now()
  where id = '00000000-0000-0000-0000-000000000d02';
insert into public.letters (id, sender_id, recipient_id, body, status, scheduled_at, delivered_at) values
  ('d1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d02', 'a', 'delivered', now(), now());
insert into public.notification_outbox (id, user_id, letter_id, type) values
  ('d1100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000d02', 'd1000000-0000-0000-0000-000000000001', 'letter_delivered');

create temp table queued_before as select count(*)::int as n from net.http_request_queue;

select is(public.invoke_send_notifications(), null, 'no secrets stored: does nothing');

select vault.create_secret('https://example.test/functions/v1/send-notifications', 'send_notifications_url');
select is(public.invoke_send_notifications(), null, 'only the URL stored: still does nothing');

select vault.create_secret('test-service-key', 'send_notifications_key');
select isnt(public.invoke_send_notifications(), null, 'both secrets and a due notification: one request');
select is(
  (select count(*)::int from net.http_request_queue) - (select n from queued_before),
  1,
  'exactly one POST was queued'
);
select is(
  (select url from net.http_request_queue order by id desc limit 1),
  'https://example.test/functions/v1/send-notifications',
  'to the stored URL'
);
select is(
  (select headers ->> 'Authorization' from net.http_request_queue order by id desc limit 1),
  'Bearer test-service-key',
  'with the stored key'
);

update public.notification_outbox set status = 'sent', sent_at = now()
  where id = 'd1100000-0000-0000-0000-000000000001';
select is(public.invoke_send_notifications(), null, 'nothing due: no request');

insert into public.letters (id, sender_id, recipient_id, body, status, scheduled_at, delivered_at) values
  ('d1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d02', 'b', 'delivered', now(), now());
insert into public.notification_outbox (id, user_id, letter_id, type, next_attempt_at) values
  ('d1100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000d02', 'd1000000-0000-0000-0000-000000000002', 'letter_delivered', now() + interval '5 minutes');
select is(public.invoke_send_notifications(), null, 'a retry that is not due yet: no request');

select vault.update_secret(
  (select id from vault.secrets where name = 'send_notifications_url'), 'http://example.test/x');
update public.notification_outbox set next_attempt_at = now() where id = 'd1100000-0000-0000-0000-000000000002';
select is(public.invoke_send_notifications(), null, 'a non-https URL is refused');

select * from finish();
rollback;
