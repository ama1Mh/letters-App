-- pgTAP tests for Phase 8 (20260929120000_replies.sql): who may create a reply and to whom, that a
-- reply cannot be attached to someone else's thread or re-addressed, that replying works for an
-- invite_only recipient without a connection (and not after a block), and list_thread() visibility,
-- ordering, read-receipt masking and error codes.
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose, as in the other files.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------------------------
-- Fixtures (as the table owner)
--   e01 amy (everyone)   e02 ben (invite_only, NOT connected to amy)   e03 cat (everyone, stranger)
-- Letters:
--   e..01 ben -> amy, delivered        (a valid parent for amy)
--   e..02 ben -> amy, scheduled        (not delivered yet: not a valid parent)
--   e..03 cat -> ben, delivered        (not addressed to amy: not a valid parent for amy)
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000e01', 'e01@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000e02', 'e02@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000e03', 'e03@example.test', '{}');

update public.profiles as p
set username = v.username, display_name = v.display_name, receive_mode = v.mode::public.receive_mode,
    onboarded_at = now()
from (values
  ('00000000-0000-0000-0000-000000000e01'::uuid, 'amy_reply', 'Amy', 'everyone'),
  ('00000000-0000-0000-0000-000000000e02'::uuid, 'ben_reply', 'Ben', 'invite_only'),
  ('00000000-0000-0000-0000-000000000e03'::uuid, 'cat_reply', 'Cat', 'everyone')
) as v (id, username, display_name, mode)
where p.id = v.id;

insert into public.letters (id, sender_id, recipient_id, subject, body, status, scheduled_at, delivered_at) values
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000e02', '00000000-0000-0000-0000-000000000e01',
   'hi amy', 'first letter', 'delivered', now() - interval '2 hours', now() - interval '2 hours'),
  ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000e02', '00000000-0000-0000-0000-000000000e01',
   'later', 'not yet', 'scheduled', now() + interval '1 hour', null),
  ('e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000e03', '00000000-0000-0000-0000-000000000e02',
   'to ben', 'cat writes ben', 'delivered', now() - interval '1 hour', now() - interval '1 hour');

-- ---------------------------------------------------------------------------------------------
-- Privileges and objects
-- ---------------------------------------------------------------------------------------------
select ok(has_column_privilege('authenticated', 'public.letters', 'parent_letter_id', 'insert'),
  'authenticated may set parent_letter_id on insert');
select ok(not has_column_privilege('authenticated', 'public.letters', 'parent_letter_id', 'update'),
  'authenticated may not change parent_letter_id afterwards');
select ok(not has_column_privilege('authenticated', 'public.letters', 'thread_id', 'insert'),
  'thread_id still cannot be chosen by the client');
select has_trigger('public', 'letters', 'letters_check_reply', 'the reply check trigger exists');
select ok(has_function_privilege('authenticated', 'public.list_thread(uuid)', 'execute'), 'authenticated can call list_thread');
select ok(not has_function_privilege('anon', 'public.list_thread(uuid)', 'execute'), 'anon cannot call list_thread');
select ok(not has_function_privilege('authenticated', 'public.letters_check_reply()', 'execute'),
  'the trigger function is not callable directly');

-- ---------------------------------------------------------------------------------------------
-- As amy: creating replies
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000e01","role":"authenticated"}', true);
set local role authenticated;

insert into public.letters (id, sender_id, parent_letter_id, body)
  values ('e0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000e01',
          'e0000000-0000-0000-0000-000000000001', 'thanks ben');
select is(
  (select recipient_id from public.letters where id = 'e0000000-0000-0000-0000-000000000011'),
  '00000000-0000-0000-0000-000000000e02'::uuid,
  'a reply with no recipient is addressed to the parent''s sender'
);
select is(
  (select thread_id from public.letters where id = 'e0000000-0000-0000-0000-000000000011'),
  (select thread_id from public.letters where id = 'e0000000-0000-0000-0000-000000000001'),
  'a reply joins its parent''s thread'
);

select throws_ok(
  $$ insert into public.letters (sender_id, parent_letter_id, recipient_id, body)
     values ('00000000-0000-0000-0000-000000000e01', 'e0000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000000e03', 'wrong person') $$,
  'P0001', 'invalid_input', 'a reply cannot be addressed to anyone but the parent''s sender'
);
select throws_ok(
  $$ insert into public.letters (sender_id, parent_letter_id, body)
     values ('00000000-0000-0000-0000-000000000e01', 'e0000000-0000-0000-0000-000000000002', 'too early') $$,
  'P0001', 'invalid_input', 'a letter not delivered yet cannot be replied to'
);
select throws_ok(
  $$ insert into public.letters (sender_id, parent_letter_id, body)
     values ('00000000-0000-0000-0000-000000000e01', 'e0000000-0000-0000-0000-000000000003', 'hijack') $$,
  'P0001', 'invalid_input', 'someone else''s letter cannot be replied to (no joining a stranger''s thread)'
);
select throws_ok(
  $$ insert into public.letters (sender_id, parent_letter_id, body)
     values ('00000000-0000-0000-0000-000000000e01', 'e0000000-0000-0000-0000-0000000000ff', 'ghost') $$,
  'P0001', 'invalid_input', 'a missing parent gives the same neutral code'
);

select throws_ok(
  $$ update public.letters set recipient_id = '00000000-0000-0000-0000-000000000e03'
     where id = 'e0000000-0000-0000-0000-000000000011' $$,
  'P0001', 'invalid_input', 'a reply draft cannot be re-addressed to a third person'
);
select throws_ok(
  $$ update public.letters set parent_letter_id = null where id = 'e0000000-0000-0000-0000-000000000011' $$,
  '42501', null, 'parent_letter_id cannot be updated by the client'
);
update public.letters set body = 'thanks ben, edited' where id = 'e0000000-0000-0000-0000-000000000011';
select is(
  (select body from public.letters where id = 'e0000000-0000-0000-0000-000000000011'),
  'thanks ben, edited',
  'a reply draft can still be edited normally'
);

-- ---------------------------------------------------------------------------------------------
-- Sending: the reply exception for an invite_only recipient, and a block overriding it
-- ---------------------------------------------------------------------------------------------
select is(
  (public.send_letter('e0000000-0000-0000-0000-000000000011')).status,
  'delivered'::public.letter_status,
  'amy can reply to invite_only ben without a connection'
);

insert into public.letters (id, sender_id, recipient_id, body)
  values ('e0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000e01',
          '00000000-0000-0000-0000-000000000e02', 'a fresh letter, not a reply');
select throws_ok(
  $$ select public.send_letter('e0000000-0000-0000-0000-000000000012') $$,
  'P0001', 'cannot_send', 'a non-reply to invite_only ben still needs a connection'
);

-- A reply draft, left as a draft, for the list_thread checks below.
insert into public.letters (id, sender_id, parent_letter_id, body)
  values ('e0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000e01',
          'e0000000-0000-0000-0000-000000000001', 'unsent draft reply');

reset role;
insert into public.blocks (blocker_id, blocked_id)
  values ('00000000-0000-0000-0000-000000000e02', '00000000-0000-0000-0000-000000000e01');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000e01","role":"authenticated"}', true);
set local role authenticated;
insert into public.letters (id, sender_id, parent_letter_id, body)
  values ('e0000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000e01',
          'e0000000-0000-0000-0000-000000000001', 'after the block');
select throws_ok(
  $$ select public.send_letter('e0000000-0000-0000-0000-000000000014') $$,
  'P0001', 'cannot_send', 'a block overrides the reply exception'
);
reset role;
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-000000000e02';

-- ---------------------------------------------------------------------------------------------
-- list_thread
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000e01","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$ select id, is_mine, other_username from public.list_thread(
       (select thread_id from public.letters where id = 'e0000000-0000-0000-0000-000000000001')) $$,
  $$ values ('e0000000-0000-0000-0000-000000000001'::uuid, false, 'ben_reply'::text),
            ('e0000000-0000-0000-0000-000000000011'::uuid, true, 'ben_reply'::text) $$,
  'amy sees the letter she received and her sent reply, oldest first; drafts are never listed'
);
select is(
  (select preview from public.list_thread(
     (select thread_id from public.letters where id = 'e0000000-0000-0000-0000-000000000001'))
   where id = 'e0000000-0000-0000-0000-000000000011'),
  'thanks ben, edited',
  'rows carry the whitespace-collapsed preview'
);

-- amy reads ben's letter; ben sees the read time only while amy shares receipts.
select public.mark_read('e0000000-0000-0000-0000-000000000001');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000e02","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select id, is_mine, other_username from public.list_thread(
       (select thread_id from public.letters where id = 'e0000000-0000-0000-0000-000000000001')) $$,
  $$ values ('e0000000-0000-0000-0000-000000000001'::uuid, true, 'amy_reply'::text),
            ('e0000000-0000-0000-0000-000000000011'::uuid, false, 'amy_reply'::text) $$,
  'ben sees the same thread from his side'
);
select isnt(
  (select read_at from public.list_thread(
     (select thread_id from public.letters where id = 'e0000000-0000-0000-0000-000000000001'))
   where id = 'e0000000-0000-0000-0000-000000000001'),
  null,
  'ben sees when amy read his letter (both share receipts)'
);

reset role;
update public.profiles set read_receipts_enabled = false where id = '00000000-0000-0000-0000-000000000e01';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000e02","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select read_at from public.list_thread(
     (select thread_id from public.letters where id = 'e0000000-0000-0000-0000-000000000001'))
   where id = 'e0000000-0000-0000-0000-000000000001'),
  null,
  'with amy''s receipts off, ben no longer sees when she read it'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000e03","role":"authenticated"}', true);
set local role authenticated;
-- The thread id is the root letter's id (a literal: RLS hides the letters from cat, so a subquery
-- would yield null and test invalid_input instead).
select throws_ok(
  $$ select * from public.list_thread('e0000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_found', 'an outsider gets not_found for a thread that exists'
);
select throws_ok(
  $$ select * from public.list_thread('e0000000-0000-0000-0000-0000000000ee') $$,
  'P0001', 'not_found', '...and exactly the same for a thread that does not exist'
);
select throws_ok(
  $$ select * from public.list_thread(null) $$,
  'P0001', 'invalid_input', 'a null thread id is invalid_input'
);

reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select * from public.list_thread('e0000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_authenticated', 'no user: not_authenticated'
);

reset role;
select * from finish();
rollback;
