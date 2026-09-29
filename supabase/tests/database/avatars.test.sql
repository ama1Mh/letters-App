-- pgTAP tests for 20260929220000_avatars.sql: preset avatar keys (DEC-011).
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose, as in the other files.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000d01', 'av1@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000d02', 'av2@example.test', '{}');

select ok(has_column_privilege('authenticated', 'public.profiles', 'avatar_key', 'update'), 'clients may set avatar_key');
select ok(public.is_valid_avatar_key(null), 'no avatar (null) is valid');
select ok(public.is_valid_avatar_key('paw'), 'a catalog key is valid');
select ok(public.is_valid_avatar_key('ice_cream'), 'another catalog key is valid');
select ok(not public.is_valid_avatar_key('Paw'), 'keys are exact (case-sensitive)');
select ok(not public.is_valid_avatar_key('https://evil.example/x.png'), 'a URL is not a key');
select ok(not public.is_valid_avatar_key(''), 'an empty key is not valid');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000d01","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ update public.profiles set avatar_key = 'rocket' where id = '00000000-0000-0000-0000-000000000d01' $$,
  'a user sets their avatar');
select is((select avatar_key from public.profiles where id = '00000000-0000-0000-0000-000000000d01'), 'rocket', 'it is stored');
select throws_ok($$ update public.profiles set avatar_key = 'not_a_key' where id = '00000000-0000-0000-0000-000000000d01' $$,
  '23514', null, 'an unknown key violates the check');
select lives_ok($$ update public.profiles set avatar_key = null where id = '00000000-0000-0000-0000-000000000d01' $$,
  'a user can remove their avatar');
update public.profiles set avatar_key = 'paw' where id = '00000000-0000-0000-0000-000000000d02';
reset role;
select is((select avatar_key from public.profiles where id = '00000000-0000-0000-0000-000000000d02'), null,
  'nobody can set someone else''s avatar (RLS: no row updated)');

select * from finish();
rollback;
