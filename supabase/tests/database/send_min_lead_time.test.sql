-- pgTAP tests for 20260927100000_send_min_lead_time.sql: send_letter() rejects a scheduled time
-- less than 1 minute ahead with `schedule_too_soon`, accepts exactly 1 minute, and leaves
-- schedule_in_past / schedule_too_far / send-now unchanged (sending.test.sql covers the rest of
-- send_letter()). now() is fixed for the whole test transaction, so the boundary is exact.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- Fixtures: c01 sender, c02 recipient (everyone).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000c01', 'c01@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000c02', 'c02@example.test', '{}');
update public.profiles as p
set username = v.username, display_name = v.display_name, receive_mode = 'everyone', onboarded_at = now()
from (values
  ('00000000-0000-0000-0000-000000000c01'::uuid, 'amy_lead', 'Amy'),
  ('00000000-0000-0000-0000-000000000c02'::uuid, 'ben_lead', 'Ben')
) as v (id, username, display_name)
where p.id = v.id;
insert into public.letters (id, sender_id, recipient_id, body) values
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02', 'lead one'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02', 'lead two'),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02', 'lead three');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000c01","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select public.send_letter('c0000000-0000-0000-0000-000000000001', now() + interval '1 second') $$,
  'P0001', 'schedule_too_soon', '1 second ahead is too soon'
);
select throws_ok(
  $$ select public.send_letter('c0000000-0000-0000-0000-000000000001', now() + interval '59.999 seconds') $$,
  'P0001', 'schedule_too_soon', 'just under 1 minute ahead is too soon'
);
select throws_ok(
  $$ select public.send_letter('c0000000-0000-0000-0000-000000000001', now()) $$,
  'P0001', 'schedule_in_past', 'now() is still schedule_in_past'
);
select throws_ok(
  $$ select public.send_letter('c0000000-0000-0000-0000-000000000001', now() - interval '1 minute') $$,
  'P0001', 'schedule_in_past', 'a past time is still schedule_in_past'
);
select throws_ok(
  $$ select public.send_letter('c0000000-0000-0000-0000-000000000001', now() + interval '5 years' + interval '1 second') $$,
  'P0001', 'schedule_too_far', 'more than 5 years ahead is still schedule_too_far'
);
select is(
  (select status from public.letters where id = 'c0000000-0000-0000-0000-000000000001'),
  'draft'::public.letter_status,
  'the rejected letter is still a draft'
);
select is(
  (select row(s.status, s.scheduled_at)::text
   from public.send_letter('c0000000-0000-0000-0000-000000000001', now() + interval '1 minute') s),
  row('scheduled'::public.letter_status, now() + interval '1 minute')::text,
  'exactly 1 minute ahead is accepted'
);
select is(
  (select s.status from public.send_letter('c0000000-0000-0000-0000-000000000002', now() + interval '2 minutes') s),
  'scheduled'::public.letter_status,
  '2 minutes ahead (the Phase 6 exit check) is accepted'
);
select is(
  (select s.status from public.send_letter('c0000000-0000-0000-0000-000000000003') s),
  'delivered'::public.letter_status,
  'send-now is unaffected and delivers immediately'
);
select is(
  (select s.status from public.send_letter('c0000000-0000-0000-0000-000000000001', now() + interval '1 second') s),
  'scheduled'::public.letter_status,
  'a retry on an already-scheduled letter still returns its state (idempotent) instead of an error'
);
reset role;

select * from finish();
rollback;
