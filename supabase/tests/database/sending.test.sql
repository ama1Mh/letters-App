-- pgTAP tests for Phase 6 step 1 (20260925150000_letters_sending.sql, with send-now delivering
-- in the same transaction since 20260925160000_delivery.sql - see delivery.test.sql): send_letter(),
-- unschedule_letter(), mark_read(), get_letter_read_at(), read-receipt masking, the narrowed
-- delivered/undeliverable immutability trigger, the status-transition guard, and can_send()'s
-- deleted-account check. Threats from PLAN §6.6 in scope: sending to an invite-only user
-- without / with a pending / declined / accepted connection, after a block (either direction),
-- the recipient seeing a scheduled letter early, modifying a delivered letter, send rate limits.
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose: written without a local
-- Postgres to count against.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------------------------
-- Fixtures (as the table owner)
--   601 alice  sender under test                     607 gina   everyone, deleted account
--   602 bob    invite_only, no connection            608 hank   everyone, never onboarded
--   603 carol  everyone                              609 ivan   invite_only, declined alice
--   604 dave   invite_only, accepted with alice      610 jack   everyone, alice blocked jack
--   605 erin   invite_only, alice's request pending  611 kate   rate-limit sender
--   606 frank  everyone, frank blocked alice         612 lena   deleted sender
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000601', 's601@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000602', 's602@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000603', 's603@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000604', 's604@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000605', 's605@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000606', 's606@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000607', 's607@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000608', 's608@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000609', 's609@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000610', 's610@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000611', 's611@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000612', 's612@example.test', '{}');

update public.profiles as p
set username = v.username, display_name = v.display_name, receive_mode = v.mode::public.receive_mode,
    onboarded_at = now()
from (values
  ('00000000-0000-0000-0000-000000000601'::uuid, 'alice_six', 'Alice', 'invite_only'),
  ('00000000-0000-0000-0000-000000000602'::uuid, 'bob_six', 'Bob', 'invite_only'),
  ('00000000-0000-0000-0000-000000000603'::uuid, 'carol_six', 'Carol', 'everyone'),
  ('00000000-0000-0000-0000-000000000604'::uuid, 'dave_six', 'Dave', 'invite_only'),
  ('00000000-0000-0000-0000-000000000605'::uuid, 'erin_six', 'Erin', 'invite_only'),
  ('00000000-0000-0000-0000-000000000606'::uuid, 'frank_six', 'Frank', 'everyone'),
  ('00000000-0000-0000-0000-000000000607'::uuid, 'gina_six', 'Gina', 'everyone'),
  ('00000000-0000-0000-0000-000000000609'::uuid, 'ivan_six', 'Ivan', 'invite_only'),
  ('00000000-0000-0000-0000-000000000610'::uuid, 'jack_six', 'Jack', 'everyone'),
  ('00000000-0000-0000-0000-000000000611'::uuid, 'kate_six', 'Kate', 'everyone'),
  ('00000000-0000-0000-0000-000000000612'::uuid, 'lena_six', 'Lena', 'everyone')
) as v (id, username, display_name, mode)
where p.id = v.id;

update public.profiles set receive_mode = 'everyone' where id = '00000000-0000-0000-0000-000000000608';
update public.profiles set deleted_at = now()
  where id in ('00000000-0000-0000-0000-000000000607', '00000000-0000-0000-0000-000000000612');

insert into public.connections (requester_id, addressee_id, status, via, responded_at) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000604', 'accepted', 'request', now()),
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000605', 'pending', 'request', null),
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000609', 'declined', 'request', now());

insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-000000000606', '00000000-0000-0000-0000-000000000601'),
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000610');

insert into public.letters (id, sender_id, recipient_id, body) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000601', 'to me'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000603', 'to carol'),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000604', 'to dave'),
  ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000602', 'to bob'),
  ('60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000605', 'to erin'),
  ('60000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000609', 'to ivan'),
  ('60000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000606', 'to frank'),
  ('60000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000610', 'to jack'),
  ('60000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000607', 'to gina'),
  ('60000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000608', 'to hank'),
  ('60000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000601', null, 'no recipient'),
  ('60000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000603', ''),
  ('60000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000603', E' \n\t '),
  ('60000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000603', 'schedule range'),
  ('60000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000601', 'bob''s own draft'),
  ('60000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000612', '00000000-0000-0000-0000-000000000603', 'from a deleted account'),
  ('60000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000603', 'over the limit');

insert into public.letters (id, sender_id, recipient_id, body, status, delivered_at) values
  ('60000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000603', 'delivered 1', 'delivered', now()),
  ('60000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000603', 'delivered 2', 'delivered', now()),
  ('60000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000601', 'delivered to self', 'delivered', now());
insert into public.letters (id, sender_id, recipient_id, body, status) values
  ('60000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000603', 'undeliverable', 'undeliverable');

-- 30 drafts for the rate-limit test (kate -> carol).
insert into public.letters (sender_id, recipient_id, subject, body)
select '00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000603', 'batch', 'batch letter ' || n
from generate_series(1, 30) as n;

-- ---------------------------------------------------------------------------------------------
-- Structure and privileges
-- ---------------------------------------------------------------------------------------------
select has_type('public', 'letter_send_state', 'letter_send_state type exists');
select has_trigger('public', 'letters', 'letters_check_status_transition', 'status-transition guard trigger exists');
select ok(has_function_privilege('authenticated', 'public.send_letter(uuid, timestamptz)', 'execute'), 'authenticated can call send_letter');
select ok(has_function_privilege('authenticated', 'public.unschedule_letter(uuid)', 'execute'), 'authenticated can call unschedule_letter');
select ok(has_function_privilege('authenticated', 'public.mark_read(uuid)', 'execute'), 'authenticated can call mark_read');
select ok(has_function_privilege('authenticated', 'public.get_letter_read_at(uuid)', 'execute'), 'authenticated can call get_letter_read_at');
select ok(not has_function_privilege('anon', 'public.send_letter(uuid, timestamptz)', 'execute'), 'anon cannot call send_letter');
select ok(not has_function_privilege('anon', 'public.unschedule_letter(uuid)', 'execute'), 'anon cannot call unschedule_letter');
select ok(not has_function_privilege('anon', 'public.mark_read(uuid)', 'execute'), 'anon cannot call mark_read');
select ok(not has_function_privilege('anon', 'public.get_letter_read_at(uuid)', 'execute'), 'anon cannot call get_letter_read_at');
select ok(
  not has_function_privilege('authenticated', 'public.masked_read_at(uuid, uuid, uuid, public.letter_status, timestamptz)', 'execute'),
  'masked_read_at is internal only'
);
select ok(not has_function_privilege('authenticated', 'public.can_send(uuid, uuid, uuid)', 'execute'), 'can_send is still internal only');
select ok(not has_function_privilege('authenticated', 'public.letters_check_status_transition()', 'execute'), 'the transition trigger function is not callable by clients');
select ok(not has_column_privilege('authenticated', 'public.letters', 'read_at', 'select'), 'read_at is not selectable by clients');
select ok(not has_column_privilege('anon', 'public.letters', 'body', 'select'), 'anon still cannot select letters');
select ok(not has_column_privilege('authenticated', 'public.letters', 'status', 'update'), 'status is still not client-writable');
select ok(not has_column_privilege('authenticated', 'public.letters', 'scheduled_at', 'update'), 'scheduled_at is still not client-writable');
select ok(not has_column_privilege('authenticated', 'public.letters', 'read_at', 'update'), 'read_at is still not client-writable');

-- ---------------------------------------------------------------------------------------------
-- can_send(): deleted accounts (PLAN §3.3), as the table owner
-- ---------------------------------------------------------------------------------------------
select ok(public.can_send('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000603', null), 'control: alice may send to carol (everyone)');
select ok(not public.can_send('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000607', null), 'a deleted recipient cannot receive');
select ok(not public.can_send('00000000-0000-0000-0000-000000000612', '00000000-0000-0000-0000-000000000603', null), 'a deleted sender cannot send');
select ok(not public.can_send('00000000-0000-0000-0000-000000000607', '00000000-0000-0000-0000-000000000607', null), 'a deleted account cannot even write to itself');
select ok(not public.can_send('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000999', null), 'a nonexistent recipient is still rejected');

-- ---------------------------------------------------------------------------------------------
-- Unauthenticated and anon
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000002') $$, 'P0001', 'not_authenticated', 'send_letter without a user is rejected');
select throws_ok($$ select public.unschedule_letter('60000000-0000-0000-0000-000000000002') $$, 'P0001', 'not_authenticated', 'unschedule_letter without a user is rejected');
select throws_ok($$ select public.mark_read('60000000-0000-0000-0000-000000000016') $$, 'P0001', 'not_authenticated', 'mark_read without a user is rejected');
select throws_ok($$ select public.get_letter_read_at('60000000-0000-0000-0000-000000000016') $$, 'P0001', 'not_authenticated', 'get_letter_read_at without a user is rejected');
reset role;

set local role anon;
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000002') $$, '42501', null, 'anon cannot execute send_letter');
reset role;

-- ---------------------------------------------------------------------------------------------
-- send_letter as alice: allowed sends
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select row(s.status, s.scheduled_at, s.delivered_at)::text from public.send_letter('60000000-0000-0000-0000-000000000001') s),
  row('delivered'::public.letter_status, now(), now())::text,
  'send-now to yourself: delivered in the same transaction (DEC-044 (1))'
);
select is(
  (select s.scheduled_at from public.send_letter('60000000-0000-0000-0000-000000000002', now() + interval '1 day') s),
  now() + interval '1 day',
  'schedule to an everyone-mode recipient: scheduled for the requested time'
);
select is(
  (select s.status from public.send_letter('60000000-0000-0000-0000-000000000003') s),
  'delivered'::public.letter_status,
  'invite_only recipient with an accepted connection: allowed (send-now delivers)'
);
select is(
  (select status from public.letters where id = '60000000-0000-0000-0000-000000000002'),
  'scheduled'::public.letter_status,
  'the letter row itself is now scheduled'
);

-- Idempotency: replays return the current state and change nothing.
select is(
  (select s.scheduled_at from public.send_letter('60000000-0000-0000-0000-000000000002', now() + interval '2 days') s),
  now() + interval '1 day',
  'replaying send_letter with a different time returns the original schedule unchanged'
);
select is(
  (select s.status from public.send_letter('60000000-0000-0000-0000-000000000001') s),
  'delivered'::public.letter_status,
  'replaying send-now is not an error and returns the delivered state'
);
reset role;
select is(
  (select count from public.api_rate_limits
   where user_id = '00000000-0000-0000-0000-000000000601' and action = 'send_letter_hour'),
  3,
  'only the three real sends consumed the hourly rate limit, not the replays'
);
select is(
  (select count from public.api_rate_limits
   where user_id = '00000000-0000-0000-0000-000000000601' and action = 'send_letter_day'),
  3,
  'only the three real sends consumed the daily rate limit'
);

-- ---------------------------------------------------------------------------------------------
-- send_letter as alice: rejected sends
-- ---------------------------------------------------------------------------------------------
set local role authenticated;

select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000004') $$, 'P0001', 'cannot_send', 'invite_only recipient, no connection: rejected');
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000005') $$, 'P0001', 'cannot_send', 'invite_only recipient, pending request: rejected');
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000006') $$, 'P0001', 'cannot_send', 'invite_only recipient, declined request: rejected');
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000007') $$, 'P0001', 'cannot_send', 'recipient blocked the sender (everyone mode): rejected with the same neutral code');
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000008') $$, 'P0001', 'cannot_send', 'sender blocked the recipient: rejected with the same neutral code');
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000009') $$, 'P0001', 'cannot_send', 'deleted recipient: rejected with the same neutral code');
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000010') $$, 'P0001', 'cannot_send', 'recipient never onboarded: rejected with the same neutral code');
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000011') $$, 'P0001', 'recipient_required', 'a letter without a recipient cannot be sent');
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000012') $$, 'P0001', 'body_empty', 'an empty body cannot be sent');
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000013') $$, 'P0001', 'body_empty', 'a whitespace-only body cannot be sent');
select throws_ok(
  $$ select public.send_letter('60000000-0000-0000-0000-000000000014', now() - interval '1 minute') $$,
  'P0001', 'schedule_in_past', 'a time in the past is rejected'
);
select throws_ok(
  $$ select public.send_letter('60000000-0000-0000-0000-000000000014', now()) $$,
  'P0001', 'schedule_in_past', 'an explicit time equal to now() is rejected (send-now passes null)'
);
select throws_ok(
  $$ select public.send_letter('60000000-0000-0000-0000-000000000014', now() + interval '5 years' + interval '1 day') $$,
  'P0001', 'schedule_too_far', 'more than 5 years ahead is rejected'
);
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000015') $$, 'P0001', 'not_found', 'another user''s draft: not_found');
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-0000000009ff') $$, 'P0001', 'not_found', 'a nonexistent letter: not_found');
select throws_ok($$ select public.send_letter(null) $$, 'P0001', 'invalid_input', 'a null id is invalid_input');

select is(
  (select count(*)::int from public.letters
   where id between '60000000-0000-0000-0000-000000000004' and '60000000-0000-0000-0000-000000000014'
     and status = 'draft'),
  11,
  'every rejected send left its letter a draft'
);

select is(
  (select s.scheduled_at from public.send_letter('60000000-0000-0000-0000-000000000014', now() + interval '5 years' - interval '1 day') s),
  now() + interval '5 years' - interval '1 day',
  'a time just under 5 years ahead is accepted'
);

-- A scheduled letter is no longer client-editable (RLS: drafts only). Silently matches no rows.
select lives_ok(
  $$ update public.letters set body = 'sneaky edit' where id = '60000000-0000-0000-0000-000000000002' $$,
  'updating a scheduled letter directly is not an error...'
);
select is(
  (select body from public.letters where id = '60000000-0000-0000-0000-000000000002'),
  'to carol',
  '...and changes nothing'
);
select throws_ok(
  $$ select * from public.letters where id = '60000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'select * is refused (it includes read_at): clients must name their columns'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- Deleted sender, via the RPC (lena)
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000612","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000020') $$, 'P0001', 'cannot_send', 'a deleted sender cannot send');
reset role;

-- ---------------------------------------------------------------------------------------------
-- The recipient (carol) cannot see or act on a scheduled letter
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000603","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.letters where id = '60000000-0000-0000-0000-000000000002'),
  0,
  'the recipient cannot see a scheduled letter before delivery'
);
select throws_ok($$ select public.send_letter('60000000-0000-0000-0000-000000000002') $$, 'P0001', 'not_found', 'the recipient cannot call send_letter on it');
select throws_ok($$ select public.unschedule_letter('60000000-0000-0000-0000-000000000002') $$, 'P0001', 'not_found', 'the recipient cannot unschedule it');
select throws_ok($$ select public.mark_read('60000000-0000-0000-0000-000000000002') $$, 'P0001', 'not_found', 'the recipient cannot mark a scheduled letter read');
select throws_ok($$ select public.get_letter_read_at('60000000-0000-0000-0000-000000000002') $$, 'P0001', 'not_found', 'the recipient cannot read a scheduled letter''s read state');
reset role;

-- ---------------------------------------------------------------------------------------------
-- unschedule_letter as alice
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select row(s.status, s.scheduled_at, s.delivered_at)::text from public.unschedule_letter('60000000-0000-0000-0000-000000000002') s),
  row('draft'::public.letter_status, null::timestamptz, null::timestamptz)::text,
  'unschedule returns the draft state'
);
select is(
  (select row(status, scheduled_at)::text from public.letters where id = '60000000-0000-0000-0000-000000000002'),
  row('draft'::public.letter_status, null::timestamptz)::text,
  'the letter is a draft again with no scheduled time'
);
select is(
  (select s.status from public.unschedule_letter('60000000-0000-0000-0000-000000000002') s),
  'draft'::public.letter_status,
  'unscheduling a draft again is an idempotent no-op'
);
select lives_ok(
  $$ update public.letters set body = 'to carol, edited' where id = '60000000-0000-0000-0000-000000000002' $$,
  'the unscheduled letter is editable as a draft again'
);
select is(
  (select body from public.letters where id = '60000000-0000-0000-0000-000000000002'),
  'to carol, edited',
  'the edit took effect'
);
select is(
  (select s.scheduled_at from public.send_letter('60000000-0000-0000-0000-000000000002', now() + interval '1 hour') s),
  now() + interval '1 hour',
  'the edited letter can be sent again'
);
select throws_ok($$ select public.unschedule_letter('60000000-0000-0000-0000-000000000016') $$, 'P0001', 'already_delivered', 'a delivered letter cannot be unscheduled');
select throws_ok($$ select public.unschedule_letter('60000000-0000-0000-0000-000000000018') $$, 'P0001', 'not_scheduled', 'an undeliverable letter cannot be unscheduled');
select throws_ok($$ select public.unschedule_letter('60000000-0000-0000-0000-000000000015') $$, 'P0001', 'not_found', 'another user''s letter cannot be unscheduled');
select throws_ok($$ select public.unschedule_letter(null) $$, 'P0001', 'invalid_input', 'unschedule with a null id is invalid_input');
select is(
  (select s.status from public.send_letter('60000000-0000-0000-0000-000000000016') s),
  'delivered'::public.letter_status,
  'send_letter on a delivered letter returns its state (idempotent), not an error'
);
select is(
  (select s.status from public.send_letter('60000000-0000-0000-0000-000000000018') s),
  'undeliverable'::public.letter_status,
  'send_letter on an undeliverable letter returns its state, not an error'
);

-- ---------------------------------------------------------------------------------------------
-- mark_read and read-receipt masking
-- ---------------------------------------------------------------------------------------------
select throws_ok($$ select public.mark_read('60000000-0000-0000-0000-000000000016') $$, 'P0001', 'not_found', 'the sender cannot mark the recipient''s letter read');
select is(public.get_letter_read_at('60000000-0000-0000-0000-000000000016'), null::timestamptz, 'sender: unread letter has no read time');
select is(public.get_letter_read_at('60000000-0000-0000-0000-000000000002'), null::timestamptz, 'sender: a scheduled letter has no read time');
select throws_ok($$ select read_at from public.letters where id = '60000000-0000-0000-0000-000000000016' $$, '42501', null, 'the sender cannot select read_at directly');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.mark_read('60000000-0000-0000-0000-000000000016') $$, 'P0001', 'not_found', 'a third party cannot mark a letter read');
select throws_ok($$ select public.get_letter_read_at('60000000-0000-0000-0000-000000000016') $$, 'P0001', 'not_found', 'a third party cannot see read state');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000603","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select read_at from public.letters where id = '60000000-0000-0000-0000-000000000016' $$, '42501', null, 'the recipient cannot select read_at directly either');
select is(public.get_letter_read_at('60000000-0000-0000-0000-000000000016'), null::timestamptz, 'recipient: unread before mark_read');
select isnt(public.mark_read('60000000-0000-0000-0000-000000000016'), null::timestamptz, 'the recipient can mark a delivered letter read');
select is(
  public.mark_read('60000000-0000-0000-0000-000000000016'),
  public.get_letter_read_at('60000000-0000-0000-0000-000000000016'),
  'mark_read is idempotent and matches what the recipient sees'
);
reset role;

-- Delete-for-me hides a letter from mark_read, like it hides it from the recipient's SELECT.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000603","role":"authenticated"}', true);
set local role authenticated;
select isnt(public.mark_read('60000000-0000-0000-0000-000000000017'), null::timestamptz, 'the recipient marks a second letter read');
reset role;
update public.letters set recipient_deleted_at = now() where id = '60000000-0000-0000-0000-000000000017';
set local role authenticated;
select throws_ok($$ select public.mark_read('60000000-0000-0000-0000-000000000017') $$, 'P0001', 'not_found', 'a letter deleted-for-me cannot be marked read');
select throws_ok($$ select public.mark_read(null) $$, 'P0001', 'invalid_input', 'mark_read with a null id is invalid_input');
reset role;

-- Reciprocal masking, seen by the sender.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
set local role authenticated;
select isnt(public.get_letter_read_at('60000000-0000-0000-0000-000000000016'), null::timestamptz, 'sender sees the read receipt when both have read receipts on');
reset role;

update public.profiles set read_receipts_enabled = false where id = '00000000-0000-0000-0000-000000000603';
set local role authenticated;
select is(public.get_letter_read_at('60000000-0000-0000-0000-000000000016'), null::timestamptz, 'sender does not see it when the recipient turned read receipts off');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000603","role":"authenticated"}', true);
set local role authenticated;
select isnt(public.get_letter_read_at('60000000-0000-0000-0000-000000000016'), null::timestamptz, 'the recipient always sees their own read state');
reset role;

update public.profiles set read_receipts_enabled = true where id = '00000000-0000-0000-0000-000000000603';
update public.profiles set read_receipts_enabled = false where id = '00000000-0000-0000-0000-000000000601';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
set local role authenticated;
select is(public.get_letter_read_at('60000000-0000-0000-0000-000000000016'), null::timestamptz, 'reciprocal: a sender with read receipts off does not see others'' receipts');
select isnt(public.mark_read('60000000-0000-0000-0000-000000000019'), null::timestamptz, 'a letter to yourself can be marked read');
select isnt(public.get_letter_read_at('60000000-0000-0000-0000-000000000019'), null::timestamptz, 'your own letter to yourself always shows its read state');
reset role;
update public.profiles set read_receipts_enabled = true where id = '00000000-0000-0000-0000-000000000601';

-- ---------------------------------------------------------------------------------------------
-- Immutability and status transitions, as the table owner (bypasses RLS: the triggers alone)
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$ update public.letters set read_at = null where id = '60000000-0000-0000-0000-000000000016' $$,
  'P0001', 'delivered_immutable', 'a set read_at cannot be cleared'
);
select throws_ok(
  $$ update public.letters set read_at = now() + interval '1 hour' where id = '60000000-0000-0000-0000-000000000016' $$,
  'P0001', 'delivered_immutable', 'a set read_at cannot be changed'
);
select throws_ok(
  $$ update public.letters set body = 'tampered' where id = '60000000-0000-0000-0000-000000000016' $$,
  'P0001', 'delivered_immutable', 'a delivered letter''s body stays immutable'
);
select throws_ok(
  $$ update public.letters set design = jsonb_set(design, '{ink}', '"navy"') where id = '60000000-0000-0000-0000-000000000016' $$,
  'P0001', 'delivered_immutable', 'a delivered letter''s design stays immutable'
);
select throws_ok(
  $$ update public.letters set delivered_at = now() - interval '1 day' where id = '60000000-0000-0000-0000-000000000016' $$,
  'P0001', 'delivered_immutable', 'delivered_at stays immutable'
);
select throws_ok(
  $$ update public.letters set status = 'draft' where id = '60000000-0000-0000-0000-000000000016' $$,
  'P0001', 'invalid_status_transition', 'delivered cannot go back to draft'
);
select lives_ok(
  $$ update public.letters set sender_deleted_at = now() where id = '60000000-0000-0000-0000-000000000016' $$,
  'sender_deleted_at can be set on a delivered letter (delete-for-me, Phase 9)'
);
select throws_ok(
  $$ update public.letters set sender_deleted_at = null where id = '60000000-0000-0000-0000-000000000016' $$,
  'P0001', 'delivered_immutable', 'sender_deleted_at cannot be cleared again'
);
select lives_ok(
  $$ update public.letters set recipient_deleted_at = now() where id = '60000000-0000-0000-0000-000000000016' $$,
  'recipient_deleted_at can be set on a delivered letter'
);
select throws_ok(
  $$ update public.letters set read_at = now() where id = '60000000-0000-0000-0000-000000000018' $$,
  'P0001', 'delivered_immutable', 'an undeliverable letter can never get a read time'
);
select throws_ok(
  $$ update public.letters set body = 'tampered' where id = '60000000-0000-0000-0000-000000000018' $$,
  'P0001', 'delivered_immutable', 'an undeliverable letter''s content is immutable'
);
select throws_ok(
  $$ update public.letters set status = 'scheduled', scheduled_at = now() where id = '60000000-0000-0000-0000-000000000018' $$,
  'P0001', 'invalid_status_transition', 'undeliverable is terminal'
);
select lives_ok(
  $$ update public.letters set sender_deleted_at = now() where id = '60000000-0000-0000-0000-000000000018' $$,
  'the sender can still delete-for-me an undeliverable letter'
);
select throws_ok(
  $$ update public.letters set status = 'delivered', delivered_at = now() where id = '60000000-0000-0000-0000-000000000004' $$,
  'P0001', 'invalid_status_transition', 'draft cannot jump straight to delivered'
);
select throws_ok(
  $$ update public.letters set status = 'undeliverable' where id = '60000000-0000-0000-0000-000000000004' $$,
  'P0001', 'invalid_status_transition', 'draft cannot jump straight to undeliverable'
);
select throws_ok(
  $$ update public.letters set status = 'delivered' where id = '60000000-0000-0000-0000-000000000002' $$,
  'P0001', 'invalid_status_transition', 'delivered requires delivered_at'
);
select lives_ok(
  $$ update public.letters set status = 'delivered', delivered_at = now() where id = '60000000-0000-0000-0000-000000000002' $$,
  'scheduled -> delivered with delivered_at is a valid transition'
);

-- ---------------------------------------------------------------------------------------------
-- Rate limit (provisional OPEN-5 numbers: 30/hour), kate -> carol
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.send_letter(id) from public.letters
     where sender_id = '00000000-0000-0000-0000-000000000611' and subject = 'batch' $$,
  '30 sends within the hour are allowed'
);
select is(
  (select count(*)::int from public.letters
   where sender_id = '00000000-0000-0000-0000-000000000611' and subject = 'batch' and status = 'delivered'),
  30,
  'all 30 are sent (send-now delivers)'
);
select throws_ok(
  $$ select public.send_letter('60000000-0000-0000-0000-000000000021') $$,
  'P0001', 'rate_limited', 'the 31st send within the hour is rate-limited'
);
select is(
  (select status from public.letters where id = '60000000-0000-0000-0000-000000000021'),
  'draft'::public.letter_status,
  'the rate-limited letter stays a draft'
);
reset role;

select * from finish();
rollback;
