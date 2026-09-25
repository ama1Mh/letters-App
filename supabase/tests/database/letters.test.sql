-- pgTAP tests for public.letters (Phase 3, drafts only). Run with `supabase test db` (CI:
-- database.yml). Threats mirrored from PLAN §6.6 that apply to this phase's scope: reading another
-- user's draft, writing status/delivered_at/sender_id directly, modifying a delivered letter.
--
-- no_plan() on purpose: this file was written without a local Postgres to count against.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------------------------
-- Fixtures: three users (profiles created by the sign-up trigger)
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000101', 'l1@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000102', 'l2@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000103', 'l3@example.test', '{}');

-- ---------------------------------------------------------------------------------------------
-- Structure and privileges
-- ---------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.letters'::regclass), 'RLS is enabled on letters');
select policies_are(
  'public', 'letters',
  array['letters_select_sender', 'letters_select_recipient', 'letters_insert_own_draft',
        'letters_update_own_draft', 'letters_delete_own_draft']::name[],
  'letters has exactly the expected policies'
);

select ok(not has_table_privilege('anon', 'public.letters', 'select'), 'anon cannot select letters');
select ok(not has_table_privilege('anon', 'public.letters', 'insert'), 'anon cannot insert letters');
-- SELECT is granted per column since Phase 6 (20260925150000_letters_sending.sql): every column
-- except read_at, which is only exposed through the read-receipt-masking functions (DEC-025).
select ok(has_any_column_privilege('authenticated', 'public.letters', 'select'), 'authenticated can select letters (rows limited by RLS)');
select ok(has_column_privilege('authenticated', 'public.letters', 'body', 'select'), 'body is selectable');
select ok(has_column_privilege('authenticated', 'public.letters', 'status', 'select'), 'status is selectable');
select ok(not has_column_privilege('authenticated', 'public.letters', 'read_at', 'select'), 'read_at is not selectable directly (masked read receipts, DEC-025)');
select ok(has_table_privilege('authenticated', 'public.letters', 'delete'), 'authenticated can delete letters (rows limited by RLS)');
-- INSERT/UPDATE are granted on letters only at the column level (never a bare `grant insert on
-- letters`), and profiles.test.sql - the one file in this repo already proven green in CI -
-- conspicuously never asserts has_table_privilege(..., 'update') for profiles either, whose UPDATE
-- grant is column-only in exactly the same way; it uses has_column_privilege throughout instead.
-- Not worth trusting has_table_privilege's column-grant behavior here when the column-level checks
-- immediately below already cover the same ground precisely.

select ok(has_column_privilege('authenticated', 'public.letters', 'body', 'insert'), 'body is insertable');
select ok(has_column_privilege('authenticated', 'public.letters', 'body', 'update'), 'body is updatable');
select ok(has_column_privilege('authenticated', 'public.letters', 'recipient_id', 'update'), 'recipient_id is updatable (choosing a recipient for a draft)');
select ok(not has_column_privilege('authenticated', 'public.letters', 'status', 'insert'), 'status cannot be set on insert');
select ok(not has_column_privilege('authenticated', 'public.letters', 'status', 'update'), 'status cannot be written directly');
select ok(not has_column_privilege('authenticated', 'public.letters', 'delivered_at', 'update'), 'delivered_at cannot be written directly');
select ok(not has_column_privilege('authenticated', 'public.letters', 'sender_id', 'update'), 'sender_id cannot be changed after creation');
select ok(has_column_privilege('authenticated', 'public.letters', 'sender_id', 'insert'), 'sender_id is insertable (the client must state it; WITH CHECK verifies it matches auth.uid())');
select ok(has_column_privilege('authenticated', 'public.letters', 'id', 'insert'), 'id can be chosen by the client (offline drafts store, PLAN §4.3: local and synced-remote id are the same value)');
select ok(not has_column_privilege('authenticated', 'public.letters', 'thread_id', 'insert'), 'thread_id cannot be chosen by the client (the trigger sets it)');
select ok(not has_column_privilege('authenticated', 'public.letters', 'scheduled_at', 'update'), 'scheduled_at cannot be written directly (send_letter() RPC, Phase 6)');
select ok(not has_column_privilege('authenticated', 'public.letters', 'read_at', 'update'), 'read_at cannot be written directly (mark_read() RPC, Phase 6)');

-- ---------------------------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.letters (sender_id, status, subject)
     values ('00000000-0000-0000-0000-000000000101', 'draft', repeat('a', 121)) $$,
  '23514', null, 'subject over 120 characters is rejected'
);
select throws_ok(
  $$ insert into public.letters (sender_id, status, body)
     values ('00000000-0000-0000-0000-000000000101', 'draft', repeat('a', 10001)) $$,
  '23514', null, 'body over 10,000 characters is rejected'
);
select throws_ok(
  $$ insert into public.letters (sender_id, status) values ('00000000-0000-0000-0000-000000000101', 'scheduled') $$,
  '23514', null, 'a scheduled letter without scheduled_at is rejected'
);
select throws_ok(
  $$ insert into public.letters (sender_id, status) values ('00000000-0000-0000-0000-000000000101', 'delivered') $$,
  '23514', null, 'a non-draft letter without a recipient is rejected'
);
select throws_ok(
  $$ insert into public.letters (sender_id, status, design) values ('00000000-0000-0000-0000-000000000101', 'draft', '"not an object"'::jsonb) $$,
  '23514', null, 'a non-object design value is rejected'
);

-- ---------------------------------------------------------------------------------------------
-- Design validation (Phase 4, PLAN §3.4: "server validates keys/version only"). Mirrors
-- mobile/__tests__/design.test.ts's normalizeDesign() cases, but at the constraint layer: a bad
-- design is rejected outright here, not silently replaced with a default (that fallback is the
-- app's job, per DEC-042).
-- ---------------------------------------------------------------------------------------------
select ok(
  public.is_valid_design(
    '{"v":1,"paper":"cream","font":"caveat","ink":"classic_black","layout":"standard","stamp":null,"stickers":[]}'::jsonb
  ),
  'a fully valid design (no stamp) passes'
);
select ok(
  public.is_valid_design(
    '{"v":1,"paper":"sky","font":"amiri","ink":"navy","layout":"standard","stamp":"heart","stickers":[]}'::jsonb
  ),
  'a fully valid design (with a stamp) passes'
);
select ok(not public.is_valid_design(null), 'null is invalid');
select ok(not public.is_valid_design('[]'::jsonb), 'a JSON array is invalid (not an object)');
select ok(
  not public.is_valid_design(
    '{"v":2,"paper":"cream","font":"caveat","ink":"classic_black","layout":"standard","stamp":null,"stickers":[]}'::jsonb
  ),
  'an unrecognized version is invalid'
);
select ok(
  not public.is_valid_design(
    '{"v":1,"paper":"gold-foil","font":"caveat","ink":"classic_black","layout":"standard","stamp":null,"stickers":[]}'::jsonb
  ),
  'an unrecognized paper key is invalid'
);
select ok(
  not public.is_valid_design(
    '{"v":1,"paper":"cream","font":"comic-sans","ink":"classic_black","layout":"standard","stamp":null,"stickers":[]}'::jsonb
  ),
  'an unrecognized font key is invalid'
);
select ok(
  not public.is_valid_design(
    '{"v":1,"paper":"cream","font":"caveat","ink":"invisible","layout":"standard","stamp":null,"stickers":[]}'::jsonb
  ),
  'an unrecognized ink key is invalid'
);
select ok(
  not public.is_valid_design(
    '{"v":1,"paper":"cream","font":"caveat","ink":"classic_black","layout":"fancy","stamp":null,"stickers":[]}'::jsonb
  ),
  'a non-standard layout is invalid (reserved for a later phase)'
);
select ok(
  not public.is_valid_design(
    '{"v":1,"paper":"cream","font":"caveat","ink":"classic_black","layout":"standard","stamp":"unicorn","stickers":[]}'::jsonb
  ),
  'an unrecognized stamp key is invalid'
);
select ok(
  not public.is_valid_design(
    '{"v":1,"paper":"cream","font":"caveat","ink":"classic_black","layout":"standard","stamp":null,"stickers":["one"]}'::jsonb
  ),
  'a non-empty stickers array is invalid (reserved for a later phase)'
);
select ok(
  not public.is_valid_design(
    '{"v":1,"paper":"cream","font":"caveat","ink":"classic_black","layout":"standard","stamp":null}'::jsonb
  ),
  'a missing stickers key is invalid'
);

select throws_ok(
  $$ insert into public.letters (sender_id, status, design)
     values (
       '00000000-0000-0000-0000-000000000101', 'draft',
       '{"v":1,"paper":"gold-foil","font":"caveat","ink":"classic_black","layout":"standard","stamp":null,"stickers":[]}'::jsonb
     ) $$,
  '23514', null, 'a design with an unrecognized paper key is rejected on insert'
);
select lives_ok(
  $$ insert into public.letters (sender_id, status) values ('00000000-0000-0000-0000-000000000101', 'draft') $$,
  'the default design (no design column given) is itself valid'
);

-- ---------------------------------------------------------------------------------------------
-- Triggers: thread_id and updated_at, run as the table owner (bypasses RLS, tests the trigger in
-- isolation from the policy layer below)
-- ---------------------------------------------------------------------------------------------
insert into public.letters (id, sender_id, status, body)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'draft', 'root');
select is(
  (select thread_id from public.letters where id = '10000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'a fresh letter is the root of its own thread'
);

insert into public.letters (id, sender_id, parent_letter_id, status, recipient_id, body)
  values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101',
          '10000000-0000-0000-0000-000000000001', 'draft', '00000000-0000-0000-0000-000000000102', 'reply');
select is(
  (select thread_id from public.letters where id = '10000000-0000-0000-0000-000000000002'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'a reply inherits its parent''s thread_id'
);

select throws_ok(
  $$ insert into public.letters (sender_id, parent_letter_id, status)
     values ('00000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000000', 'draft') $$,
  'P0001', 'invalid_input', 'a reply to a non-existent parent is rejected'
);

update public.letters set body = 'root, edited' where id = '10000000-0000-0000-0000-000000000001';
select ok(
  (select updated_at > created_at from public.letters where id = '10000000-0000-0000-0000-000000000001'),
  'updated_at advances on update'
);

-- A delivered letter is immutable, even for a direct update as the table owner (bypasses RLS
-- entirely) - the trigger checks OLD.status, not the caller's role or privileges.
insert into public.letters (id, sender_id, recipient_id, status, delivered_at, body)
  values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000101',
          '00000000-0000-0000-0000-000000000102', 'delivered', now(), 'delivered body');
select throws_ok(
  $$ update public.letters set body = 'tampered' where id = '10000000-0000-0000-0000-000000000003' $$,
  'P0001', 'delivered_immutable', 'a delivered letter cannot be modified, even as the table owner'
);

-- ---------------------------------------------------------------------------------------------
-- As user 1 (sender): draft CRUD, scoped to own rows, column-limited writes
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.letters (sender_id, subject, body, body_dir, design)
     values (
       '00000000-0000-0000-0000-000000000101', 'Hello', 'Hi there', 'ltr',
       '{"v":1,"paper":"sky","font":"amiri","ink":"navy","layout":"standard","stamp":"star","stickers":[]}'::jsonb
     ) $$,
  'a user can create their own draft, with a fully-specified valid design'
);
select lives_ok(
  $$ insert into public.letters (id, sender_id, subject, body)
     values ('10000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000101', 'Client id', 'x') $$,
  'a client-chosen id is accepted on insert (offline drafts store)'
);
select is(
  (select id from public.letters where subject = 'Client id'),
  '10000000-0000-0000-0000-000000000099'::uuid,
  'the client-chosen id is what was stored, not a server-generated one'
);
select throws_ok(
  $$ insert into public.letters (sender_id, subject, body) values ('00000000-0000-0000-0000-000000000102', 'x', 'y') $$,
  '42501', null, 'a user cannot create a draft with someone else as sender_id (WITH CHECK)'
);
select throws_ok(
  $$ insert into public.letters (sender_id, status, subject, body)
     values ('00000000-0000-0000-0000-000000000101', 'delivered', 'x', 'y') $$,
  '42501', null, 'a user cannot insert a non-draft letter directly (status is not a grantable insert column)'
);

select is(
  (select count(*)::int from public.letters where sender_id = '00000000-0000-0000-0000-000000000101' and subject = 'Hello'),
  1,
  'the new draft is visible to its sender'
);

-- Own draft: editable.
select lives_ok(
  $$ update public.letters set body = 'Updated body', recipient_id = '00000000-0000-0000-0000-000000000102'
     where sender_id = '00000000-0000-0000-0000-000000000101' and subject = 'Hello' $$,
  'a user can edit their own draft (body, recipient_id)'
);
select throws_ok(
  $$ update public.letters set status = 'scheduled'
     where sender_id = '00000000-0000-0000-0000-000000000101' and subject = 'Hello' $$,
  '42501', null, 'status cannot be written directly on update'
);
select throws_ok(
  $$ update public.letters set delivered_at = now()
     where sender_id = '00000000-0000-0000-0000-000000000101' and subject = 'Hello' $$,
  '42501', null, 'delivered_at cannot be written directly'
);
select throws_ok(
  $$ update public.letters set sender_id = '00000000-0000-0000-0000-000000000102'
     where sender_id = '00000000-0000-0000-0000-000000000101' and subject = 'Hello' $$,
  '42501', null, 'sender_id cannot be reassigned'
);

-- The delivered fixture and the other user's rows are invisible to user 1 for writes (RLS silently
-- matches zero rows rather than raising - "affects 0 rows" is the correct, unsurprising result).
select lives_ok(
  $$ update public.letters set body = 'nope' where id = '10000000-0000-0000-0000-000000000003' $$,
  'updating a delivered letter (via RLS this time, not the trigger) is not an error...'
);
select is(
  (select body from public.letters where id = '10000000-0000-0000-0000-000000000003'),
  'delivered body',
  '...and it silently changed nothing: user 1 cannot see or touch it (not sender_id-owned draft)'
);

-- Delete: own draft only.
select lives_ok(
  $$ insert into public.letters (sender_id, subject, body) values ('00000000-0000-0000-0000-000000000101', 'ToDelete', 'x') $$,
  'a second draft is created for the delete test'
);
select lives_ok(
  $$ delete from public.letters where sender_id = '00000000-0000-0000-0000-000000000101' and subject = 'ToDelete' $$,
  'a user can delete their own draft'
);
select is_empty(
  $$ select 1 from public.letters where sender_id = '00000000-0000-0000-0000-000000000101' and subject = 'ToDelete' $$,
  'the deleted draft is gone'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- As user 2: cannot see or touch user 1's draft; sees the delivered letter addressed to them
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}', true);
set local role authenticated;

select is_empty(
  $$ select 1 from public.letters where sender_id = '00000000-0000-0000-0000-000000000101' and subject = 'Hello' $$,
  'user 2 cannot see user 1''s draft'
);
select lives_ok(
  $$ update public.letters set body = 'hijacked'
     where sender_id = '00000000-0000-0000-0000-000000000101' and subject = 'Hello' $$,
  'updating a draft user 2 cannot see is not an error...'
);
-- Checked as the table owner, not as user 2: user 2 has no SELECT visibility into user 1's draft
-- either (confirmed above), so `select body ... where subject = 'Hello'` as user 2 would return
-- NULL regardless of whether the update actually changed anything - not a real check. request.jwt
-- .claims (set_config(..., true)) persists for the rest of the transaction, so re-entering
-- `authenticated` below resumes the same session (user 2) the statements after this still need.
reset role;
select is(
  (select body from public.letters where subject = 'Hello'),
  'Updated body',
  '...and it silently changed nothing'
);
set local role authenticated;
select is(
  (select count(*)::int from public.letters where id = '10000000-0000-0000-0000-000000000003'),
  1,
  'user 2 sees the delivered letter addressed to them'
);
-- The recipient has no UPDATE policy match at all yet in this phase (letters_update_own_draft is
-- sender-only), so this is filtered by RLS before the immutability trigger would even see it - the
-- table-owner test above is what actually proves the trigger itself works.
select lives_ok(
  $$ update public.letters set body = 'still tampered' where id = '10000000-0000-0000-0000-000000000003' $$,
  'the recipient updating a delivered letter is not an error...'
);
select is(
  (select body from public.letters where id = '10000000-0000-0000-0000-000000000003'),
  'delivered body',
  '...and, same as the sender above, it silently changed nothing'
);
select throws_ok(
  $$ insert into public.letters (sender_id, subject, body) values ('00000000-0000-0000-0000-000000000101', 'x', 'y') $$,
  '42501', null, 'user 2 cannot create a draft claiming to be user 1'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- As user 3: sees nothing of either user's letters
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000103","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.letters), 0, 'a third user, neither sender nor recipient of anything, sees nothing');
reset role;

-- ---------------------------------------------------------------------------------------------
-- anon: no access at all
-- ---------------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.letters $$, '42501', null, 'anon cannot read letters');
select throws_ok(
  $$ insert into public.letters (sender_id, subject, body) values ('00000000-0000-0000-0000-000000000101', 'x', 'y') $$,
  '42501', null, 'anon cannot create letters'
);
reset role;

select * from finish();
rollback;
