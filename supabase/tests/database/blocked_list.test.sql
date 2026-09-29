-- pgTAP tests for 20260929160000_blocked_list.sql: list_blocked_users() shows only the blocks I
-- made (never who blocked me), with the blocked person's public fields (null for a deleted account).
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose, as in the other files.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- g01 amy, g02 ben, g03 cat (deleted later). amy blocks ben (earlier) and cat; ben blocks amy.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000a01', 'g01@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000a02', 'g02@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000a03', 'g03@example.test', '{}');
update public.profiles as p
set username = v.username, display_name = v.display_name, onboarded_at = now()
from (values
  ('00000000-0000-0000-0000-000000000a01'::uuid, 'amy_block', 'Amy'),
  ('00000000-0000-0000-0000-000000000a02'::uuid, 'ben_block', 'Ben'),
  ('00000000-0000-0000-0000-000000000a03'::uuid, 'cat_block', 'Cat')
) as v (id, username, display_name)
where p.id = v.id;
insert into public.blocks (blocker_id, blocked_id, created_at) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000a02', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000a03', now()),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a01', now());
update public.profiles set deleted_at = now() where id = '00000000-0000-0000-0000-000000000a03';

select ok(has_function_privilege('authenticated', 'public.list_blocked_users()', 'execute'), 'authenticated can list their blocks');
select ok(not has_function_privilege('anon', 'public.list_blocked_users()', 'execute'), 'anon cannot');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select user_id, username, display_name from public.list_blocked_users() $$,
  $$ values ('00000000-0000-0000-0000-000000000a03'::uuid, null::text, null::text),
            ('00000000-0000-0000-0000-000000000a02'::uuid, 'ben_block'::text, 'Ben'::text) $$,
  'amy sees the two people she blocked, newest first; a deleted account has no name'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a02","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select user_id from public.list_blocked_users() $$,
  $$ values ('00000000-0000-0000-0000-000000000a01'::uuid) $$,
  'ben sees only his own block, not that amy blocked him'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000a03","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$ select 1 from public.list_blocked_users() $$, 'cat, blocked by amy, sees nothing about it');
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select * from public.list_blocked_users() $$, 'P0001', 'not_authenticated', 'no user: not_authenticated');
reset role;

select * from finish();
rollback;
