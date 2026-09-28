-- pgTAP: no public function that writes may be STABLE or IMMUTABLE (20260929090000_search_volatile.sql).
-- PostgREST runs STABLE/IMMUTABLE functions in a read-only transaction, so such a function works in
-- these tests (plain writable transaction) but fails through the API with SQLSTATE 25006. This
-- regression guard checks the catalog instead of calling the functions.
-- Run with `supabase test db` (CI: database.yml).
begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

select is(
  (select provolatile from pg_proc where oid = 'public.search_users(text)'::regprocedure),
  'v',
  'search_users() is VOLATILE (it records a rate-limit hit)'
);

select is(
  (select provolatile from pg_proc where oid = 'public.find_user_by_email(text)'::regprocedure),
  'v',
  'find_user_by_email() is VOLATILE (it records a rate-limit hit)'
);

select is(
  (select provolatile from pg_proc where oid = 'public.check_rate_limit(text, integer, interval)'::regprocedure),
  'v',
  'check_rate_limit() itself is VOLATILE'
);

-- Any public function whose source rate-limits or writes a table must be VOLATILE.
select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.provolatile <> 'v'
      and p.prosrc ~* '(check_rate_limit|insert\s+into|update\s+public\.|delete\s+from)'
  $$,
  'no STABLE/IMMUTABLE public function writes or rate-limits'
);

select * from finish();
rollback;
