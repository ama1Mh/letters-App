-- pgTAP tests for Phase 7's server side (20260929180000_push.sql): devices (owner-only reads, RPC
-- writes, token hand-over), and the service_role sender API (lease, backoff, failure, content-free
-- rows, dead tokens), plus delete_my_account removing devices.
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose, as in the other files.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- h01 amy (sender), h02 ben (recipient, locale ar), h03 cat (deleted sender)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000b11', 'h01@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000b12', 'h02@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000b13', 'h03@example.test', '{}');
update public.profiles as p
set username = v.username, display_name = v.display_name, locale = v.locale::public.app_locale,
    onboarded_at = now(), receive_mode = 'everyone'
from (values
  ('00000000-0000-0000-0000-000000000b11'::uuid, 'amy_push', 'Amy', 'en'),
  ('00000000-0000-0000-0000-000000000b12'::uuid, 'ben_push', 'Ben', 'ar'),
  ('00000000-0000-0000-0000-000000000b13'::uuid, 'cat_push', 'Cat', 'en')
) as v (id, username, display_name, locale)
where p.id = v.id;

insert into public.letters (id, sender_id, recipient_id, body, status, scheduled_at, delivered_at) values
  ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-000000000b12', 'secret body', 'delivered', now(), now()),
  ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000b13', '00000000-0000-0000-0000-000000000b12', 'from cat', 'delivered', now(), now());
insert into public.notification_outbox (id, user_id, letter_id, type) values
  ('b1100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000b12', 'b1000000-0000-0000-0000-000000000001', 'letter_delivered'),
  ('b1100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000b12', 'b1000000-0000-0000-0000-000000000002', 'letter_delivered');
update public.profiles set deleted_at = now() where id = '00000000-0000-0000-0000-000000000b13';

-- ---------------------------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.devices'::regclass), 'RLS is enabled on devices');
select policies_are('public', 'devices', array['devices_select_own']::name[], 'devices has only the owner-select policy');
select ok(not has_table_privilege('authenticated', 'public.devices', 'insert'), 'clients cannot insert devices directly');
select ok(not has_table_privilege('authenticated', 'public.devices', 'update'), 'clients cannot update devices directly');
select ok(not has_table_privilege('authenticated', 'public.devices', 'delete'), 'clients cannot delete devices directly');
select ok(not has_column_privilege('authenticated', 'public.devices', 'push_token', 'select'), 'clients cannot read push tokens');
select ok(not has_table_privilege('anon', 'public.devices', 'select'), 'anon cannot read devices');
select ok(has_function_privilege('authenticated', 'public.register_device(text, text, text)', 'execute'), 'authenticated can register a device');
select ok(not has_function_privilege('anon', 'public.register_device(text, text, text)', 'execute'), 'anon cannot register a device');
select ok(not has_function_privilege('authenticated', 'public.claim_notifications(integer, interval)', 'execute'), 'clients cannot claim notifications');
select ok(not has_function_privilege('authenticated', 'public.complete_notification(uuid, boolean, text, text)', 'execute'), 'clients cannot complete notifications');
select ok(not has_function_privilege('authenticated', 'public.forget_device_token(text)', 'execute'), 'clients cannot forget tokens');
select ok(not has_function_privilege('anon', 'public.claim_notifications(integer, interval)', 'execute'), 'anon cannot claim notifications');
select ok(has_function_privilege('service_role', 'public.claim_notifications(integer, interval)', 'execute'), 'service_role can claim notifications');
select ok(has_function_privilege('service_role', 'public.complete_notification(uuid, boolean, text, text)', 'execute'), 'service_role can complete notifications');

-- ---------------------------------------------------------------------------------------------
-- register_device / unregister_device
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b11","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.register_device('ExponentPushToken[shared-device-1]', 'android', '1.0.0') $$,
  'amy registers her device');
select is((select count(*)::int from public.devices), 1, 'amy sees her own device');
select throws_ok($$ select public.register_device('not-a-token', 'android') $$, 'P0001', 'invalid_input', 'a malformed token is rejected');
select throws_ok($$ select public.register_device('ExponentPushToken[another-device]', 'windows') $$, 'P0001', 'invalid_input', 'an unknown platform is rejected');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b12","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.register_device('ExponentPushToken[shared-device-1]', 'android', '1.0.1') $$,
  'ben signs in on the same device: the token moves to him');
select lives_ok($$ select public.register_device('ExponentPushToken[bens-own-phone]', 'android') $$, 'ben registers a second device');
select is((select count(*)::int from public.devices), 2, 'ben sees his two devices');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b11","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.devices), 0, 'amy no longer sees the handed-over device');
select lives_ok($$ select public.unregister_device('ExponentPushToken[bens-own-phone]') $$, 'unregistering someone else''s token is silent');
reset role;
select is((select count(*)::int from public.devices where push_token = 'ExponentPushToken[bens-own-phone]'), 1,
  '...and does not remove it');

-- ---------------------------------------------------------------------------------------------
-- The sender: claim, lease, backoff, content
-- ---------------------------------------------------------------------------------------------
set local role service_role;
create temp table claim1 as select * from public.claim_notifications(10);
select is((select count(*)::int from claim1), 2, 'both due rows are claimed');
select is(
  (select recipient_locale::text from claim1 where outbox_id = 'b1100000-0000-0000-0000-000000000001'),
  'ar', 'the push is localized from the recipient''s locale');
select is(
  (select sender_display_name || '/' || sender_username from claim1 where outbox_id = 'b1100000-0000-0000-0000-000000000001'),
  'Amy/amy_push', 'the sender''s public name is provided');
select is(
  (select sender_username from claim1 where outbox_id = 'b1100000-0000-0000-0000-000000000002'),
  null, 'a deleted sender has no name');
select is(
  (select array_length(push_tokens, 1) from claim1 where outbox_id = 'b1100000-0000-0000-0000-000000000001'),
  2, 'every device of the recipient is returned');
select is_empty(
  $$ select 1 from information_schema.routines r
     join information_schema.parameters p on p.specific_name = r.specific_name
     where r.routine_name = 'claim_notifications' and p.parameter_mode = 'OUT'
       and p.parameter_name in ('body', 'subject', 'preview', 'email') $$,
  'no letter content or email in what the sender receives');
select is((select count(*)::int from public.claim_notifications(10)), 0, 'leased rows are not claimed again');

select lives_ok($$ select public.complete_notification('b1100000-0000-0000-0000-000000000001', false, null, 'DeviceNotRegistered') $$,
  'a failed attempt is recorded');
reset role;
select ok(
  (select status = 'pending' and attempts = 1 and next_attempt_at > now() and locked_until is null
   from public.notification_outbox where id = 'b1100000-0000-0000-0000-000000000001'),
  'a failed attempt backs off and stays pending');

update public.notification_outbox set next_attempt_at = now() - interval '1 second'
  where id = 'b1100000-0000-0000-0000-000000000001';
set local role service_role;
select is((select count(*)::int from public.claim_notifications(10)), 1, 'once due again, it is claimed again');
select lives_ok($$ select public.complete_notification('b1100000-0000-0000-0000-000000000001', true, 'ticket-1') $$,
  'a successful send is recorded');
reset role;
select ok(
  (select status = 'sent' and sent_at is not null and expo_ticket_id = 'ticket-1'
   from public.notification_outbox where id = 'b1100000-0000-0000-0000-000000000001'),
  'the row is sent with its ticket');

update public.notification_outbox set attempts = 7 where id = 'b1100000-0000-0000-0000-000000000002';
set local role service_role;
select lives_ok($$ select public.complete_notification('b1100000-0000-0000-0000-000000000002', false, null, 'MessageRateExceeded') $$,
  'an 8th failure is recorded');
reset role;
select is((select status::text from public.notification_outbox where id = 'b1100000-0000-0000-0000-000000000002'),
  'failed', 'after the 8th failed attempt the row is failed for good');

set local role service_role;
select lives_ok($$ select public.forget_device_token('ExponentPushToken[shared-device-1]') $$, 'a dead token is forgotten');
reset role;
select is((select count(*)::int from public.devices where push_token = 'ExponentPushToken[shared-device-1]'), 0, 'the dead token is gone');

-- ---------------------------------------------------------------------------------------------
-- delete_my_account removes the account's devices
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b12","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.delete_my_account() $$, 'ben deletes his account');
reset role;
select is((select count(*)::int from public.devices where user_id = '00000000-0000-0000-0000-000000000b12'), 0,
  'his devices are gone');

select * from finish();
rollback;
