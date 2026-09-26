-- pgTAP tests for Phase 6 step 3A (20260926090000_delivery_cron_realtime.sql): the pg_cron job
-- definition, letter events over Realtime Broadcast (who receives what), the realtime.messages
-- policy, and updated_at no longer moving on terminal letters (read-receipt side channel).
-- What pgTAP cannot show - the job actually firing every minute and delivering a letter scheduled
-- two minutes ahead exactly once - is supabase/tests/live/cron_delivery.sh (CI, real pg_cron).
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose: written without a local
-- Postgres to count against.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------------------------
-- Fixtures (as the table owner)
--   901 sal  sender, receipts on (default)     903 una  recipient, read receipts OFF
--   902 rob  recipient, receipts on            904 ben  recipient, blocks sal
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000901', 'r901@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000902', 'r902@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000903', 'r903@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000904', 'r904@example.test', '{}');

update public.profiles as p
set username = v.username, display_name = v.display_name, receive_mode = 'everyone', onboarded_at = now()
from (values
  ('00000000-0000-0000-0000-000000000901'::uuid, 'sal_nine', 'Sal'),
  ('00000000-0000-0000-0000-000000000902'::uuid, 'rob_nine', 'Rob'),
  ('00000000-0000-0000-0000-000000000903'::uuid, 'una_nine', 'Una'),
  ('00000000-0000-0000-0000-000000000904'::uuid, 'ben_nine', 'Ben')
) as v (id, username, display_name)
where p.id = v.id;
update public.profiles set read_receipts_enabled = false where id = '00000000-0000-0000-0000-000000000903';

insert into public.letters (id, sender_id, recipient_id, subject, body, status, scheduled_at) values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000902', 'secret subject r1', 'secret body r1', 'scheduled', now() - interval '1 minute'),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000904', 'secret subject r2', 'secret body r2', 'scheduled', now() - interval '1 minute'),
  ('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000903', 'secret subject r3', 'secret body r3', 'scheduled', now() - interval '1 minute');
insert into public.letters (id, sender_id, recipient_id, body) values
  ('90000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000902', 'secret body draft');
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-000000000904', '00000000-0000-0000-0000-000000000901');

-- Event count helper for this file only: messages on a user's letters topic for one letter.
create function pg_temp.events(p_user text, p_letter text, p_event text)
returns bigint language sql as $$
  select count(*) from realtime.messages
  where topic = 'letters:00000000-0000-0000-0000-000000000' || p_user
    and event = p_event
    and payload ->> 'letter_id' = '90000000-0000-0000-0000-00000000000' || p_letter;
$$;

-- ---------------------------------------------------------------------------------------------
-- pg_cron job definition
-- ---------------------------------------------------------------------------------------------
select has_extension('pg_cron', 'pg_cron is installed');
select is((select count(*)::int from cron.job where jobname = 'deliver-due-letters'), 1, 'exactly one deliver-due-letters job');
select is((select schedule from cron.job where jobname = 'deliver-due-letters'), '* * * * *', 'it runs once per minute');
select is((select command from cron.job where jobname = 'deliver-due-letters'), 'select public.deliver_due_letters(500);', 'it only calls deliver_due_letters(500)');
select ok(
  (select command !~* '\m(insert|update|delete|deliver_letter_internal|notification_outbox|letters\s)\M'
   from cron.job where jobname = 'deliver-due-letters'),
  'the job command holds no delivery logic of its own'
);
select ok((select active from cron.job where jobname = 'deliver-due-letters'), 'the job is active');
select is((select database from cron.job where jobname = 'deliver-due-letters'), current_database()::text, 'the job runs in this database');
select is((select username from cron.job where jobname = 'deliver-due-letters'), 'postgres', 'the job runs as postgres (the function owner), not a client role');
select is(
  (select count(*)::int from cron.job where command ilike '%deliver%'),
  1,
  'no other cron job touches delivery'
);

-- The job needs no client-facing grant: both delivery functions stay internal.
select ok(not has_function_privilege('anon', 'public.deliver_due_letters(int)', 'execute'), 'anon cannot execute deliver_due_letters()');
select ok(not has_function_privilege('authenticated', 'public.deliver_due_letters(int)', 'execute'), 'authenticated cannot execute deliver_due_letters()');
select ok(not has_function_privilege('anon', 'public.deliver_letter_internal(uuid)', 'execute'), 'anon cannot execute deliver_letter_internal()');
select ok(not has_function_privilege('authenticated', 'public.deliver_letter_internal(uuid)', 'execute'), 'authenticated cannot execute deliver_letter_internal()');
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where oid in ('public.deliver_due_letters(int)'::regprocedure, 'public.deliver_letter_internal(uuid)'::regprocedure)),
  'both delivery functions are still SECURITY DEFINER with an empty search_path'
);

-- Running the job's own command (what pg_cron executes) delivers a due letter; the permission
-- re-check still applies (904 blocked the sender after it was scheduled).
select lives_ok((select command from cron.job where jobname = 'deliver-due-letters'), 'the job command runs');
select is((select status from public.letters where id = '90000000-0000-0000-0000-000000000001'), 'delivered'::public.letter_status, 'the job command delivered a due letter');
select is((select status from public.letters where id = '90000000-0000-0000-0000-000000000002'), 'undeliverable'::public.letter_status, 'and made the blocked one undeliverable');
select is((select count(*)::int from public.notification_outbox where letter_id = '90000000-0000-0000-0000-000000000001'), 1, 'the delivered letter has one outbox row');
select is((select count(*)::int from public.notification_outbox where letter_id = '90000000-0000-0000-0000-000000000002'), 0, 'the undeliverable letter has none');
select lives_ok((select command from cron.job where jobname = 'deliver-due-letters'), 'running the job command again');
select is((select count(*)::int from public.notification_outbox where letter_id = '90000000-0000-0000-0000-000000000001'), 1, 'still exactly one outbox row after a second run');

-- ---------------------------------------------------------------------------------------------
-- Realtime configuration: Broadcast only, no postgres_changes on letters or the outbox
-- ---------------------------------------------------------------------------------------------
select ok(
  not exists (select 1 from pg_publication_tables where schemaname = 'public' and tablename in ('letters', 'notification_outbox')),
  'neither letters nor notification_outbox is in any publication (no postgres_changes)'
);
select is((select relreplident::text from pg_class where oid = 'public.letters'::regclass), 'd', 'letters keeps the default replica identity');
select has_trigger('public', 'letters', 'letters_broadcast_changes', 'letters has the broadcast trigger');
select ok(not has_function_privilege('authenticated', 'public.letters_broadcast_changes()', 'execute'), 'authenticated cannot execute the broadcast trigger function');
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.letters_broadcast_changes()'::regprocedure),
  'the broadcast trigger function is SECURITY DEFINER with an empty search_path'
);
select is(
  (select row(roles, cmd)::text from pg_policies where schemaname = 'realtime' and tablename = 'messages' and policyname = 'letters_topic_receive_own'),
  row(array['authenticated']::name[], 'SELECT')::text,
  'realtime.messages: receive-own-topic policy is SELECT for authenticated only'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'realtime' and tablename = 'messages' and cmd in ('INSERT', 'ALL')),
  0,
  'realtime.messages: no policy lets a client send'
);

-- The existing letters privilege model is unchanged by this step.
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'letters'), 5, 'letters still has exactly its 5 policies');
select ok(not has_column_privilege('authenticated', 'public.letters', 'read_at', 'select'), 'read_at is still not selectable by clients');
select ok(not has_table_privilege('anon', 'public.letters', 'select'), 'anon still cannot select letters');
select ok(not has_table_privilege('authenticated', 'public.notification_outbox', 'select'), 'notification_outbox is still not client-readable');

-- ---------------------------------------------------------------------------------------------
-- Broadcast events from the job run above
-- ---------------------------------------------------------------------------------------------
select is(pg_temp.events('901', '1', 'letter_status'), 1::bigint, 'delivered: the sender gets one letter_status event');
select is(
  (select payload ->> 'status' from realtime.messages
   where topic = 'letters:00000000-0000-0000-0000-000000000901' and event = 'letter_status'
     and payload ->> 'letter_id' = '90000000-0000-0000-0000-000000000001'),
  'delivered',
  'with status delivered'
);
select is(pg_temp.events('902', '1', 'letter_delivered'), 1::bigint, 'delivered: the recipient gets one letter_delivered event');
select ok(
  (select bool_and(private) from realtime.messages where topic like 'letters:00000000-0000-0000-0000-00000000090_'),
  'every letters event is sent as private'
);
select is(
  (select array_agg(distinct k order by k) from realtime.messages m, jsonb_object_keys(m.payload) as k
   where m.topic like 'letters:00000000-0000-0000-0000-00000000090_'),
  array['id', 'letter_id', 'status'],
  'payloads carry only ids and status (plus realtime''s own message id)'
);
select ok(
  not exists (select 1 from realtime.messages where topic like 'letters:%' and payload::text ~ 'secret'),
  'no letter subject or body in any event'
);
select is(pg_temp.events('901', '2', 'letter_status'), 1::bigint, 'undeliverable: the sender gets a letter_status event');
select is(
  (select count(*)::int from realtime.messages where topic = 'letters:00000000-0000-0000-0000-000000000904'),
  0,
  'undeliverable: the recipient gets no event at all'
);

-- A draft edit produces no event; sending it (draft -> scheduled) tells the sender only.
update public.letters set subject = 'edited' where id = '90000000-0000-0000-0000-000000000004';
select is(pg_temp.events('901', '4', 'letter_status'), 0::bigint, 'a draft edit produces no event');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000901","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.send_letter('90000000-0000-0000-0000-000000000004', now() + interval '1 day') $$, 'schedule the draft');
reset role;
select is(pg_temp.events('901', '4', 'letter_status'), 1::bigint, 'draft -> scheduled: the sender gets a letter_status event');
select is(pg_temp.events('902', '4', 'letter_delivered'), 0::bigint, 'and the recipient gets nothing yet');

-- ---------------------------------------------------------------------------------------------
-- Read events follow reciprocal read receipts; updated_at no longer reveals the read time
-- ---------------------------------------------------------------------------------------------
-- Letters 1 and 3 were both delivered by the job run above.
create temp table before_read as
  select id, updated_at from public.letters
  where id in ('90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003');

-- Both have receipts on: rob reads letter 1.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000902","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.mark_read('90000000-0000-0000-0000-000000000001') $$, 'rob marks letter 1 read');
reset role;
select is(pg_temp.events('902', '1', 'letter_read'), 1::bigint, 'receipts on: the recipient gets letter_read');
select is(pg_temp.events('901', '1', 'letter_read'), 1::bigint, 'receipts on both sides: the sender gets letter_read');

-- una has receipts off: una reads letter 3.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000903","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.mark_read('90000000-0000-0000-0000-000000000003') $$, 'una marks letter 3 read');
reset role;
select is(pg_temp.events('903', '3', 'letter_read'), 1::bigint, 'receipts off: the recipient still gets their own letter_read');
select is(pg_temp.events('901', '3', 'letter_read'), 0::bigint, 'receipts off: the sender gets no letter_read');

select ok(
  (select bool_and(l.updated_at = b.updated_at) from public.letters l join before_read b using (id)),
  'mark_read leaves updated_at unchanged on delivered letters'
);

-- Delete-for-me (Phase 9 sets these): only the person who deleted hears about it, and updated_at
-- stays put so the other side cannot see when.
update public.letters set recipient_deleted_at = now() where id = '90000000-0000-0000-0000-000000000003';
select is(pg_temp.events('903', '3', 'letter_deleted_for_me'), 1::bigint, 'recipient delete-for-me: the recipient gets an event');
select is(pg_temp.events('901', '3', 'letter_deleted_for_me'), 0::bigint, 'and the sender does not');
select ok(
  (select l.updated_at = b.updated_at from public.letters l join before_read b using (id)
   where l.id = '90000000-0000-0000-0000-000000000003'),
  'delete-for-me leaves updated_at unchanged'
);
select ok(
  (select updated_at > created_at from public.letters where id = '90000000-0000-0000-0000-000000000004'),
  'updated_at still advances on non-terminal letters'
);

-- ---------------------------------------------------------------------------------------------
-- realtime.messages policy: each user can receive only their own topic
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000902","role":"authenticated"}', true);
select set_config('realtime.topic', 'letters:00000000-0000-0000-0000-000000000902', true);
set local role authenticated;
select ok((select count(*) from realtime.messages) > 0, 'rob can receive on his own letters topic');
select set_config('realtime.topic', 'letters:00000000-0000-0000-0000-000000000901', true);
select is((select count(*)::int from realtime.messages), 0, 'rob sees nothing on sal''s letters topic');
select throws_ok(
  $$ insert into realtime.messages (topic, extension, event, payload, private)
     values ('letters:00000000-0000-0000-0000-000000000901', 'broadcast', 'letter_delivered', '{}', true) $$,
  '42501',
  null,
  'rob cannot send on sal''s letters topic'
);
select set_config('realtime.topic', 'letters:00000000-0000-0000-0000-000000000902', true);
select throws_ok(
  $$ insert into realtime.messages (topic, extension, event, payload, private)
     values ('letters:00000000-0000-0000-0000-000000000902', 'broadcast', 'letter_delivered', '{}', true) $$,
  '42501',
  null,
  'nor on his own (only the trigger publishes letter events)'
);
reset role;

select * from finish();
rollback;
