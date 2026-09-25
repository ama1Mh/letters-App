-- Phase 6 step 2: delivery and the notification outbox (PLAN §3.3/§4.1/§6.5, DEC-005/013/044).
-- Forward-only. The pg_cron schedule that calls deliver_due_letters() every minute is a separate,
-- later migration; nothing here runs on its own.
--
-- The one authoritative delivery transition is deliver_letter_internal(): it is the only code that
-- moves a letter out of 'scheduled' into 'delivered' or 'undeliverable', and the only producer of
-- notification_outbox rows. deliver_due_letters() (cron) and send_letter() (send-now, redefined
-- below per DEC-044 (1)) both go through it.

-- ---------------------------------------------------------------------------------------------
-- notification_outbox (server-only)
-- ---------------------------------------------------------------------------------------------

create type public.notification_type as enum ('letter_delivered');
create type public.notification_status as enum ('pending', 'sent', 'failed');

-- One row per notification to send. Deliberately holds no letter content (no subject, no body,
-- no sender name): the Phase 7 sender builds the localized push text from profiles.locale and the
-- sender's public profile at send time, and the push payload carries only the letter id (PLAN
-- §6.5, DEC-004). `error` is for the push provider's error code/message, never letter content.
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  -- The person to notify (the letter's recipient).
  user_id uuid not null references public.profiles (id),
  letter_id uuid not null references public.letters (id),
  type public.notification_type not null,
  status public.notification_status not null default 'pending',
  attempts int not null default 0,
  -- Phase 7: earliest time the sender may (re)try this row (backoff).
  next_attempt_at timestamptz not null default now(),
  -- Phase 7: a claim lease, so concurrent sender runs never send the same row twice.
  locked_until timestamptz,
  expo_ticket_id text,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  -- At most one notification event of each type per letter, whoever inserts it.
  constraint notification_outbox_letter_type_key unique (letter_id, type),
  constraint notification_outbox_attempts_nonnegative check (attempts >= 0),
  constraint notification_outbox_sent_consistency check ((status = 'sent') = (sent_at is not null))
);

-- Phase 7's claim query: pending rows whose next attempt is due.
create index notification_outbox_pending_idx on public.notification_outbox (next_attempt_at)
  where status = 'pending';
create index notification_outbox_user_idx on public.notification_outbox (user_id);

alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from public, anon, authenticated;
-- No policies and no client grants: written only by deliver_letter_internal() below, read and
-- updated only by the Phase 7 sender (service-side). Same model as api_rate_limits.

-- ---------------------------------------------------------------------------------------------
-- deliver_letter_internal(id): the single-letter delivery transition
-- ---------------------------------------------------------------------------------------------

-- Returns the letter's new status when this call transitioned it ('delivered' or
-- 'undeliverable'), or null when it did nothing: no such letter, not scheduled (a draft, or
-- already delivered/undeliverable - so calling it again is a no-op), or not due yet.
--
-- Locks the row first. From deliver_due_letters() and send_letter() the caller already holds that
-- lock; a concurrent standalone call waits for it, then re-reads the committed row and sees it is
-- no longer 'scheduled'. Either way a letter is transitioned, and notified, at most once.
--
-- Re-checks permission at delivery time (DEC-005/007/013, PLAN §3.3): a missing or deleted sender
-- or recipient, a block in either direction, or losing invite-only access (recipient switched to
-- invite_only, connection removed) makes the letter 'undeliverable' - with no outbox row, so the
-- recipient is never notified and never sees it (letters_select_recipient only shows 'delivered').
--
-- Internal only: not executable by anon or authenticated.
create function public.deliver_letter_internal(p_letter_id uuid)
returns public.letter_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_letter public.letters;
begin
  select * into v_letter
  from public.letters
  where id = p_letter_id
  for update;

  if not found or v_letter.status <> 'scheduled' or v_letter.scheduled_at > now() then
    return null;
  end if;

  if not exists (
       select 1 from public.profiles
       where id = v_letter.sender_id and onboarded_at is not null and deleted_at is null)
     or not exists (
       select 1 from public.profiles
       where id = v_letter.recipient_id and onboarded_at is not null and deleted_at is null)
     or not public.can_send(v_letter.sender_id, v_letter.recipient_id, v_letter.parent_letter_id) then
    update public.letters set status = 'undeliverable' where id = p_letter_id;
    return 'undeliverable';
  end if;

  update public.letters
  set status = 'delivered', delivered_at = now()
  where id = p_letter_id;

  insert into public.notification_outbox (user_id, letter_id, type)
  values (v_letter.recipient_id, p_letter_id, 'letter_delivered')
  on conflict (letter_id, type) do nothing;

  return 'delivered';
end;
$$;

revoke all on function public.deliver_letter_internal(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- deliver_due_letters(batch): what the (later) pg_cron job runs
-- ---------------------------------------------------------------------------------------------

-- Delivers up to p_batch due letters (status 'scheduled', scheduled_at <= now()), oldest first,
-- and returns how many it transitioned (delivered + undeliverable). FOR UPDATE SKIP LOCKED: two
-- overlapping runs split the due rows between them instead of both processing the same letter,
-- and a row locked by anyone else (send_letter, unschedule_letter) is left for the next run.
--
-- Each letter is delivered in its own subtransaction: an unexpected error on one letter is
-- reported as a WARNING (letter id and error message only - never content) and that letter stays
-- 'scheduled' for the next run, instead of aborting the whole batch and blocking every letter
-- queued behind it.
--
-- Error codes: invalid_input (p_batch null or < 1). Internal only.
create function public.deliver_due_letters(p_batch int default 500)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  if p_batch is null or p_batch < 1 then
    raise exception 'invalid_input';
  end if;

  for v_id in
    select id
    from public.letters
    where status = 'scheduled' and scheduled_at <= now()
    order by scheduled_at, id
    limit p_batch
    for update skip locked
  loop
    begin
      if public.deliver_letter_internal(v_id) is not null then
        v_count := v_count + 1;
      end if;
    exception when others then
      raise warning 'deliver_due_letters: letter % failed: %', v_id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.deliver_due_letters(int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- send_letter(): send-now delivers in the same transaction (DEC-044 (1))
-- ---------------------------------------------------------------------------------------------

-- Identical to 20260925150000_letters_sending.sql's version (same checks, codes, idempotency and
-- rate limits), except the last step: with no p_scheduled_at the letter is scheduled for now()
-- and then immediately passed to deliver_letter_internal() - the same transition cron uses - so
-- send-now returns 'delivered'. A scheduled send is unchanged and returns 'scheduled'.
create or replace function public.send_letter(p_letter_id uuid, p_scheduled_at timestamptz default null)
returns public.letter_send_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_letter public.letters;
  v_at timestamptz;
  v_result public.letter_send_state;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_letter_id is null then
    raise exception 'invalid_input';
  end if;

  select * into v_letter
  from public.letters
  where id = p_letter_id and sender_id = v_uid
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_letter.status <> 'draft' then
    v_result.status := v_letter.status;
    v_result.scheduled_at := v_letter.scheduled_at;
    v_result.delivered_at := v_letter.delivered_at;
    return v_result;
  end if;

  if v_letter.recipient_id is null then
    raise exception 'recipient_required';
  end if;
  if regexp_replace(v_letter.body, '\s', '', 'g') = '' then
    raise exception 'body_empty';
  end if;

  if p_scheduled_at is null then
    v_at := now();
  elsif p_scheduled_at <= now() then
    raise exception 'schedule_in_past';
  elsif p_scheduled_at > now() + interval '5 years' then
    raise exception 'schedule_too_far';
  else
    v_at := p_scheduled_at;
  end if;

  if not public.check_rate_limit('send_letter_hour', 30, interval '1 hour')
     or not public.check_rate_limit('send_letter_day', 200, interval '1 day') then
    raise exception 'rate_limited';
  end if;

  if not exists (
       select 1 from public.profiles
       where id = v_uid and onboarded_at is not null and deleted_at is null)
     or not exists (
       select 1 from public.profiles
       where id = v_letter.recipient_id and onboarded_at is not null and deleted_at is null)
     or not public.can_send(v_uid, v_letter.recipient_id, v_letter.parent_letter_id) then
    raise exception 'cannot_send';
  end if;

  update public.letters
  set status = 'scheduled', scheduled_at = v_at
  where id = p_letter_id;

  if p_scheduled_at is null then
    perform public.deliver_letter_internal(p_letter_id);
  end if;

  select status, scheduled_at, delivered_at
  into v_result.status, v_result.scheduled_at, v_result.delivered_at
  from public.letters
  where id = p_letter_id;
  return v_result;
end;
$$;

revoke all on function public.send_letter(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.send_letter(uuid, timestamptz) to authenticated;
