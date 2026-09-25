-- pgTAP tests for Phase 6 step 2 (20260925160000_delivery.sql): notification_outbox,
-- deliver_letter_internal(), deliver_due_letters(), and send-now delivering in the same
-- transaction. PLAN §6.6 threats in scope: a permission change between scheduling and delivery
-- makes the letter undeliverable with no notification; running delivery twice still gives exactly
-- one delivery and one notification per letter. True cross-connection concurrency cannot be shown
-- inside one pgTAP transaction; see supabase/tests/concurrency/deliver_twice.sh (CI).
-- Run with `supabase test db` (CI: database.yml). no_plan() on purpose: written without a local
-- Postgres to count against.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------------------------
-- Fixtures (as the table owner)
--   701 sam   sender under test (everyone)        705 wes   everyone -> switches to invite_only
--   702 rita  everyone                            706 xena  everyone -> account deleted
--   703 una   invite_only, connection -> removed  707 yuri  sender -> account deleted
--   704 vic   everyone -> blocks sam              708 zoe   invite_only, accepted connection
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000701', 'd701@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000702', 'd702@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000703', 'd703@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000704', 'd704@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000705', 'd705@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000706', 'd706@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000707', 'd707@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000708', 'd708@example.test', '{}');

update public.profiles as p
set username = v.username, display_name = v.display_name, receive_mode = v.mode::public.receive_mode,
    onboarded_at = now()
from (values
  ('00000000-0000-0000-0000-000000000701'::uuid, 'sam_seven', 'Sam', 'everyone'),
  ('00000000-0000-0000-0000-000000000702'::uuid, 'rita_seven', 'Rita', 'everyone'),
  ('00000000-0000-0000-0000-000000000703'::uuid, 'una_seven', 'Una', 'invite_only'),
  ('00000000-0000-0000-0000-000000000704'::uuid, 'vic_seven', 'Vic', 'everyone'),
  ('00000000-0000-0000-0000-000000000705'::uuid, 'wes_seven', 'Wes', 'everyone'),
  ('00000000-0000-0000-0000-000000000706'::uuid, 'xena_seven', 'Xena', 'everyone'),
  ('00000000-0000-0000-0000-000000000707'::uuid, 'yuri_seven', 'Yuri', 'everyone'),
  ('00000000-0000-0000-0000-000000000708'::uuid, 'zoe_seven', 'Zoe', 'invite_only')
) as v (id, username, display_name, mode)
where p.id = v.id;

insert into public.connections (requester_id, addressee_id, status, via, responded_at) values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000703', 'accepted', 'request', now()),
  ('00000000-0000-0000-0000-000000000708', '00000000-0000-0000-0000-000000000701', 'accepted', 'invite', now());

-- Letters, inserted directly as already-scheduled (as if send_letter() had accepted them earlier,
-- when every recipient was still allowed). Due = one minute ago.
insert into public.letters (id, sender_id, recipient_id, body, status, scheduled_at) values
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', 'body d1', 'scheduled', now() - interval '1 minute'),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', 'body d2', 'scheduled', now() - interval '1 minute'),
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', 'body d3', 'scheduled', now() - interval '2 minutes'),
  ('70000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', 'body future', 'scheduled', now() + interval '1 day'),
  ('70000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000704', 'body blocked', 'scheduled', now() - interval '1 minute'),
  ('70000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000705', 'body invite only now', 'scheduled', now() - interval '1 minute'),
  ('70000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000703', 'body connection removed', 'scheduled', now() - interval '1 minute'),
  ('70000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000708', 'body still connected', 'scheduled', now() - interval '1 minute'),
  ('70000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000706', 'body recipient deleted', 'scheduled', now() - interval '1 minute'),
  ('70000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000707', '00000000-0000-0000-0000-000000000702', 'body sender deleted', 'scheduled', now() - interval '1 minute'),
  ('70000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000701', 'body to self', 'scheduled', now() - interval '1 minute');
-- Drafts: one that was never sent, and three for send_letter() below.
insert into public.letters (id, sender_id, recipient_id, body) values
  ('70000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', 'body draft'),
  ('70000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', 'body send now'),
  ('70000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', 'body send later'),
  ('70000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', 'body unscheduled');

-- ---------------------------------------------------------------------------------------------
-- Structure and privileges
-- ---------------------------------------------------------------------------------------------
select has_table('public', 'notification_outbox', 'notification_outbox exists');
select ok((select relrowsecurity from pg_class where oid = 'public.notification_outbox'::regclass), 'RLS is enabled on notification_outbox');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'notification_outbox'), 0, 'notification_outbox has no policies (server-only)');
select columns_are(
  'public', 'notification_outbox',
  array['id', 'user_id', 'letter_id', 'type', 'status', 'attempts', 'next_attempt_at', 'locked_until',
        'expo_ticket_id', 'sent_at', 'error', 'created_at']::name[],
  'notification_outbox has exactly the agreed columns (no subject, body or other letter content)'
);
select col_is_unique('public', 'notification_outbox', array['letter_id', 'type']::name[], 'one notification event per (letter, type)');
select is(
  (select array_agg(e::text order by e) from unnest(enum_range(null::public.notification_type)) as e),
  array['letter_delivered'],
  'letter_delivered is the only notification type'
);

select ok(not has_table_privilege('anon', 'public.notification_outbox', 'select'), 'anon cannot read the outbox');
select ok(not has_table_privilege('authenticated', 'public.notification_outbox', 'select'), 'authenticated cannot read the outbox');
select ok(not has_table_privilege('authenticated', 'public.notification_outbox', 'insert'), 'authenticated cannot insert into the outbox');
select ok(not has_table_privilege('authenticated', 'public.notification_outbox', 'update'), 'authenticated cannot update the outbox');
select ok(not has_table_privilege('authenticated', 'public.notification_outbox', 'delete'), 'authenticated cannot delete from the outbox');
select ok(not has_any_column_privilege('authenticated', 'public.notification_outbox', 'select'), 'authenticated has no column-level read on the outbox either');
select ok(not has_function_privilege('authenticated', 'public.deliver_letter_internal(uuid)', 'execute'), 'authenticated cannot execute deliver_letter_internal');
select ok(not has_function_privilege('anon', 'public.deliver_letter_internal(uuid)', 'execute'), 'anon cannot execute deliver_letter_internal');
select ok(not has_function_privilege('authenticated', 'public.deliver_due_letters(int)', 'execute'), 'authenticated cannot execute deliver_due_letters');
select ok(not has_function_privilege('anon', 'public.deliver_due_letters(int)', 'execute'), 'anon cannot execute deliver_due_letters');
select ok(has_function_privilege('authenticated', 'public.send_letter(uuid, timestamptz)', 'execute'), 'authenticated can still call send_letter');
select ok(not has_function_privilege('anon', 'public.send_letter(uuid, timestamptz)', 'execute'), 'anon still cannot call send_letter');

-- The same, exercised for real as a signed-in client.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.deliver_due_letters() $$, '42501', null, 'a client cannot run deliver_due_letters');
select throws_ok($$ select public.deliver_letter_internal('70000000-0000-0000-0000-000000000001') $$, '42501', null, 'a client cannot run deliver_letter_internal');
select throws_ok($$ select count(*) from public.notification_outbox $$, '42501', null, 'a client cannot read the outbox');
select throws_ok(
  $$ insert into public.notification_outbox (user_id, letter_id, type)
     values ('00000000-0000-0000-0000-000000000701', '70000000-0000-0000-0000-000000000005', 'letter_delivered') $$,
  '42501', null, 'a client cannot forge an outbox row'
);
reset role;
set local role anon;
select throws_ok($$ select public.deliver_due_letters() $$, '42501', null, 'anon cannot run deliver_due_letters');
reset role;

-- ---------------------------------------------------------------------------------------------
-- Permission changes after scheduling (as the table owner)
-- ---------------------------------------------------------------------------------------------
insert into public.blocks (blocker_id, blocked_id)
  values ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000701');
update public.profiles set receive_mode = 'invite_only' where id = '00000000-0000-0000-0000-000000000705';
delete from public.connections
  where requester_id = '00000000-0000-0000-0000-000000000701' and addressee_id = '00000000-0000-0000-0000-000000000703';
update public.profiles set deleted_at = now()
  where id in ('00000000-0000-0000-0000-000000000706', '00000000-0000-0000-0000-000000000707');

-- ---------------------------------------------------------------------------------------------
-- deliver_letter_internal(): one letter
-- ---------------------------------------------------------------------------------------------
select is(public.deliver_letter_internal('70000000-0000-0000-0000-000000000001'), 'delivered'::public.letter_status, 'a due scheduled letter is delivered');
select is(
  (select row(status, delivered_at)::text from public.letters where id = '70000000-0000-0000-0000-000000000001'),
  row('delivered'::public.letter_status, now())::text,
  'the letter is delivered with delivered_at set'
);
select is(
  (select row(user_id, type, status, attempts, sent_at, expo_ticket_id, error, locked_until)::text
   from public.notification_outbox where letter_id = '70000000-0000-0000-0000-000000000001'),
  row('00000000-0000-0000-0000-000000000702'::uuid, 'letter_delivered'::public.notification_type,
      'pending'::public.notification_status, 0, null::timestamptz, null::text, null::text, null::timestamptz)::text,
  'exactly one pending letter_delivered outbox row, addressed to the recipient'
);
select is(public.deliver_letter_internal('70000000-0000-0000-0000-000000000001'), null::public.letter_status, 'delivering it again is a no-op');
select is(
  (select count(*)::int from public.notification_outbox where letter_id = '70000000-0000-0000-0000-000000000001'),
  1,
  'still exactly one outbox row after the second call'
);
select is(public.deliver_letter_internal('70000000-0000-0000-0000-000000000004'), null::public.letter_status, 'a letter scheduled in the future is not delivered early');
select is(public.deliver_letter_internal('70000000-0000-0000-0000-000000000005'), null::public.letter_status, 'a draft is never delivered');
select is(public.deliver_letter_internal('70000000-0000-0000-0000-0000000009ff'), null::public.letter_status, 'a nonexistent letter is a no-op');
select is(public.deliver_letter_internal(null), null::public.letter_status, 'a null id is a no-op');
select is(
  (select string_agg(status::text, ',' order by id) from public.letters
   where id in ('70000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000005')),
  'scheduled,draft',
  'the future letter stays scheduled and the draft stays a draft'
);

-- ---------------------------------------------------------------------------------------------
-- deliver_due_letters(): the batch
-- ---------------------------------------------------------------------------------------------
select throws_ok($$ select public.deliver_due_letters(0) $$, 'P0001', 'invalid_input', 'a batch size below 1 is rejected');
select throws_ok($$ select public.deliver_due_letters(null) $$, 'P0001', 'invalid_input', 'a null batch size is rejected');

-- Due now: d2, d3, blocked, invite-only-now, connection-removed, still-connected,
-- recipient-deleted, sender-deleted, to-self = 9 letters.
select is(public.deliver_due_letters(), 9, 'the batch transitions every due letter (delivered + undeliverable)');
select is(public.deliver_due_letters(), 0, 'a second run finds nothing left to do');

select is(
  (select string_agg(right(id::text, 2) || '=' || status::text, ',' order by id) from public.letters
   where id::text like '70000000-%' and id::text < '70000000-0000-0000-0000-000000000020'),
  '01=delivered,02=delivered,03=delivered,04=scheduled,05=draft,06=undeliverable,07=undeliverable,'
    || '08=undeliverable,09=delivered,10=undeliverable,11=undeliverable,12=delivered',
  'each letter reached the expected state'
);
select ok(
  (select bool_and(delivered_at = now()) from public.letters
   where id in ('70000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000003',
                '70000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000012')),
  'every delivered letter has delivered_at'
);
select ok(
  (select bool_and(delivered_at is null) from public.letters where status = 'undeliverable'
     and id::text like '70000000-%'),
  'undeliverable letters have no delivered_at'
);

-- Outbox: exactly one row per delivered letter, none for undeliverable ones.
select is(
  (select string_agg(right(letter_id::text, 2), ',' order by letter_id) from public.notification_outbox
   where letter_id::text like '70000000-%'),
  '01,02,03,09,12',
  'exactly the delivered letters have an outbox row'
);
select is(
  (select count(*)::int from public.notification_outbox o
   join public.letters l on l.id = o.letter_id
   where l.status = 'undeliverable' and l.id::text like '70000000-%'),
  0,
  'undeliverable letters produce no outbox row'
);
select is(
  (select count(*)::int from (
     select letter_id from public.notification_outbox group by letter_id, type having count(*) > 1) d),
  0,
  'no letter has more than one outbox row of a type'
);
select ok(
  (select bool_and(o.user_id = l.recipient_id) from public.notification_outbox o
   join public.letters l on l.id = o.letter_id where l.id::text like '70000000-%'),
  'every outbox row is addressed to its letter''s recipient'
);
select is(
  (select user_id from public.notification_outbox where letter_id = '70000000-0000-0000-0000-000000000012'),
  '00000000-0000-0000-0000-000000000701'::uuid,
  'a letter to yourself notifies yourself'
);
select ok(
  not exists (
    select 1 from public.notification_outbox o
    join public.letters l on l.id = o.letter_id
    where strpos(to_jsonb(o)::text, l.body) > 0),
  'no outbox row contains its letter''s body text'
);

-- Undeliverable is terminal: delivery never touches it again.
select is(public.deliver_letter_internal('70000000-0000-0000-0000-000000000006'), null::public.letter_status, 'an undeliverable letter is never retried');

-- The unique constraint holds even for a direct insert by the table owner.
select throws_ok(
  $$ insert into public.notification_outbox (user_id, letter_id, type)
     values ('00000000-0000-0000-0000-000000000702', '70000000-0000-0000-0000-000000000001', 'letter_delivered') $$,
  '23505', null, 'a second letter_delivered event for the same letter is rejected'
);

-- Batch size is respected: three more due letters, delivered two then one.
insert into public.letters (sender_id, recipient_id, subject, body, status, scheduled_at)
select '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', 'batch', 'batch ' || n,
       'scheduled', now() - interval '1 minute'
from generate_series(1, 3) as n;
select is(public.deliver_due_letters(2), 2, 'p_batch caps how many letters one run processes');
select is(public.deliver_due_letters(5), 1, 'the next run picks up the rest');
select is(
  (select count(*)::int from public.letters where subject = 'batch' and sender_id = '00000000-0000-0000-0000-000000000701' and status = 'delivered'),
  3,
  'all three batch letters were delivered, each once'
);

-- ---------------------------------------------------------------------------------------------
-- What the recipient and sender see afterwards
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000702","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.letters where id = '70000000-0000-0000-0000-000000000001'),
  1,
  'the recipient now sees the delivered letter'
);
select is(
  (select count(*)::int from public.letters where id = '70000000-0000-0000-0000-000000000011'),
  0,
  'the recipient never sees an undeliverable letter'
);
select is(
  (select count(*)::int from public.letters where id = '70000000-0000-0000-0000-000000000004'),
  0,
  'the recipient still cannot see the future scheduled letter'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000701","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select status from public.letters where id = '70000000-0000-0000-0000-000000000006'),
  'undeliverable'::public.letter_status,
  'the sender sees the neutral undeliverable status (no reason is stored or exposed)'
);

-- ---------------------------------------------------------------------------------------------
-- send_letter(): send-now delivers in the same transaction; scheduled sends wait for cron
-- ---------------------------------------------------------------------------------------------
select is(
  (select row(s.status, s.scheduled_at, s.delivered_at)::text from public.send_letter('70000000-0000-0000-0000-000000000020') s),
  row('delivered'::public.letter_status, now(), now())::text,
  'send-now returns delivered, with scheduled_at = delivered_at = now()'
);
select is(
  (select s.status from public.send_letter('70000000-0000-0000-0000-000000000020') s),
  'delivered'::public.letter_status,
  'replaying send-now returns the delivered state'
);
select is(
  (select row(s.status, s.delivered_at)::text from public.send_letter('70000000-0000-0000-0000-000000000021', now() + interval '1 hour') s),
  row('scheduled'::public.letter_status, null::timestamptz)::text,
  'a scheduled send is not delivered early'
);
select is(
  (select s.status from public.send_letter('70000000-0000-0000-0000-000000000022', now() + interval '1 hour') s),
  'scheduled'::public.letter_status,
  'a second letter scheduled for later'
);
select is(
  (select s.status from public.unschedule_letter('70000000-0000-0000-0000-000000000022') s),
  'draft'::public.letter_status,
  'which is then unscheduled'
);
reset role;

select is(
  (select count(*)::int from public.notification_outbox where letter_id = '70000000-0000-0000-0000-000000000020'),
  1,
  'send-now created exactly one outbox row, even after a replay'
);
select is(
  (select count(*)::int from public.notification_outbox where letter_id = '70000000-0000-0000-0000-000000000021'),
  0,
  'a letter scheduled for later has no outbox row yet'
);

-- Once the scheduled letter comes due (simulated by moving its time back), cron delivers it; the
-- unscheduled letter (a draft again) is ignored.
update public.letters set scheduled_at = now() - interval '1 minute' where id = '70000000-0000-0000-0000-000000000021';
select is(public.deliver_due_letters(), 1, 'cron delivers the scheduled send once it is due, and nothing else');
select is(
  (select string_agg(status::text, ',' order by id) from public.letters
   where id in ('70000000-0000-0000-0000-000000000021', '70000000-0000-0000-0000-000000000022')),
  'delivered,draft',
  'the scheduled send is delivered; the unscheduled letter is still a draft'
);
select is(
  (select count(*)::int from public.notification_outbox where letter_id = '70000000-0000-0000-0000-000000000021'),
  1,
  'and it has exactly one outbox row'
);

-- A send-now whose recipient became unreachable is still refused up front (step 1), so send-now
-- never produces an undeliverable letter: the same checks run just before delivery.
update public.profiles set receive_mode = 'invite_only' where id = '00000000-0000-0000-0000-000000000702';
insert into public.letters (id, sender_id, recipient_id, body) values
  ('70000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702', 'body refused');
set local role authenticated;
select throws_ok($$ select public.send_letter('70000000-0000-0000-0000-000000000023') $$, 'P0001', 'cannot_send', 'send-now to a now-invite-only recipient is refused');
reset role;
select is(
  (select row(l.status, (select count(*) from public.notification_outbox o where o.letter_id = l.id))::text
   from public.letters l where l.id = '70000000-0000-0000-0000-000000000023'),
  row('draft'::public.letter_status, 0::bigint)::text,
  'the refused letter stays a draft with no outbox row'
);

select * from finish();
rollback;
