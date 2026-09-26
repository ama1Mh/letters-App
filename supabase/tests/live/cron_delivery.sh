#!/usr/bin/env bash
# Live pg_cron delivery test (Phase 6 exit criteria; PLAN §6.6). Real time, real pg_cron: nothing
# here calls a delivery function directly - only the 'deliver-due-letters' job does.
#
#   1. Two letters are sent through send_letter() as a real user, scheduled 2 minutes ahead.
#   2. Before they are due, the second recipient blocks the sender (a permission change).
#   3. The script waits for the job: letter 1 must become 'delivered' with exactly one outbox row
#      and one letter_delivered broadcast; letter 2 must become 'undeliverable' with none.
#   4. It then waits for at least one more job run after delivery and checks that nothing was
#      delivered or notified twice, and that no job run failed.
#
# Like deliver_twice.sh this commits fixtures to the throwaway local Supabase stack CI starts and
# must never be pointed at a real project. Takes about 3-4 minutes.
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
DB_CONTAINER="${DB_CONTAINER:-supabase_db_letters}"

if command -v psql >/dev/null 2>&1; then
  q() { psql "$DB_URL" -v ON_ERROR_STOP=1 -Atq "$@"; }
else
  q() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq "$@"; }
fi

fail() {
  echo "::error title=live cron delivery::$*"
  echo "Recent job runs:"
  q -c "select d.start_time, d.status, d.return_message from cron.job_run_details d
        join cron.job j using (jobid) where j.jobname = 'deliver-due-letters'
        order by d.start_time desc limit 10" || true
  exit 1
}

SENDER=00000000-0000-0000-0000-000000000e01
OK_RECIPIENT=00000000-0000-0000-0000-000000000e02
BLOCKER=00000000-0000-0000-0000-000000000e03
L_OK=e0000000-0000-0000-0000-000000000001
L_BLOCKED=e0000000-0000-0000-0000-000000000002

# As a signed-in user: the JWT claims PostgREST would set, then the client role.
as_user() {
  local uid=$1 sql=$2
  q <<SQL | tail -n1
begin;
select set_config('request.jwt.claims', '{"sub":"$uid","role":"authenticated"}', true);
set local role authenticated;
$sql
commit;
SQL
}

[ "$(q -c "select active from cron.job where jobname = 'deliver-due-letters'")" = t ] \
  || fail "the deliver-due-letters job is missing or inactive"

echo "Seeding users and drafts"
q <<SQL
insert into auth.users (id, email, raw_user_meta_data) values
  ('$SENDER', 'live1@example.test', '{}'),
  ('$OK_RECIPIENT', 'live2@example.test', '{}'),
  ('$BLOCKER', 'live3@example.test', '{}');
update public.profiles as p set username = v.u, display_name = v.d, onboarded_at = now(), receive_mode = 'everyone'
from (values ('$SENDER'::uuid, 'live_sender', 'Sender'), ('$OK_RECIPIENT'::uuid, 'live_recipient', 'Recipient'),
             ('$BLOCKER'::uuid, 'live_blocker', 'Blocker')) as v (id, u, d)
where p.id = v.id;
insert into public.letters (id, sender_id, recipient_id, body) values
  ('$L_OK', '$SENDER', '$OK_RECIPIENT', 'live letter one'),
  ('$L_BLOCKED', '$SENDER', '$BLOCKER', 'live letter two');
SQL

echo "Scheduling both letters 2 minutes ahead through send_letter()"
[ "$(as_user "$SENDER" "select (public.send_letter('$L_OK', now() + interval '2 minutes')).status;")" = scheduled ] \
  || fail "send_letter did not schedule letter 1"
[ "$(as_user "$SENDER" "select (public.send_letter('$L_BLOCKED', now() + interval '2 minutes')).status;")" = scheduled ] \
  || fail "send_letter did not schedule letter 2"

echo "Permission change before delivery: the second recipient blocks the sender"
as_user "$BLOCKER" "select public.block_user('$SENDER');" >/dev/null
[ "$(q -c "select count(*) from public.letters where id in ('$L_OK', '$L_BLOCKED') and status = 'scheduled'")" = 2 ] \
  || fail "a letter left 'scheduled' before it was due"

echo "Waiting for the cron job (up to 4 minutes)"
for _ in $(seq 1 48); do
  [ "$(q -c "select count(*) from public.letters where id in ('$L_OK', '$L_BLOCKED') and status = 'scheduled'")" = 0 ] && break
  sleep 5
done

[ "$(q -c "select status from public.letters where id = '$L_OK'")" = delivered ] \
  || fail "letter 1 is not delivered"
[ "$(q -c "select delivered_at >= scheduled_at from public.letters where id = '$L_OK'")" = t ] \
  || fail "letter 1 was delivered before its scheduled time"
[ "$(q -c "select status from public.letters where id = '$L_BLOCKED'")" = undeliverable ] \
  || fail "letter 2 (recipient blocked the sender) is not undeliverable"
echo "  letter 1 delivered $(q -c "select round(extract(epoch from delivered_at - scheduled_at)) from public.letters where id = '$L_OK'")s after its scheduled time"

delivered_at=$(q -c "select delivered_at from public.letters where id = '$L_OK'")

echo "Waiting for another job run after delivery"
for _ in $(seq 1 30); do
  [ "$(q -c "select count(*) from cron.job_run_details d join cron.job j using (jobid)
             where j.jobname = 'deliver-due-letters' and d.status <> 'running'
               and d.start_time > '$delivered_at'::timestamptz + interval '1 second'")" -ge 1 ] && break
  sleep 5
done
[ "$(q -c "select count(*) from cron.job_run_details d join cron.job j using (jobid)
           where j.jobname = 'deliver-due-letters' and d.status <> 'running'
             and d.start_time > '$delivered_at'::timestamptz + interval '1 second'")" -ge 1 ] \
  || fail "no job run completed after the delivery"

[ "$(q -c "select delivered_at = '$delivered_at'::timestamptz from public.letters where id = '$L_OK'")" = t ] \
  || fail "letter 1 was delivered again (delivered_at changed)"
[ "$(q -c "select count(*) from public.notification_outbox where letter_id = '$L_OK'")" = 1 ] \
  || fail "letter 1 does not have exactly one outbox row"
[ "$(q -c "select count(*) from public.notification_outbox where letter_id = '$L_BLOCKED'")" = 0 ] \
  || fail "the undeliverable letter has an outbox row"
[ "$(q -c "select count(*) from realtime.messages where topic = 'letters:$OK_RECIPIENT' and event = 'letter_delivered' and payload ->> 'letter_id' = '$L_OK'")" = 1 ] \
  || fail "the recipient did not get exactly one letter_delivered broadcast"
[ "$(q -c "select count(*) from realtime.messages where topic = 'letters:$BLOCKER'")" = 0 ] \
  || fail "the blocking recipient got a broadcast for an undeliverable letter"
[ "$(q -c "select count(*) from cron.job_run_details d join cron.job j using (jobid) where j.jobname = 'deliver-due-letters' and d.status = 'failed'")" = 0 ] \
  || fail "a deliver-due-letters job run failed"

echo "Live cron delivery checks passed"
