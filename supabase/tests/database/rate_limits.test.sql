-- pgTAP tests for public.api_rate_limits / check_rate_limit() (Phase 5). Run with `supabase test
-- db` (CI: database.yml). no_plan() on purpose: written without a local Postgres to count against.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000201', 'r1@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000202', 'r2@example.test', '{}');

-- ---------------------------------------------------------------------------------------------
-- Structure and privileges
-- ---------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.api_rate_limits'::regclass), 'RLS is enabled on api_rate_limits');
select is_empty($$ select polname from pg_policy where polrelid = 'public.api_rate_limits'::regclass $$, 'api_rate_limits has no policies (default deny, server-only)');
select ok(not has_table_privilege('anon', 'public.api_rate_limits', 'select'), 'anon cannot read api_rate_limits');
select ok(not has_table_privilege('authenticated', 'public.api_rate_limits', 'select'), 'authenticated cannot read api_rate_limits directly');
select ok(not has_table_privilege('authenticated', 'public.api_rate_limits', 'insert'), 'authenticated cannot write api_rate_limits directly');
select ok(not has_function_privilege('authenticated', 'public.check_rate_limit(text, int, interval)', 'execute'), 'authenticated cannot call check_rate_limit directly - only from inside another SECURITY DEFINER RPC');
select ok(not has_function_privilege('anon', 'public.check_rate_limit(text, int, interval)', 'execute'), 'anon cannot call check_rate_limit');

-- ---------------------------------------------------------------------------------------------
-- Logic (called directly as the table owner, which bypasses the revoke above the same way it
-- bypasses RLS elsewhere in this repo's tests - auth.uid() reads the JWT claims GUC, not the
-- Postgres role, so set_config alone is enough to exercise the function as "a specific user").
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.check_rate_limit('test_action', 5, interval '1 hour') $$,
  'P0001', 'not_authenticated', 'check_rate_limit needs a signed-in user'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000201"}', true);

select ok(public.check_rate_limit('search', 3, interval '1 hour'), 'call 1 of 3: under the limit');
select ok(public.check_rate_limit('search', 3, interval '1 hour'), 'call 2 of 3: under the limit');
select ok(public.check_rate_limit('search', 3, interval '1 hour'), 'call 3 of 3: at the limit, still allowed');
select ok(not public.check_rate_limit('search', 3, interval '1 hour'), 'call 4: over the limit, rejected');
select ok(not public.check_rate_limit('search', 3, interval '1 hour'), 'call 5: still rejected (rejection itself is not free extra budget)');

select ok(
  public.check_rate_limit('redeem_invite', 3, interval '1 hour'),
  'a different action has its own independent counter, even for the same user in the same window'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000202"}', true);
select ok(
  public.check_rate_limit('search', 3, interval '1 hour'),
  'a different user has their own independent counter for the same action'
);

select * from finish();
rollback;
