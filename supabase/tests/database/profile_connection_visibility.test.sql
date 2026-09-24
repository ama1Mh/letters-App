-- pgTAP tests for profiles_select_connection_related (20260925130000_profile_connection_visibility.sql,
-- Phase 5). Run with `supabase test db` (CI: database.yml). no_plan() on purpose: written without a
-- local Postgres to count against.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------------------------
-- Fixtures: four users; 401/402 have a pending connection, 401/403 have an accepted one, 404 is
-- unrelated to everyone.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000401', 'v1@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000402', 'v2@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000403', 'v3@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000404', 'v4@example.test', '{}');

update public.profiles set username = 'vis_user_401', display_name = 'Vis 401' where id = '00000000-0000-0000-0000-000000000401';
update public.profiles set username = 'vis_user_402', display_name = 'Vis 402' where id = '00000000-0000-0000-0000-000000000402';
update public.profiles set username = 'vis_user_403', display_name = 'Vis 403' where id = '00000000-0000-0000-0000-000000000403';
update public.profiles set username = 'vis_user_404', display_name = 'Vis 404' where id = '00000000-0000-0000-0000-000000000404';

insert into public.connections (requester_id, addressee_id, status, via)
  values ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000402', 'pending', 'request');
insert into public.connections (requester_id, addressee_id, status, via, responded_at)
  values ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000403', 'accepted', 'request', now());

-- ---------------------------------------------------------------------------------------------
-- As user 401: can see 402 (pending, as requester) and 403 (accepted), not 404 (unrelated)
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000401","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select username from public.profiles where id = '00000000-0000-0000-0000-000000000402'),
  'vis_user_402',
  '401 can see 402''s profile through their pending connection'
);
select is(
  (select username from public.profiles where id = '00000000-0000-0000-0000-000000000403'),
  'vis_user_403',
  '401 can see 403''s profile through their accepted connection'
);
select is_empty(
  $$ select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000404' $$,
  '401 cannot see 404''s profile - no connection between them'
);
select is(
  (select username from public.profiles where id = '00000000-0000-0000-0000-000000000401'),
  'vis_user_401',
  '401 can still see their own profile (profiles_select_own, unaffected)'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- As user 402: sees 401 through the same pending row from the addressee side
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000402","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select username from public.profiles where id = '00000000-0000-0000-0000-000000000401'),
  'vis_user_401',
  '402 (the addressee) can see 401''s profile through the same pending connection'
);

reset role;

-- ---------------------------------------------------------------------------------------------
-- As user 404: unrelated to everyone, sees only themselves
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000404","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.profiles where id in (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000403'
  )),
  0,
  '404 sees none of the connected users'' profiles'
);

reset role;

select * from finish();
rollback;
