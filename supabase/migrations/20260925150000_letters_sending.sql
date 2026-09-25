-- Phase 6 step 1: sending and unscheduling a letter, marking it read, and read-receipt masking
-- (PLAN §3.3/§4.3/§6.2, DEC-005/007/020/025). Forward-only: the Phase 3 letters migration and the
-- Phase 5 can_send() are already applied to the linked project, so both are redefined here with
-- CREATE OR REPLACE rather than edited in place.
--
-- Letter lifecycle after this migration (enforced by letters_check_status_transition below):
--   draft --send_letter--> scheduled --unschedule_letter--> draft
--   scheduled --delivery--> delivered | undeliverable        (both terminal)
-- Delivery itself (deliver_letter_internal / deliver_due_letters / pg_cron / notification_outbox)
-- is the next migration. Until then send_letter() with no time schedules the letter for now();
-- the delivery migration redefines send_letter() so that send-now delivers in the same
-- transaction through the same delivery function cron uses (owner decision, 2026-09-25).

-- ---------------------------------------------------------------------------------------------
-- 1. Delivered/undeliverable immutability, narrowed
-- ---------------------------------------------------------------------------------------------

-- Replaces the Phase 3 version, which rejected *every* update to a delivered row and so made
-- mark_read() impossible. Terminal letters (delivered, undeliverable) keep every content and state
-- column frozen; the only permitted changes are one-way null -> timestamp transitions:
--   read_at               (delivered only - nobody can read an undeliverable letter)
--   sender_deleted_at     (delete-for-me, Phase 9)
--   recipient_deleted_at  (delete-for-me, Phase 9)
-- updated_at is excluded from the comparison: letters_set_updated_at maintains it.
-- Still keyed on OLD.status rather than the caller's role, so it binds SECURITY DEFINER code too.
create or replace function public.letters_prevent_delivered_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status not in ('delivered', 'undeliverable') then
    return new;
  end if;

  if (new.id, new.sender_id, new.recipient_id, new.thread_id, new.parent_letter_id, new.subject,
      new.body, new.body_dir, new.design, new.status, new.scheduled_at, new.delivered_at,
      new.created_at)
     is distinct from
     (old.id, old.sender_id, old.recipient_id, old.thread_id, old.parent_letter_id, old.subject,
      old.body, old.body_dir, old.design, old.status, old.scheduled_at, old.delivered_at,
      old.created_at) then
    raise exception 'delivered_immutable';
  end if;

  if new.read_at is distinct from old.read_at
     and (old.read_at is not null or new.read_at is null or old.status <> 'delivered') then
    raise exception 'delivered_immutable';
  end if;

  if new.sender_deleted_at is distinct from old.sender_deleted_at
     and (old.sender_deleted_at is not null or new.sender_deleted_at is null) then
    raise exception 'delivered_immutable';
  end if;

  if new.recipient_deleted_at is distinct from old.recipient_deleted_at
     and (old.recipient_deleted_at is not null or new.recipient_deleted_at is null) then
    raise exception 'delivered_immutable';
  end if;

  return new;
end;
$$;

-- CREATE OR REPLACE keeps the existing trigger binding and privileges; restated for clarity.
revoke all on function public.letters_prevent_delivered_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Status transitions (defense in depth: only these edges exist, whoever performs the update)
-- ---------------------------------------------------------------------------------------------

create function public.letters_check_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not (
       (old.status = 'draft' and new.status = 'scheduled')
    or (old.status = 'scheduled' and new.status in ('draft', 'delivered', 'undeliverable'))
  ) then
    raise exception 'invalid_status_transition';
  end if;

  if new.status = 'delivered' and new.delivered_at is null then
    raise exception 'invalid_status_transition';
  end if;

  return new;
end;
$$;

revoke all on function public.letters_check_status_transition() from public, anon, authenticated;

create trigger letters_check_status_transition
  before update on public.letters
  for each row execute function public.letters_check_status_transition();

-- ---------------------------------------------------------------------------------------------
-- 3. can_send(): deleted accounts (PLAN §3.3 "account deleted?")
-- ---------------------------------------------------------------------------------------------

-- Same rule list as Phase 5 (DEC-007), plus: a missing or deleted sender or recipient can never
-- send or receive, checked first. Runs at send time (send_letter below) and again at delivery.
create or replace function public.can_send(p_sender uuid, p_recipient uuid, p_parent_letter_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_receive_mode public.receive_mode;
begin
  if not exists (select 1 from public.profiles where id = p_sender and deleted_at is null)
     or not exists (select 1 from public.profiles where id = p_recipient and deleted_at is null) then
    return false;
  end if;

  if public.is_blocked(p_sender, p_recipient) then
    return false;
  end if;

  if p_sender = p_recipient then
    return true;
  end if;

  if p_parent_letter_id is not null and exists (
    select 1 from public.letters
    where id = p_parent_letter_id
      and status = 'delivered'
      and recipient_id = p_sender
      and sender_id = p_recipient
  ) then
    return true;
  end if;

  select receive_mode into v_receive_mode from public.profiles where id = p_recipient;
  if v_receive_mode = 'everyone' then
    return true;
  end if;

  return exists (
    select 1 from public.connections
    where status = 'accepted'
      and ((requester_id = p_sender and addressee_id = p_recipient)
        or (requester_id = p_recipient and addressee_id = p_sender))
  );
end;
$$;

revoke all on function public.can_send(uuid, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Read-receipt masking (DEC-025, reciprocal - owner decision 2026-09-25)
-- ---------------------------------------------------------------------------------------------

-- The sender's SELECT policy would otherwise expose read_at regardless of either person's
-- read-receipt setting. Column privileges cannot vary per row, so read_at is not selectable by
-- clients at all; the recipient's own read state and the sender's (masked) receipt are only
-- available through SECURITY DEFINER functions (get_letter_read_at() here, the inbox/sent list
-- functions in a later Phase 6 migration). Every other column stays selectable, rows still limited
-- by the existing RLS policies.
revoke select on public.letters from authenticated;
grant select (
  id, sender_id, recipient_id, thread_id, parent_letter_id, subject, body, body_dir, design,
  status, scheduled_at, delivered_at, sender_deleted_at, recipient_deleted_at, created_at,
  updated_at
) on public.letters to authenticated;

-- What p_viewer may know about a letter's read_at. The recipient always sees their own read state
-- (a letter to yourself included). The sender of a letter to someone else sees it only when BOTH
-- people currently have read receipts enabled (reciprocal). Anyone else: null. Internal only.
create function public.masked_read_at(
  p_viewer uuid, p_sender uuid, p_recipient uuid, p_status public.letter_status, p_read_at timestamptz
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_viewer is null or p_status <> 'delivered' then null
    when p_viewer = p_recipient then p_read_at
    when p_viewer = p_sender and (
      select bool_and(read_receipts_enabled)
      from public.profiles
      where id in (p_sender, p_recipient)
    ) then p_read_at
    else null
  end;
$$;

revoke all on function public.masked_read_at(uuid, uuid, uuid, public.letter_status, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. RPCs: send_letter, unschedule_letter, mark_read, get_letter_read_at
-- ---------------------------------------------------------------------------------------------

-- What send_letter()/unschedule_letter() return: the letter's resulting state.
create type public.letter_send_state as (
  status public.letter_status,
  scheduled_at timestamptz,
  delivered_at timestamptz
);

-- send_letter(id, scheduled_at): p_scheduled_at null = send now; otherwise a future UTC time,
-- at most 5 years ahead (PLAN §3.3).
--
-- Idempotent on the letter id: a letter that is no longer a draft (a retry after a lost response,
-- or already sent from another device) returns its current state without error and without
-- consuming the rate limit. The client treats that as success and shows the returned state.
--
-- Error codes (raised as the exception message, DEC-038 convention):
--   not_authenticated, invalid_input, not_found (no such letter, or not the caller's),
--   recipient_required, body_empty, schedule_in_past, schedule_too_far, rate_limited,
--   cannot_send - one neutral code for every permission failure (recipient blocked either way,
--   invite-only without an accepted connection, deleted or not-yet-onboarded account), so a
--   block is never revealed (DEC-013, PLAN §6.4).
--
-- Rate limits are provisional (OPEN-5): 30 sends/hour and 200 sends/day. Separate action names
-- per window because api_rate_limits is keyed on (user, action, window_start), and an hour bucket
-- and a day bucket can share the same window_start. As with request_connection(), a call that
-- fails later in this function rolls back its own counter increment; only sends that succeed are
-- counted.
create function public.send_letter(p_letter_id uuid, p_scheduled_at timestamptz default null)
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

  v_result.status := 'scheduled';
  v_result.scheduled_at := v_at;
  v_result.delivered_at := null;
  return v_result;
end;
$$;

-- unschedule_letter(id): scheduled -> draft, so it can be edited and sent again (owner decision:
-- no in-place editing of a scheduled letter). Takes the row lock, so it serializes with delivery;
-- whichever commits second sees the other's status.
-- Idempotent: a letter that is already a draft returns its state without error.
-- Error codes: not_authenticated, invalid_input, not_found, already_delivered, not_scheduled
-- (undeliverable - terminal).
create function public.unschedule_letter(p_letter_id uuid)
returns public.letter_send_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_letter public.letters;
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

  if v_letter.status = 'delivered' then
    raise exception 'already_delivered';
  elsif v_letter.status = 'undeliverable' then
    raise exception 'not_scheduled';
  elsif v_letter.status = 'scheduled' then
    update public.letters
    set status = 'draft', scheduled_at = null
    where id = p_letter_id;
  end if;

  v_result.status := 'draft';
  v_result.scheduled_at := null;
  v_result.delivered_at := null;
  return v_result;
end;
$$;

-- mark_read(id): the recipient marks a delivered letter read. Idempotent: the first read time is
-- kept. Returns the letter's read_at. Error codes: not_authenticated, invalid_input, not_found
-- (not the recipient, not delivered, or deleted-for-me - the same rows the recipient's SELECT
-- policy hides).
create function public.mark_read(p_letter_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_read_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_letter_id is null then
    raise exception 'invalid_input';
  end if;

  select read_at into v_read_at
  from public.letters
  where id = p_letter_id
    and recipient_id = v_uid
    and status = 'delivered'
    and recipient_deleted_at is null
  for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_read_at is null then
    update public.letters set read_at = now() where id = p_letter_id
    returning read_at into v_read_at;
  end if;

  return v_read_at;
end;
$$;

-- get_letter_read_at(id): read_at as the caller may see it (masked_read_at above). Null means
-- unread, or not visible to the caller. Error codes: not_authenticated, invalid_input, not_found
-- (a letter the caller could not SELECT either).
create function public.get_letter_read_at(p_letter_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_letter public.letters;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_letter_id is null then
    raise exception 'invalid_input';
  end if;

  select * into v_letter
  from public.letters
  where id = p_letter_id
    and (sender_id = v_uid
      or (recipient_id = v_uid and status = 'delivered' and recipient_deleted_at is null));
  if not found then
    raise exception 'not_found';
  end if;

  return public.masked_read_at(
    v_uid, v_letter.sender_id, v_letter.recipient_id, v_letter.status, v_letter.read_at
  );
end;
$$;

revoke all on function public.send_letter(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.unschedule_letter(uuid) from public, anon, authenticated;
revoke all on function public.mark_read(uuid) from public, anon, authenticated;
revoke all on function public.get_letter_read_at(uuid) from public, anon, authenticated;
grant execute on function public.send_letter(uuid, timestamptz) to authenticated;
grant execute on function public.unschedule_letter(uuid) to authenticated;
grant execute on function public.mark_read(uuid) to authenticated;
grant execute on function public.get_letter_read_at(uuid) to authenticated;
