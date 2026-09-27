-- pgTAP tests for Phase 6 step 3B / M0 (20260927090000_letter_lists.sql): list_inbox(),
-- list_sent() and get_letter(). Covers who sees which letters (recipient never sees scheduled,
-- undeliverable or deleted-for-me letters; drafts are never returned), reciprocal read-receipt
-- masking in all four setting combinations, the other person's profile fields (null for a
-- deleted account, no email anywhere), keyset paging, limit clamping, error codes, and that
-- letters stay visible after a block (owner decision 2026-09-27).
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose, as in the other files.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------------------------
-- Fixtures (as the table owner)
--   b01 amy  sender under test, receipts on      b04 dan  account deleted after sending to ben
--   b02 ben  recipient, receipts on              b05 eve  unrelated user
--   b03 cat  recipient, receipts OFF             b06 fay  blocked amy after amy's letter arrived
-- Letters (amy -> ben unless noted; times relative to now()):
--   b..01 delivered -3h, read            b..08 delivered -5h, amy deleted it for herself
--   b..02 delivered -2h, long body       b..09 amy -> cat, delivered -90m, read
--   b..03 delivered -1h                  b..10 dan -> ben, delivered -6h
--   b..04 scheduled +1h                  b..11 amy -> fay, delivered -7h
--   b..05 undeliverable, due -30m        b..12 scheduled +2h
--   b..06 draft                          b..13 amy -> amy, delivered -10m, read
--   b..07 delivered -4h, ben deleted it for himself
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000b01', 'b01@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000b02', 'b02@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000b03', 'b03@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000b04', 'b04@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000b05', 'b05@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000b06', 'b06@example.test', '{}');

update public.profiles as p
set username = v.username, display_name = v.display_name, receive_mode = 'everyone',
    read_receipts_enabled = v.receipts, onboarded_at = now()
from (values
  ('00000000-0000-0000-0000-000000000b01'::uuid, 'amy_lists', 'Amy', true),
  ('00000000-0000-0000-0000-000000000b02'::uuid, 'ben_lists', 'Ben', true),
  ('00000000-0000-0000-0000-000000000b03'::uuid, 'cat_lists', 'Cat', false),
  ('00000000-0000-0000-0000-000000000b04'::uuid, 'dan_lists', 'Dan', true),
  ('00000000-0000-0000-0000-000000000b05'::uuid, 'eve_lists', 'Eve', true),
  ('00000000-0000-0000-0000-000000000b06'::uuid, 'fay_lists', 'Fay', true)
) as v (id, username, display_name, receipts)
where p.id = v.id;

insert into public.letters (id, sender_id, recipient_id, subject, body, status, scheduled_at, delivered_at, read_at) values
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b02', 'one', E'Hello\n\n  world \t again', 'delivered', now() - interval '3 hours', now() - interval '3 hours', now() - interval '2 hours'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b02', 'two', repeat('x', 500), 'delivered', now() - interval '2 hours', now() - interval '2 hours', null),
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b02', 'three', 'body three', 'delivered', now() - interval '1 hour', now() - interval '1 hour', null),
  ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b02', 'four', 'secret scheduled body', 'scheduled', now() + interval '1 hour', null, null),
  ('b0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b02', 'five', 'undeliverable body', 'undeliverable', now() - interval '30 minutes', null, null),
  ('b0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b02', 'seven', 'body seven', 'delivered', now() - interval '4 hours', now() - interval '4 hours', null),
  ('b0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b02', 'eight', 'body eight', 'delivered', now() - interval '5 hours', now() - interval '5 hours', null),
  ('b0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b03', 'nine', 'body nine', 'delivered', now() - interval '90 minutes', now() - interval '90 minutes', now() - interval '80 minutes'),
  ('b0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000b04', '00000000-0000-0000-0000-000000000b02', 'ten', 'body ten', 'delivered', now() - interval '6 hours', now() - interval '6 hours', null),
  ('b0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b06', 'eleven', 'body eleven', 'delivered', now() - interval '7 hours', now() - interval '7 hours', null),
  ('b0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b02', 'twelve', 'body twelve', 'scheduled', now() + interval '2 hours', null, null),
  ('b0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b01', 'thirteen', 'note to self', 'delivered', now() - interval '10 minutes', now() - interval '10 minutes', now() - interval '5 minutes');
insert into public.letters (id, sender_id, recipient_id, subject, body) values
  ('b0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b02', 'six', 'draft body');

-- Deleted-for-me, deleted account and a block after delivery (all set as the owner).
update public.letters set recipient_deleted_at = now() where id = 'b0000000-0000-0000-0000-000000000007';
update public.letters set sender_deleted_at = now() where id = 'b0000000-0000-0000-0000-000000000008';
update public.profiles set deleted_at = now() where id = '00000000-0000-0000-0000-000000000b04';
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-000000000b06', '00000000-0000-0000-0000-000000000b01');

-- ---------------------------------------------------------------------------------------------
-- Structure and privileges
-- ---------------------------------------------------------------------------------------------
select has_function('public', 'list_inbox', array['timestamp with time zone', 'uuid', 'integer'], 'list_inbox exists');
select has_function('public', 'list_sent', array['text', 'timestamp with time zone', 'uuid', 'integer'], 'list_sent exists');
select has_function('public', 'get_letter', array['uuid'], 'get_letter exists');
select ok(has_function_privilege('authenticated', 'public.list_inbox(timestamptz, uuid, int)', 'execute'), 'authenticated can call list_inbox');
select ok(has_function_privilege('authenticated', 'public.list_sent(text, timestamptz, uuid, int)', 'execute'), 'authenticated can call list_sent');
select ok(has_function_privilege('authenticated', 'public.get_letter(uuid)', 'execute'), 'authenticated can call get_letter');
select ok(not has_function_privilege('anon', 'public.list_inbox(timestamptz, uuid, int)', 'execute'), 'anon cannot call list_inbox');
select ok(not has_function_privilege('anon', 'public.list_sent(text, timestamptz, uuid, int)', 'execute'), 'anon cannot call list_sent');
select ok(not has_function_privilege('anon', 'public.get_letter(uuid)', 'execute'), 'anon cannot call get_letter');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p where p.oid in ('public.list_inbox(timestamptz, uuid, int)'::regprocedure,
     'public.list_sent(text, timestamptz, uuid, int)'::regprocedure, 'public.get_letter(uuid)'::regprocedure)),
  'all three are SECURITY DEFINER with an empty search_path'
);
select ok(
  (select bool_and(not exists (select 1 from unnest(p.proargnames) a where a ilike '%email%'))
   from pg_proc p where p.proname in ('list_inbox', 'list_sent', 'get_letter') and p.pronamespace = 'public'::regnamespace),
  'no function returns or takes an email column'
);
select ok(not has_column_privilege('authenticated', 'public.letters', 'read_at', 'select'), 'read_at is still not selectable directly');

-- ---------------------------------------------------------------------------------------------
-- Unauthenticated and invalid input
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.list_inbox() $$, 'P0001', 'not_authenticated', 'list_inbox without a user is rejected');
select throws_ok($$ select * from public.list_sent('sent') $$, 'P0001', 'not_authenticated', 'list_sent without a user is rejected');
select throws_ok($$ select * from public.get_letter('b0000000-0000-0000-0000-000000000001') $$, 'P0001', 'not_authenticated', 'get_letter without a user is rejected');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b02","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.list_inbox(now(), null) $$, 'P0001', 'invalid_input', 'list_inbox: a cursor time without an id is invalid_input');
select throws_ok($$ select * from public.list_inbox(null, 'b0000000-0000-0000-0000-000000000001') $$, 'P0001', 'invalid_input', 'list_inbox: a cursor id without a time is invalid_input');
select throws_ok($$ select * from public.list_sent('drafts') $$, 'P0001', 'invalid_input', 'list_sent: an unknown kind is invalid_input');
select throws_ok($$ select * from public.list_sent(null) $$, 'P0001', 'invalid_input', 'list_sent: a null kind is invalid_input');
select throws_ok($$ select * from public.list_sent('sent', now(), null) $$, 'P0001', 'invalid_input', 'list_sent: a half cursor is invalid_input');
select throws_ok($$ select * from public.get_letter(null) $$, 'P0001', 'invalid_input', 'get_letter(null) is invalid_input');

-- ---------------------------------------------------------------------------------------------
-- list_inbox as ben (recipient)
-- ---------------------------------------------------------------------------------------------
select is(
  array(select id from public.list_inbox()),
  array['b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000008',
        'b0000000-0000-0000-0000-000000000010']::uuid[],
  'inbox: delivered letters only, newest first; no scheduled, undeliverable, draft or deleted-for-me letters'
);
select ok(
  not exists (select 1 from public.list_inbox() where id in (
    'b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000012')),
  'inbox: a scheduled letter is not visible to its recipient early'
);
select ok(
  exists (select 1 from public.list_inbox() where id = 'b0000000-0000-0000-0000-000000000008'),
  'inbox: the sender deleting a letter for themselves does not remove it from the recipient'
);
select is(
  (select preview from public.list_inbox() where id = 'b0000000-0000-0000-0000-000000000001'),
  'Hello world again',
  'inbox: the preview collapses whitespace'
);
select is(
  (select char_length(preview) from public.list_inbox() where id = 'b0000000-0000-0000-0000-000000000002'),
  200,
  'inbox: the preview is at most 200 characters'
);
select ok(
  (select read_at is not null from public.list_inbox() where id = 'b0000000-0000-0000-0000-000000000001')
  and (select read_at is null from public.list_inbox() where id = 'b0000000-0000-0000-0000-000000000002'),
  'inbox: the recipient sees their own read state'
);
select is(
  (select row(sender_username, sender_display_name)::text from public.list_inbox() where id = 'b0000000-0000-0000-0000-000000000001'),
  row('amy_lists', 'Amy')::text,
  'inbox: the sender''s username and display name are included without a connection'
);
select is(
  (select row(sender_id, sender_username, sender_display_name, sender_avatar_key)::text
   from public.list_inbox() where id = 'b0000000-0000-0000-0000-000000000010'),
  row('00000000-0000-0000-0000-000000000b04'::uuid, null::text, null::text, null::text)::text,
  'inbox: a deleted sender''s profile fields are null (the letter stays)'
);
select ok(
  (select bool_and(sort_at = delivered_at) from public.list_inbox()),
  'inbox: sort_at is delivered_at'
);

-- Paging (limit 2): 03, 02 | 01, 08 | 10 | nothing.
select is(
  array(select id from public.list_inbox(null, null, 2)),
  array['b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002']::uuid[],
  'inbox paging: first page'
);
select is(
  array(select id from public.list_inbox(
    (select delivered_at from public.letters where id = 'b0000000-0000-0000-0000-000000000002'),
    'b0000000-0000-0000-0000-000000000002', 2)),
  array['b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000008']::uuid[],
  'inbox paging: second page starts after the cursor'
);
select is(
  array(select id from public.list_inbox(
    (select delivered_at from public.letters where id = 'b0000000-0000-0000-0000-000000000008'),
    'b0000000-0000-0000-0000-000000000008', 2)),
  array['b0000000-0000-0000-0000-000000000010']::uuid[],
  'inbox paging: last page'
);
select is(
  (select count(*)::int from public.list_inbox(
    (select delivered_at from public.letters where id = 'b0000000-0000-0000-0000-000000000010'),
    'b0000000-0000-0000-0000-000000000010', 2)),
  0,
  'inbox paging: nothing after the last row'
);
select is((select count(*)::int from public.list_inbox(null, null, 0)), 1, 'inbox: a limit below 1 is clamped to 1');
select is((select count(*)::int from public.list_inbox(null, null, 1000)), 5, 'inbox: a large limit is clamped (to 100) without error');
select is((select count(*)::int from public.list_inbox(null, null, null)), 5, 'inbox: a null limit uses the default');

-- list_sent as ben: he sent nothing.
select is((select count(*)::int from public.list_sent('sent')), 0, 'ben has no sent letters');
select is((select count(*)::int from public.list_sent('scheduled')), 0, 'ben has no scheduled letters');
reset role;

-- ---------------------------------------------------------------------------------------------
-- list_sent as amy (sender)
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b01","role":"authenticated"}', true);
set local role authenticated;
select is(
  array(select id from public.list_sent('sent')),
  array['b0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000005',
        'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000009',
        'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000011']::uuid[],
  'sent: delivered and undeliverable, newest first; no drafts, no scheduled, not deleted-for-me'
);
select is(
  (select row(status, sort_at = scheduled_at, delivered_at)::text from public.list_sent('sent')
   where id = 'b0000000-0000-0000-0000-000000000005'),
  row('undeliverable'::public.letter_status, true, null::timestamptz)::text,
  'sent: an undeliverable letter is listed by its due time'
);
select ok(
  exists (select 1 from public.list_sent('sent') where id = 'b0000000-0000-0000-0000-000000000007'),
  'sent: the recipient deleting a letter for themselves does not remove it from the sender'
);
select is(
  array(select id from public.list_sent('scheduled')),
  array['b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000012']::uuid[],
  'scheduled: scheduled letters only, soonest first'
);
select is(
  array(select id from public.list_sent('scheduled',
    (select scheduled_at from public.letters where id = 'b0000000-0000-0000-0000-000000000004'),
    'b0000000-0000-0000-0000-000000000004')),
  array['b0000000-0000-0000-0000-000000000012']::uuid[],
  'scheduled paging: the next page is the later letters'
);
select is(
  array(select id from public.list_sent('sent', null, null, 3)),
  array['b0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000005',
        'b0000000-0000-0000-0000-000000000003']::uuid[],
  'sent paging: first page'
);
select is(
  array(select id from public.list_sent('sent',
    (select coalesce(delivered_at, scheduled_at) from public.letters where id = 'b0000000-0000-0000-0000-000000000003'),
    'b0000000-0000-0000-0000-000000000003', 3)),
  array['b0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000001']::uuid[],
  'sent paging: second page starts after the cursor'
);
select ok(
  (select bool_and(read_at is null) from public.list_sent('scheduled')),
  'scheduled: no read time'
);
select is(
  (select row(recipient_username, recipient_display_name)::text from public.list_sent('sent')
   where id = 'b0000000-0000-0000-0000-000000000009'),
  row('cat_lists', 'Cat')::text,
  'sent: the recipient''s username and display name are included without a connection'
);
select is(
  (select recipient_username from public.list_sent('sent') where id = 'b0000000-0000-0000-0000-000000000011'),
  'fay_lists',
  'sent: a letter to someone who later blocked the sender stays listed'
);

-- Read-receipt masking, all four combinations (amy -> ben 01 and amy -> cat 09 are both read).
select ok(
  (select read_at is not null from public.list_sent('sent') where id = 'b0000000-0000-0000-0000-000000000001'),
  'masking: both receipts on -> the sender sees read_at'
);
select ok(
  (select read_at is null from public.list_sent('sent') where id = 'b0000000-0000-0000-0000-000000000009'),
  'masking: recipient receipts off -> hidden from the sender'
);
select ok(
  (select read_at is not null from public.list_sent('sent') where id = 'b0000000-0000-0000-0000-000000000013'),
  'masking: a letter to yourself shows your own read state'
);
reset role;
update public.profiles set read_receipts_enabled = false where id = '00000000-0000-0000-0000-000000000b01';
set local role authenticated;
select ok(
  (select read_at is null from public.list_sent('sent') where id = 'b0000000-0000-0000-0000-000000000001'),
  'masking: sender receipts off -> the sender does not see read_at'
);
select ok(
  (select read_at is null from public.list_sent('sent') where id = 'b0000000-0000-0000-0000-000000000009'),
  'masking: both off -> hidden'
);
select ok(
  (select read_at is null from public.get_letter('b0000000-0000-0000-0000-000000000001')),
  'masking: get_letter applies the same rule'
);
reset role;

-- Ben (recipient) turns receipts off: he still sees his own read state.
update public.profiles set read_receipts_enabled = true where id = '00000000-0000-0000-0000-000000000b01';
update public.profiles set read_receipts_enabled = false where id = '00000000-0000-0000-0000-000000000b02';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b02","role":"authenticated"}', true);
set local role authenticated;
select ok(
  (select read_at is not null from public.list_inbox() where id = 'b0000000-0000-0000-0000-000000000001')
  and (select read_at is not null from public.get_letter('b0000000-0000-0000-0000-000000000001')),
  'the recipient sees their own read state even with receipts off'
);
reset role;
update public.profiles set read_receipts_enabled = true where id = '00000000-0000-0000-0000-000000000b02';

-- ---------------------------------------------------------------------------------------------
-- get_letter
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b02","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select row(viewer_role, body, subject, sender_username, recipient_username, read_at is not null)::text
   from public.get_letter('b0000000-0000-0000-0000-000000000001')),
  row('recipient', E'Hello\n\n  world \t again', 'one', 'amy_lists', 'ben_lists', true)::text,
  'get_letter as recipient: full body, both profiles, own read state'
);
select is((select count(*)::int from public.get_letter('b0000000-0000-0000-0000-000000000001')), 1, 'get_letter returns exactly one row');
select throws_ok($$ select * from public.get_letter('b0000000-0000-0000-0000-000000000004') $$, 'P0001', 'not_found', 'get_letter: a scheduled letter is not_found for its recipient');
select throws_ok($$ select * from public.get_letter('b0000000-0000-0000-0000-000000000005') $$, 'P0001', 'not_found', 'get_letter: an undeliverable letter is not_found for its recipient');
select throws_ok($$ select * from public.get_letter('b0000000-0000-0000-0000-000000000006') $$, 'P0001', 'not_found', 'get_letter: a draft is not_found for its recipient');
select throws_ok($$ select * from public.get_letter('b0000000-0000-0000-0000-000000000007') $$, 'P0001', 'not_found', 'get_letter: a letter the recipient deleted for himself is not_found');
select throws_ok($$ select * from public.get_letter('b0000000-0000-0000-0000-000000000009') $$, 'P0001', 'not_found', 'get_letter: another person''s letter is not_found');
select throws_ok($$ select * from public.get_letter('b0000000-0000-0000-0000-0000000000ff') $$, 'P0001', 'not_found', 'get_letter: a nonexistent letter is not_found');
select is(
  (select row(sender_id, sender_username, sender_display_name)::text from public.get_letter('b0000000-0000-0000-0000-000000000010')),
  row('00000000-0000-0000-0000-000000000b04'::uuid, null::text, null::text)::text,
  'get_letter: a deleted sender''s profile fields are null'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select row(viewer_role, status, read_at is not null)::text from public.get_letter('b0000000-0000-0000-0000-000000000001')),
  row('sender', 'delivered'::public.letter_status, true)::text,
  'get_letter as sender: delivered, read time visible with both receipts on'
);
select is(
  (select row(viewer_role, status, read_at)::text from public.get_letter('b0000000-0000-0000-0000-000000000004')),
  row('sender', 'scheduled'::public.letter_status, null::timestamptz)::text,
  'get_letter as sender: a scheduled letter is visible to its sender'
);
select is(
  (select status from public.get_letter('b0000000-0000-0000-0000-000000000005')),
  'undeliverable'::public.letter_status,
  'get_letter as sender: an undeliverable letter is visible to its sender'
);
select throws_ok($$ select * from public.get_letter('b0000000-0000-0000-0000-000000000006') $$, 'P0001', 'not_found', 'get_letter: the sender''s own draft is not_found (drafts are read locally)');
select throws_ok($$ select * from public.get_letter('b0000000-0000-0000-0000-000000000008') $$, 'P0001', 'not_found', 'get_letter: a letter the sender deleted for herself is not_found');
select is(
  (select row(viewer_role, read_at is not null)::text from public.get_letter('b0000000-0000-0000-0000-000000000013')),
  row('recipient', true)::text,
  'get_letter: a delivered letter to yourself is read as its recipient'
);
select is(
  (select recipient_username from public.get_letter('b0000000-0000-0000-0000-000000000011')),
  'fay_lists',
  'get_letter: a letter to someone who later blocked the sender stays readable'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b06","role":"authenticated"}', true);
set local role authenticated;
select is(
  array(select id from public.list_inbox()),
  array['b0000000-0000-0000-0000-000000000011']::uuid[],
  'fay still sees the letter delivered before she blocked the sender'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b05","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.list_inbox()), 0, 'an unrelated user''s inbox is empty');
select is((select count(*)::int from public.list_sent('sent')), 0, 'an unrelated user has no sent letters');
select throws_ok($$ select * from public.get_letter('b0000000-0000-0000-0000-000000000001') $$, 'P0001', 'not_found', 'an unrelated user cannot read the letter');
reset role;

select * from finish();
rollback;
