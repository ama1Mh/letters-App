-- pgTAP tests for 20260930100000_push_preference.sql: the "push me on delivery" preference
-- (DEC-052). Only the push is silenced; the claim still returns the row so the sender closes it.
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose, as in the other files.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- p01 sender, p02 recipient (push off), p03 recipient (push on, the default)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000e01', 'p01@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000e02', 'p02@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000e03', 'p03@example.test', '{}');
update public.profiles as p
set username = v.username, display_name = v.username, onboarded_at = now(), receive_mode = 'everyone'
from (values
  ('00000000-0000-0000-0000-000000000e01'::uuid, 'pref_sender'),
  ('00000000-0000-0000-0000-000000000e02'::uuid, 'pref_quiet'),
  ('00000000-0000-0000-0000-000000000e03'::uuid, 'pref_loud')
) as v (id, username)
where p.id = v.id;

select ok((select push_on_delivery from public.profiles where id = '00000000-0000-0000-0000-000000000e02'),
  'push on delivery is on by default');
select ok(has_column_privilege('authenticated', 'public.profiles', 'push_on_delivery', 'update'),
  'clients may change push_on_delivery');
select ok(not has_function_privilege('authenticated', 'public.claim_notifications(integer, interval)', 'execute'),
  'clients still cannot claim notifications');
select ok(not has_function_privilege('anon', 'public.claim_notifications(integer, interval)', 'execute'),
  'anon still cannot claim notifications');
select ok(has_function_privilege('service_role', 'public.claim_notifications(integer, interval)', 'execute'),
  'service_role can still claim notifications');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000e02","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ update public.profiles set push_on_delivery = false where id = '00000000-0000-0000-0000-000000000e02' $$,
  'a user turns push off');
update public.profiles set push_on_delivery = false where id = '00000000-0000-0000-0000-000000000e03';
reset role;
select ok(not (select push_on_delivery from public.profiles where id = '00000000-0000-0000-0000-000000000e02'),
  'it is stored');
select ok((select push_on_delivery from public.profiles where id = '00000000-0000-0000-0000-000000000e03'),
  'nobody can change someone else''s preference (RLS: no row updated)');

insert into public.devices (user_id, push_token, platform) values
  ('00000000-0000-0000-0000-000000000e02', 'ExponentPushToken[quiet-phone-1]', 'android'),
  ('00000000-0000-0000-0000-000000000e03', 'ExponentPushToken[loud-phone-01]', 'android');
insert into public.letters (id, sender_id, recipient_id, body, status, scheduled_at, delivered_at) values
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-000000000e02', 'to quiet', 'delivered', now(), now()),
  ('e1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-000000000e03', 'to loud', 'delivered', now(), now());
insert into public.notification_outbox (id, user_id, letter_id, type) values
  ('e1100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000e02', 'e1000000-0000-0000-0000-000000000001', 'letter_delivered'),
  ('e1100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000e03', 'e1000000-0000-0000-0000-000000000002', 'letter_delivered');

set local role service_role;
create temp table pref_claim as select * from public.claim_notifications(500);
reset role;
select is((select count(*)::int from pref_claim where outbox_id in (
    'e1100000-0000-0000-0000-000000000001', 'e1100000-0000-0000-0000-000000000002')),
  2, 'both rows are still claimed (the sender closes the silenced one)');
select is((select coalesce(array_length(push_tokens, 1), 0) from pref_claim
    where outbox_id = 'e1100000-0000-0000-0000-000000000001'),
  0, 'push off: no tokens are returned');
select is((select push_tokens from pref_claim where outbox_id = 'e1100000-0000-0000-0000-000000000002'),
  array['ExponentPushToken[loud-phone-01]'], 'push on: the device token is returned');
select is((select status::text from public.letters where id = 'e1000000-0000-0000-0000-000000000001'),
  'delivered', 'the letter itself is delivered either way');

select * from finish();
rollback;
