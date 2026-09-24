-- pgTAP tests for public.search_users / public.find_user_by_email (Phase 5, PLAN §3.6,
-- DEC-008/009). Run with `supabase test db` (CI: database.yml). no_plan() on purpose: written
-- without a local Postgres to count against.
--
-- Rate limiting (30/hour search_users, 10/hour find_user_by_email) is not re-exercised at its exact
-- boundary here: check_rate_limit() itself is proven in rate_limits.test.sql, and the integration
-- pattern (a wired-in RPC hitting its limit) is proven for redeem_invite() in invites.test.sql;
-- repeating a 30- or 10-call boundary test here would mostly restate that coverage.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000501', 's1@example.test', '{}', now()),
  ('00000000-0000-0000-0000-000000000502', 's2@example.test', '{}', now()),
  ('00000000-0000-0000-0000-000000000503', 's3@example.test', '{}', now()),
  ('00000000-0000-0000-0000-000000000504', 's4@example.test', '{}', null); -- unverified

update public.profiles set username = 'sara_writer', display_name = 'Sara' where id = '00000000-0000-0000-0000-000000000501';
update public.profiles set username = 'sara_reads', display_name = 'Sara R', discoverable_by_username = false where id = '00000000-0000-0000-0000-000000000502';
update public.profiles set username = 'zed', display_name = 'Zed' where id = '00000000-0000-0000-0000-000000000503';
update public.profiles set username = 'unverified_user', display_name = 'Unverified' where id = '00000000-0000-0000-0000-000000000504';
update public.profiles set discoverable_by_email = true where id in (
  '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000504'
);

-- ---------------------------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.search_users(text)', 'execute'), 'anon cannot call search_users');
select ok(has_function_privilege('authenticated', 'public.search_users(text)', 'execute'), 'authenticated can call search_users');
select ok(not has_function_privilege('anon', 'public.find_user_by_email(text)', 'execute'), 'anon cannot call find_user_by_email');
select ok(has_function_privilege('authenticated', 'public.find_user_by_email(text)', 'execute'), 'authenticated can call find_user_by_email');

-- ---------------------------------------------------------------------------------------------
-- search_users, as user 503 (zed)
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.search_users('sara') $$, 'P0001', 'not_authenticated', 'search_users needs a signed-in user');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000503","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select * from public.search_users('sa') $$, 'P0001', 'query_too_short', 'a 2-character query is rejected (minimum 3, DEC-008)');
select lives_ok($$ select * from public.search_users('sar') $$, 'a 3-character query is accepted');

select is(
  (select array_agg(username order by username) from public.search_users('sara')),
  array['sara_writer'],
  'prefix match finds the discoverable "sara" user, but not the non-discoverable one'
);
select is_empty($$ select * from public.search_users('zed') $$, 'a search that would only match the caller themselves returns nothing (self excluded)');
select is_empty($$ select * from public.search_users('nonexistentprefix') $$, 'no matches: empty result, not an error');

select is(
  (select connection_state from public.search_users('sara') where username = 'sara_writer'),
  'none', 'no connection yet: connection_state is "none"'
);

reset role;

-- connection_state reflects each of the four states (503 <-> 501)
insert into public.connections (requester_id, addressee_id, status, via)
  values ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000501', 'pending', 'request');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000503","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select connection_state from public.search_users('sara') where username = 'sara_writer'),
  'pending_out', '503 sent the request: connection_state is "pending_out" from 503''s side'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000501","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select connection_state from public.search_users('zed') where username = 'zed'),
  'pending_in', 'and "pending_in" from 501''s (the addressee''s) side'
);
reset role;

update public.connections set status = 'accepted', responded_at = now()
  where requester_id = '00000000-0000-0000-0000-000000000503' and addressee_id = '00000000-0000-0000-0000-000000000501';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000503","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select connection_state from public.search_users('sara') where username = 'sara_writer'),
  'connected', 'once accepted: connection_state is "connected"'
);
reset role;
delete from public.connections where requester_id = '00000000-0000-0000-0000-000000000503' and addressee_id = '00000000-0000-0000-0000-000000000501';

-- Blocked users never appear in results at all (not merely a different connection_state).
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000503');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000503","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$ select * from public.search_users('sara') $$, 'a user blocked by (or who blocked) the caller is excluded entirely from results');
reset role;
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-000000000501' and blocked_id = '00000000-0000-0000-0000-000000000503';

-- ---------------------------------------------------------------------------------------------
-- find_user_by_email
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.find_user_by_email('s1@example.test') $$, 'P0001', 'not_authenticated', 'find_user_by_email needs a signed-in user');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000503","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select * from public.find_user_by_email('') $$, 'P0001', 'invalid_input', 'an empty email is rejected');

select is(
  (select username from public.find_user_by_email('s1@example.test')),
  'sara_writer', 'a verified, discoverable email match returns the profile'
);
select is(
  (select username from public.find_user_by_email('S1@EXAMPLE.TEST')),
  'sara_writer', 'the match is case-insensitive'
);

select is_empty($$ select * from public.find_user_by_email('nobody-at-all@example.test') $$, 'an unregistered email returns nothing');
select is_empty(
  $$ select * from public.find_user_by_email('s3@example.test') $$, -- zed himself, discoverable=true but he is the caller
  'looking up your own email returns nothing (self excluded, like search_users)'
);

reset role;

-- Now as 501, testing the "identical response" cases against 502 (not discoverable) and 504
-- (discoverable but unverified) - both must return exactly as empty as a nonexistent email
-- (DEC-009: never reveal which case it was).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000501","role":"authenticated"}', true);
set local role authenticated;
select is_empty(
  $$ select * from public.find_user_by_email('s2@example.test') $$,
  'an email that exists but is not discoverable_by_email returns nothing, identical to "no account"'
);
select is_empty(
  $$ select * from public.find_user_by_email('s4@example.test') $$,
  'an email that is discoverable but not yet verified also returns nothing, identically'
);
reset role;

-- Blocked: identical empty result, not a distinct error.
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000503');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000501","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$ select * from public.find_user_by_email('s3@example.test') $$, 'a blocked user''s email also returns nothing, identically');
reset role;
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-000000000501' and blocked_id = '00000000-0000-0000-0000-000000000503';

-- The email address itself is never returned (DEC-009): call the RPC for real and check the actual
-- result row has no "email" key, rather than trying to introspect the function's declared return
-- type via system catalogs (RETURNS TABLE does not produce a queryable pg_attribute entry the way
-- a real table's columns do). Claims must be a caller other than 501 (the target), since the
-- function excludes self - the 501 claim from the block above is still set, not 503's.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000503","role":"authenticated"}', true);
set local role authenticated;
select ok(
  not (to_jsonb(r) ? 'email'),
  'find_user_by_email''s result row has no "email" key'
) from public.find_user_by_email('s1@example.test') r;
reset role;

-- ---------------------------------------------------------------------------------------------
-- anon: no access at all
-- ---------------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.search_users('sara') $$, '42501', null, 'anon cannot search');
select throws_ok($$ select * from public.find_user_by_email('s1@example.test') $$, '42501', null, 'anon cannot look up by email');
reset role;

select * from finish();
rollback;
