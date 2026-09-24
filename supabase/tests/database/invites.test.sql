-- pgTAP tests for public.invites and its RPCs (Phase 5, PLAN §3.6/§4.1, DEC-012). Run with
-- `supabase test db` (CI: database.yml). no_plan() on purpose: written without a local Postgres to
-- count against.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table test_ids (key text primary key, value uuid);
create temporary table test_codes (key text primary key, value text);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000401', 'i1@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000402', 'i2@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000403', 'i3@example.test', '{}');

-- ---------------------------------------------------------------------------------------------
-- Structure and privileges
-- ---------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.invites'::regclass), 'RLS is enabled on invites');
select policies_are('public', 'invites', array['invites_select_own']::name[], 'invites has exactly the expected policy');
select ok(not has_table_privilege('anon', 'public.invites', 'select'), 'anon cannot read invites');
select ok(has_table_privilege('authenticated', 'public.invites', 'select'), 'authenticated can read invites (rows limited by RLS)');
select ok(not has_table_privilege('authenticated', 'public.invites', 'insert'), 'authenticated cannot write invites directly (RPC only)');
select col_is_unique('public', 'invites', 'code', 'invite codes are globally unique');

select ok(not has_function_privilege('authenticated', 'public.generate_invite_code()', 'execute'), 'generate_invite_code is internal only');
select ok(has_function_privilege('authenticated', 'public.get_or_create_invite()', 'execute'), 'authenticated can call get_or_create_invite');
select ok(has_function_privilege('authenticated', 'public.regenerate_invite()', 'execute'), 'authenticated can call regenerate_invite');
select ok(has_function_privilege('authenticated', 'public.redeem_invite(text)', 'execute'), 'authenticated can call redeem_invite');
select ok(not has_function_privilege('anon', 'public.get_or_create_invite()', 'execute'), 'anon cannot call get_or_create_invite');
select ok(not has_function_privilege('anon', 'public.redeem_invite(text)', 'execute'), 'anon cannot call redeem_invite');

-- ---------------------------------------------------------------------------------------------
-- generate_invite_code() format (called directly as the table owner, which bypasses the revoke)
-- ---------------------------------------------------------------------------------------------
select matches(public.generate_invite_code(), '^[A-Z2-7]{10}$', 'a generated code is 10 base32 characters') from generate_series(1, 5);

-- ---------------------------------------------------------------------------------------------
-- get_or_create_invite() / regenerate_invite()
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.get_or_create_invite() $$, 'P0001', 'not_authenticated', 'get_or_create_invite needs a signed-in user');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000401","role":"authenticated"}', true);
set local role authenticated;

insert into test_codes (key, value) select 'first', (public.get_or_create_invite()).code;
select is((select count(*)::int from public.invites where owner_id = '00000000-0000-0000-0000-000000000401'), 1, 'the first call creates exactly one invite');
select matches((select value from test_codes where key = 'first'), '^[A-Z2-7]{10}$', 'the created code has the right format');

insert into test_codes (key, value) select 'second_call', (public.get_or_create_invite()).code;
select is(
  (select value from test_codes where key = 'second_call'),
  (select value from test_codes where key = 'first'),
  'calling get_or_create_invite again returns the same active invite, not a new one'
);
select is((select count(*)::int from public.invites where owner_id = '00000000-0000-0000-0000-000000000401'), 1, 'still only one row: get_or_create_invite is idempotent');

insert into test_codes (key, value) select 'regenerated', (public.regenerate_invite()).code;
select isnt(
  (select value from test_codes where key = 'regenerated'),
  (select value from test_codes where key = 'first'),
  'regenerate_invite produces a different code'
);
select is((select count(*)::int from public.invites where owner_id = '00000000-0000-0000-0000-000000000401'), 2, 'the old invite row is kept (revoked), not deleted');
select ok(
  (select revoked_at is not null from public.invites where code = (select value from test_codes where key = 'first')),
  'the old code is now revoked'
);
select ok(
  (select revoked_at is null from public.invites where code = (select value from test_codes where key = 'regenerated')),
  'the new code is active'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- redeem_invite()
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.redeem_invite('AAAAAAAAAA') $$, 'P0001', 'not_authenticated', 'redeem_invite needs a signed-in user');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000402","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select public.redeem_invite('ZZZZZZZZZZ') $$, 'P0001', 'invite_not_found', 'an unknown code is rejected with the generic code');

insert into test_ids (key, value) select 'redeemed', public.redeem_invite(
  lower((select value from test_codes where key = 'regenerated')) -- lowercase + will be trimmed: normalized before matching
);
select is((select status::text from public.connections where id = (select value from test_ids where key = 'redeemed')), 'accepted', 'redeeming creates an already-accepted connection (DEC-007)');
select is((select via::text from public.connections where id = (select value from test_ids where key = 'redeemed')), 'invite', 'via is "invite"');
select ok(
  (select invite_id is not null from public.connections where id = (select value from test_ids where key = 'redeemed')),
  'invite_id is recorded on the resulting connection'
);
select ok(public.can_send('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000401', null), 'the redeemer can now send to the invite owner (invite_only, accepted connection)');

insert into test_ids (key, value) select 'redeemed_again', public.redeem_invite((select value from test_codes where key = 'regenerated'));
select is(
  (select value from test_ids where key = 'redeemed_again'),
  (select value from test_ids where key = 'redeemed'),
  'redeeming the same code again is idempotent: returns the existing connection, not a new one'
);

select throws_ok(
  $$ select public.redeem_invite((select value from test_codes where key = 'first')) $$,
  'P0001', 'invite_not_found', 'a revoked code gives the identical generic error, not a distinct "revoked" one'
);

reset role;

-- Self-redemption and expiry
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000401","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.redeem_invite((select value from test_codes where key = 'regenerated')) $$,
  'P0001', 'invalid_input', 'redeeming your own invite code is rejected'
);
reset role;

update public.invites set expires_at = now() - interval '1 minute' where code = (select value from test_codes where key = 'regenerated');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000403","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.redeem_invite((select value from test_codes where key = 'regenerated')) $$,
  'P0001', 'invite_not_found', 'an expired code gives the identical generic error too'
);
reset role;
update public.invites set expires_at = null where code = (select value from test_codes where key = 'regenerated');

-- Blocked: redeeming is rejected with the same neutral code as "not found".
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000403');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000403","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.redeem_invite((select value from test_codes where key = 'regenerated')) $$,
  'P0001', 'invite_not_found', 'redeeming a blocked user''s invite gives the neutral not-found code'
);
reset role;
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-000000000401' and blocked_id = '00000000-0000-0000-0000-000000000403';

-- Rate limiting: 20/hour (provisional, OPEN-5). Redeeming the already-redeemed 'regenerated' code
-- repeatedly is idempotent (never errors on its own), so this exercises check_rate_limit() itself,
-- which still counts every call regardless of the idempotent early return. 402 already made 2 such
-- calls earlier ("redeemed", "redeemed_again"), so 18 more reaches exactly 20 (the limit, still
-- allowed); the 21st (below) is the one expected to be rejected. The claims GUC must be set to 402
-- explicitly here, not left over from the previous (403) test - set_config(..., true) persists for
-- the rest of the transaction, it does not expire when the role is reset.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000402","role":"authenticated"}', true);
do $$
declare
  i int;
begin
  for i in 1..18 loop
    perform public.redeem_invite((select value from test_codes where key = 'regenerated'));
  end loop;
end $$;
set local role authenticated;
select throws_ok(
  $$ select public.redeem_invite((select value from test_codes where key = 'regenerated')) $$,
  'P0001', 'rate_limited', '21st redeem_invite call in the window is rate-limited (20/hour, provisional)'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- RLS: the owner sees their own invite; a stranger does not
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000401","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.invites where owner_id = '00000000-0000-0000-0000-000000000401'), 2, '401 sees their own invite rows');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000402","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$ select 1 from public.invites where owner_id = '00000000-0000-0000-0000-000000000401' $$, '402 cannot see 401''s invite rows');
reset role;

-- ---------------------------------------------------------------------------------------------
-- anon: no access at all
-- ---------------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.invites $$, '42501', null, 'anon cannot read invites');
select throws_ok($$ select public.get_or_create_invite() $$, '42501', null, 'anon cannot create an invite');
select throws_ok($$ select public.redeem_invite('AAAAAAAAAA') $$, '42501', null, 'anon cannot redeem an invite');
reset role;

select * from finish();
rollback;
