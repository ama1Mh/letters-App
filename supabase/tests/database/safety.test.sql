-- pgTAP tests for Phase 9 (20260929140000_safety.sql): private delete-for-me (column privileges +
-- delete_letter_for_me), reports (no client access, report_user rules) and delete_my_account.
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose, as in the other files.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------------------------
-- Fixtures (as the table owner): f01 amy, f02 ben, f03 cat - all onboarded, receive everyone.
--   f..01 amy -> ben delivered      f..02 ben -> amy delivered      f..03 amy -> ben undeliverable
--   f..04 amy -> ben scheduled      f..05 amy draft                 f..06 amy -> amy delivered
--   f..07 cat -> ben delivered      f..08 cat -> amy scheduled      f..09 cat draft
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000f01', 'f01@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000f02', 'f02@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000f03', 'f03@example.test', '{}');

update public.profiles as p
set username = v.username, display_name = v.display_name, receive_mode = 'everyone', onboarded_at = now()
from (values
  ('00000000-0000-0000-0000-000000000f01'::uuid, 'amy_safe', 'Amy Realname'),
  ('00000000-0000-0000-0000-000000000f02'::uuid, 'ben_safe', 'Ben Realname'),
  ('00000000-0000-0000-0000-000000000f03'::uuid, 'cat_safe', 'Cat Realname')
) as v (id, username, display_name)
where p.id = v.id;

insert into public.letters (id, sender_id, recipient_id, body, status, scheduled_at, delivered_at) values
  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000f02', 'one', 'delivered', now() - interval '3 hours', now() - interval '3 hours'),
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000f02', '00000000-0000-0000-0000-000000000f01', 'two', 'delivered', now() - interval '2 hours', now() - interval '2 hours'),
  ('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000f02', 'three', 'undeliverable', now() - interval '1 hour', null),
  ('f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000f02', 'four', 'scheduled', now() + interval '1 hour', null),
  ('f0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000f01', 'self', 'delivered', now() - interval '30 minutes', now() - interval '30 minutes'),
  ('f0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000f03', '00000000-0000-0000-0000-000000000f02', 'cat to ben', 'delivered', now() - interval '20 minutes', now() - interval '20 minutes'),
  ('f0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000f03', '00000000-0000-0000-0000-000000000f01', 'cat later', 'scheduled', now() + interval '2 hours', null);
insert into public.letters (id, sender_id, recipient_id, body) values
  ('f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000f02', 'draft'),
  ('f0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000f03', null, 'cat draft');

insert into public.invites (owner_id, code) values ('00000000-0000-0000-0000-000000000f03', 'CATCODE234');
insert into public.connections (requester_id, addressee_id, status, via, responded_at) values
  ('00000000-0000-0000-0000-000000000f03', '00000000-0000-0000-0000-000000000f01', 'accepted', 'request', now());
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-000000000f03', '00000000-0000-0000-0000-000000000f02');

-- ---------------------------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------------------------
select ok(not has_column_privilege('authenticated', 'public.letters', 'sender_deleted_at', 'select'),
  'sender_deleted_at is not selectable (delete-for-me is private)');
select ok(not has_column_privilege('authenticated', 'public.letters', 'recipient_deleted_at', 'select'),
  'recipient_deleted_at is not selectable (delete-for-me is private)');
select ok(has_column_privilege('authenticated', 'public.letters', 'body', 'select'), 'other columns stay selectable');
select ok((select relrowsecurity from pg_class where oid = 'public.reports'::regclass), 'RLS is enabled on reports');
select policies_are('public', 'reports', array[]::name[], 'reports has no policies (default deny)');
select ok(not has_table_privilege('authenticated', 'public.reports', 'select'), 'clients cannot read reports');
select ok(not has_table_privilege('authenticated', 'public.reports', 'insert'), 'clients cannot insert reports directly');
select ok(not has_table_privilege('anon', 'public.reports', 'select'), 'anon cannot read reports');
select ok(has_function_privilege('authenticated', 'public.delete_letter_for_me(uuid)', 'execute'), 'authenticated can delete for me');
select ok(has_function_privilege('authenticated', 'public.report_user(uuid, public.report_reason, uuid, text)', 'execute'), 'authenticated can report');
select ok(has_function_privilege('authenticated', 'public.delete_my_account()', 'execute'), 'authenticated can delete their account');
select ok(not has_function_privilege('anon', 'public.delete_letter_for_me(uuid)', 'execute'), 'anon cannot delete for me');
select ok(not has_function_privilege('anon', 'public.report_user(uuid, public.report_reason, uuid, text)', 'execute'), 'anon cannot report');
select ok(not has_function_privilege('anon', 'public.delete_my_account()', 'execute'), 'anon cannot delete an account');

-- ---------------------------------------------------------------------------------------------
-- delete_letter_for_me, as amy
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000f01","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$ select public.delete_letter_for_me('f0000000-0000-0000-0000-000000000002') $$,
  'the recipient can delete a delivered letter for themselves');
select lives_ok($$ select public.delete_letter_for_me('f0000000-0000-0000-0000-000000000001') $$,
  'the sender can delete a delivered letter for themselves');
select lives_ok($$ select public.delete_letter_for_me('f0000000-0000-0000-0000-000000000003') $$,
  'the sender can delete an undeliverable letter for themselves');
select lives_ok($$ select public.delete_letter_for_me('f0000000-0000-0000-0000-000000000006') $$,
  'a letter to yourself can be deleted');
select throws_ok($$ select public.delete_letter_for_me('f0000000-0000-0000-0000-000000000004') $$,
  'P0001', 'not_found', 'a scheduled letter is unscheduled, not deleted-for-me');
select throws_ok($$ select public.delete_letter_for_me('f0000000-0000-0000-0000-000000000005') $$,
  'P0001', 'not_found', 'a draft is deleted normally, not deleted-for-me');
select throws_ok($$ select public.delete_letter_for_me('f0000000-0000-0000-0000-000000000007') $$,
  'P0001', 'not_found', 'someone else''s letter: not_found');
select throws_ok($$ select public.delete_letter_for_me('f0000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_found', 'deleting again: not_found (it is no longer visible)');
select throws_ok($$ select public.delete_letter_for_me(null) $$,
  'P0001', 'invalid_input', 'a null id is invalid_input');

select ok(
  not exists (select 1 from public.list_inbox() where id = 'f0000000-0000-0000-0000-000000000002'),
  'amy''s inbox no longer lists the letter she deleted'
);
select ok(
  not exists (select 1 from public.list_sent('sent') where id = 'f0000000-0000-0000-0000-000000000001'),
  'amy''s sent list no longer lists the letter she deleted'
);
select throws_ok(
  $$ select recipient_deleted_at from public.letters where id = 'f0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'amy cannot select ben''s delete-for-me timestamp'
);

reset role;
select ok(
  (select sender_deleted_at is not null and recipient_deleted_at is null
   from public.letters where id = 'f0000000-0000-0000-0000-000000000001'),
  'only the deleter''s side is set (the recipient''s side untouched)'
);
select ok(
  (select sender_deleted_at is not null and recipient_deleted_at is not null
   from public.letters where id = 'f0000000-0000-0000-0000-000000000006'),
  'a letter to yourself is deleted on both sides at once'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000f02","role":"authenticated"}', true);
set local role authenticated;
select ok(
  exists (select 1 from public.list_inbox() where id = 'f0000000-0000-0000-0000-000000000001'),
  'ben still has the letter amy deleted for herself'
);
select ok(
  exists (select 1 from public.list_sent('sent') where id = 'f0000000-0000-0000-0000-000000000002'),
  'ben still has the letter amy deleted from her inbox'
);
select ok(
  exists (select 1 from public.letters where id = 'f0000000-0000-0000-0000-000000000001'),
  'RLS still shows ben his delivered letter (the policy reads recipient_deleted_at without a grant)'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- report_user, as amy
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000f01","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$ select public.report_user('00000000-0000-0000-0000-000000000f02', 'spam') $$,
  'amy can report ben');
select lives_ok(
  $$ select public.report_user('00000000-0000-0000-0000-000000000f02', 'harassment',
       'f0000000-0000-0000-0000-000000000002', '  rude letter  ') $$,
  'amy can report ben about a letter ben sent her');
select throws_ok(
  $$ select public.report_user('00000000-0000-0000-0000-000000000f02', 'spam', 'f0000000-0000-0000-0000-000000000007') $$,
  'P0001', 'not_found', 'a letter amy cannot see (cat -> ben) cannot be attached');
select throws_ok(
  $$ select public.report_user('00000000-0000-0000-0000-000000000f01', 'spam') $$,
  'P0001', 'invalid_input', 'nobody can report themselves');
select throws_ok(
  $$ select public.report_user('00000000-0000-0000-0000-00000000ffff', 'spam') $$,
  'P0001', 'not_found', 'an unknown user: not_found');
select throws_ok(
  $$ select public.report_user('00000000-0000-0000-0000-000000000f02', 'other', null, repeat('x', 501)) $$,
  'P0001', 'invalid_input', 'details are capped at 500 characters');
select throws_ok($$ select * from public.reports $$, '42501', null, 'amy cannot read any report');

reset role;
select is((select count(*)::int from public.reports where reporter_id = '00000000-0000-0000-0000-000000000f01'), 2,
  'two reports were stored');
select is(
  (select details from public.reports where letter_id = 'f0000000-0000-0000-0000-000000000002'),
  'rude letter',
  'details are trimmed'
);

-- ---------------------------------------------------------------------------------------------
-- delete_my_account, as cat
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000f03","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.delete_my_account() $$, 'cat can delete her account');
select lives_ok($$ select public.delete_my_account() $$, 'deleting again is harmless (idempotent)');
reset role;

select ok(
  (select deleted_at is not null and display_name = 'cat_safe' and avatar_key is null
     and not discoverable_by_username and not discoverable_by_email and not read_receipts_enabled
   from public.profiles where id = '00000000-0000-0000-0000-000000000f03'),
  'the profile is marked deleted and anonymized (real display name replaced by the username)'
);
select ok(
  not exists (select 1 from public.letters where id in ('f0000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000009')),
  'her draft and her never-delivered scheduled letter are gone'
);
select ok(
  exists (select 1 from public.letters where id = 'f0000000-0000-0000-0000-000000000007'),
  'her delivered letter stays with its recipient'
);
select is((select count(*)::int from public.invites where owner_id = '00000000-0000-0000-0000-000000000f03'), 0, 'her invites are gone');
select is((select count(*)::int from public.connections where requester_id = '00000000-0000-0000-0000-000000000f03' or addressee_id = '00000000-0000-0000-0000-000000000f03'), 0, 'her connections are gone');
select is((select count(*)::int from public.blocks where blocker_id = '00000000-0000-0000-0000-000000000f03' or blocked_id = '00000000-0000-0000-0000-000000000f03'), 0, 'her blocks are gone');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000f02","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select sender_username from public.list_inbox() where id = 'f0000000-0000-0000-0000-000000000007'),
  null,
  'ben sees her letter from a deleted account (no name)'
);
select is_empty($$ select 1 from public.search_users('cat_') $$, 'a deleted account cannot be found by username');
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.delete_my_account() $$, 'P0001', 'not_authenticated', 'no user: not_authenticated');
select throws_ok($$ select public.delete_letter_for_me('f0000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_authenticated', 'delete-for-me without a user: not_authenticated');
select throws_ok($$ select public.report_user('00000000-0000-0000-0000-000000000f02', 'spam') $$,
  'P0001', 'not_authenticated', 'report without a user: not_authenticated');
reset role;

select * from finish();
rollback;
