#!/usr/bin/env bash
# Cross-connection concurrency test for delivery (PLAN §6.6: "cron function run twice concurrently
# -> still exactly one delivery/notification per letter"; Phase 6 exit criterion).
#
# pgTAP cannot show this: a pgTAP file is one transaction, so its fixtures are invisible to any
# second connection. This script instead commits its own fixtures to the throwaway local Supabase
# stack that CI starts (`supabase start`), then runs real overlapping sessions:
#
#   A. Two deliver_due_letters(30) runs at the same time over 50 due letters, each holding its
#      transaction open for 2 s (the script checks that the two transactions really overlapped).
#      SKIP LOCKED must split the rows between them: together they transition exactly 50, and
#      every letter ends delivered with exactly one outbox row.
#   B. A deliver_due_letters() run holds a due letter locked for 3 s while a second session calls
#      deliver_letter_internal() on that same letter. The second call must wait for the lock, then
#      see the committed 'delivered' row and do nothing (return null): still one outbox row.
#
# Run after the pgTAP step (database.yml); it leaves committed rows behind, which is fine on the
# throwaway CI stack. Never point it at a real project.
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
DB_CONTAINER="${DB_CONTAINER:-supabase_db_letters}"

# psql with: stop on error, unaligned tuples-only output, no command tags.
if command -v psql >/dev/null 2>&1; then
  q() { psql "$DB_URL" -v ON_ERROR_STOP=1 -Atq "$@"; }
else
  q() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq "$@"; }
fi

fail() { echo "::error title=delivery concurrency::$*"; exit 1; }
work=$(mktemp -d)

SENDER=00000000-0000-0000-0000-000000000c01
RECIPIENT=00000000-0000-0000-0000-000000000c02
TARGET=c0000000-0000-0000-0000-000000000001

echo "Seeding committed fixtures"
q <<SQL
insert into auth.users (id, email, raw_user_meta_data) values
  ('$SENDER', 'cc1@example.test', '{}'),
  ('$RECIPIENT', 'cc2@example.test', '{}');
update public.profiles set username = 'conc_sender', display_name = 'Sender', onboarded_at = now(),
  receive_mode = 'everyone' where id = '$SENDER';
update public.profiles set username = 'conc_recipient', display_name = 'Recipient', onboarded_at = now(),
  receive_mode = 'everyone' where id = '$RECIPIENT';
insert into public.letters (sender_id, recipient_id, subject, body, status, scheduled_at)
select '$SENDER', '$RECIPIENT', 'concurrency-a', 'letter ' || n, 'scheduled', now() - interval '1 minute'
from generate_series(1, 50) as n;
SQL

[ "$(q -c "select count(*) from public.letters where status = 'scheduled' and scheduled_at <= now()")" = 50 ] \
  || fail "expected exactly 50 due letters before scenario A"

# ---------------------------------------------------------------------------------------------
echo "Scenario A: two overlapping deliver_due_letters(30) runs over 50 due letters"
run_batch() {
  # Output lines: transaction start (epoch), letters transitioned, time just before commit.
  q <<'SQL'
begin;
select extract(epoch from clock_timestamp());
select public.deliver_due_letters(30);
do $$ begin perform pg_sleep(2); end $$;
select extract(epoch from clock_timestamp());
commit;
SQL
}
run_batch >"$work/a1" &
p1=$!
run_batch >"$work/a2" &
p2=$!
wait "$p1"
wait "$p2"
n1=$(sed -n 2p "$work/a1")
n2=$(sed -n 2p "$work/a2")
echo "  run 1 transitioned $n1, run 2 transitioned $n2"
overlap=$(q -c "select $(sed -n 1p "$work/a1") < $(sed -n 3p "$work/a2") and $(sed -n 1p "$work/a2") < $(sed -n 3p "$work/a1")")
[ "$overlap" = t ] || fail "the two runs' transactions did not overlap in time, so this proved nothing; rerun"
[ $((n1 + n2)) -eq 50 ] || fail "the two runs transitioned $n1 + $n2 letters, expected 50 in total"

[ "$(q -c "select count(*) from public.letters where subject = 'concurrency-a' and status = 'delivered'")" = 50 ]   || fail "not every scenario A letter is delivered"
[ "$(q -c "select count(*) from public.notification_outbox o join public.letters l on l.id = o.letter_id where l.subject = 'concurrency-a'")" = 50 ]   || fail "scenario A did not produce exactly 50 outbox rows"
[ "$(q -c "select count(*) from (select letter_id from public.notification_outbox group by letter_id, type having count(*) > 1) d")" = 0 ]   || fail "a letter has more than one outbox row"
[ "$(q -c "select public.deliver_due_letters()")" = 0 ] || fail "a third run still found due letters"

# ---------------------------------------------------------------------------------------------
echo "Scenario B: deliver_letter_internal() on a letter a running batch holds locked"
q <<SQL
insert into public.letters (id, sender_id, recipient_id, subject, body, status, scheduled_at)
values ('$TARGET', '$SENDER', '$RECIPIENT', 'concurrency-b', 'target letter', 'scheduled', now() - interval '1 minute');
SQL

q >"$work/b1" <<'SQL' &
begin;
select public.deliver_due_letters();
do $$ begin perform pg_sleep(3); end $$;
commit;
SQL
pb=$!
sleep 1
start=$(date +%s)
second=$(q -c "select coalesce(public.deliver_letter_internal('$TARGET')::text, 'null')")
elapsed=$(( $(date +%s) - start ))
wait "$pb"
echo "  batch transitioned $(head -n1 "$work/b1"); the second call returned '$second' after ${elapsed}s"

[ "$(head -n1 "$work/b1")" = 1 ] || fail "the batch should have delivered the target letter"
[ "$second" = null ] || fail "the second call returned '$second'; it must be a no-op once the batch delivered the letter"
[ "$elapsed" -ge 1 ] || fail "the second call returned after ${elapsed}s; it should have waited for the batch's row lock"
[ "$(q -c "select count(*) from public.notification_outbox where letter_id = '$TARGET'")" = 1 ] \
  || fail "the target letter does not have exactly one outbox row"

echo "Delivery concurrency checks passed"
