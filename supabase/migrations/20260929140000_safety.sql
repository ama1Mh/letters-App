-- Phase 9: safety, privacy, settings (PLAN §6.2/§6.5, DEC-013, DEC-023, DEC-045 (6)). Forward-only.
--   1. delete-for-me is private: sender_deleted_at / recipient_deleted_at are no longer selectable
--      by clients (the other side could see when you deleted their letter).
--   2. delete_letter_for_me(id): one-way, own side only (DEC-023: no delete-for-both).
--   3. reports + report_user(): insert through the RPC only; nobody but the dashboard reads them.
--   4. delete_my_account(): the database half of account deletion (the auth user is removed by the
--      delete-account Edge Function, which calls this first).

-- ---------------------------------------------------------------------------------------------
-- 1. Delete-for-me is not visible to the other person
-- ---------------------------------------------------------------------------------------------
-- RLS policies still use these columns (letters_select_recipient hides a letter the recipient
-- deleted); column privileges only limit what a client can select, not what a policy reads.
revoke select (sender_deleted_at, recipient_deleted_at) on public.letters from authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. delete_letter_for_me(id)
-- ---------------------------------------------------------------------------------------------
-- The caller hides a letter from their own lists; the other person keeps theirs. Allowed for:
--   the recipient of a delivered letter; the sender of a delivered or undeliverable letter (a letter
--   to yourself: both sides at once). Drafts are deleted normally (RLS delete); scheduled letters
--   are unscheduled first. letters_prevent_delivered_update allows exactly this one-way change and
--   letters_broadcast_changes tells only the deleter (letter_deleted_for_me). Idempotent: deleting
--   again is not_found (it is no longer visible), like any letter the caller cannot see.
-- Error codes: not_authenticated, invalid_input, not_found.
create function public.delete_letter_for_me(p_letter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_letter public.letters;
  v_as_sender boolean;
  v_as_recipient boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_letter_id is null then
    raise exception 'invalid_input';
  end if;

  select * into v_letter from public.letters where id = p_letter_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  v_as_sender := v_letter.sender_id = v_uid
    and v_letter.status in ('delivered', 'undeliverable')
    and v_letter.sender_deleted_at is null;
  v_as_recipient := v_letter.recipient_id = v_uid
    and v_letter.status = 'delivered'
    and v_letter.recipient_deleted_at is null;
  if not (v_as_sender or v_as_recipient) then
    raise exception 'not_found';
  end if;

  update public.letters
  set sender_deleted_at = case when v_as_sender then now() else sender_deleted_at end,
      recipient_deleted_at = case when v_as_recipient then now() else recipient_deleted_at end
  where id = p_letter_id;
end;
$$;

revoke all on function public.delete_letter_for_me(uuid) from public, anon, authenticated;
grant execute on function public.delete_letter_for_me(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Reports (DEC-013: reviewed in the Supabase dashboard in MVP)
-- ---------------------------------------------------------------------------------------------
create type public.report_reason as enum ('spam', 'harassment', 'inappropriate', 'impersonation', 'other');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id),
  reported_id uuid not null references public.profiles (id),
  -- Optional: the letter that prompted the report (must involve both people; checked in the RPC).
  letter_id uuid references public.letters (id),
  reason public.report_reason not null,
  details text,
  created_at timestamptz not null default now(),
  constraint reports_not_self check (reporter_id <> reported_id),
  constraint reports_details_length check (details is null or char_length(details) <= 500)
);

-- Default deny: RLS on, no policies, no grants. Only the dashboard (service role) reads reports.
alter table public.reports enable row level security;
revoke all on public.reports from public, anon, authenticated;

-- report_user(reported, reason, letter, details): the only way in. The reported person is never
-- told (DEC-013). If a letter is given it must be one the caller can see that involves the reported
-- person; otherwise the same not_found as for an unknown user. Rate-limited (20 a day).
-- Error codes: not_authenticated, invalid_input, not_found, rate_limited.
create function public.report_user(
  p_reported_id uuid,
  p_reason public.report_reason,
  p_letter_id uuid default null,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_reported_id is null or p_reason is null or p_reported_id = v_uid
     or (v_details is not null and char_length(v_details) > 500) then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from public.profiles where id = p_reported_id) then
    raise exception 'not_found';
  end if;
  if p_letter_id is not null and not exists (
    select 1 from public.letters l
    where l.id = p_letter_id
      and (
        (l.sender_id = v_uid and l.recipient_id = p_reported_id and l.status <> 'draft')
        or (l.recipient_id = v_uid and l.sender_id = p_reported_id and l.status = 'delivered')
      )
  ) then
    raise exception 'not_found';
  end if;
  if not public.check_rate_limit('report_user', 20, interval '1 day') then
    raise exception 'rate_limited';
  end if;

  insert into public.reports (reporter_id, reported_id, letter_id, reason, details)
  values (v_uid, p_reported_id, p_letter_id, p_reason, v_details);
end;
$$;

revoke all on function public.report_user(uuid, public.report_reason, uuid, text) from public, anon, authenticated;
grant execute on function public.report_user(uuid, public.report_reason, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. delete_my_account(): the database half (PLAN §6.5)
-- ---------------------------------------------------------------------------------------------
-- Removes what only the account owner had (drafts, never-delivered scheduled letters, invites,
-- connections and requests, blocks either way, pending notifications, rate-limit rows) and
-- anonymizes the profile. Delivered and undeliverable letters stay for the other person, who sees
-- a deleted account (every read function already nulls a deleted profile's fields). The username
-- stays taken (not freed), so nobody can later pick it to impersonate the old owner on those
-- letters; it is hidden from search because discoverability is switched off. Idempotent.
-- The delete-account Edge Function calls this as the user, then removes the auth user with the
-- admin API (it cannot run here: auth.users is GoTrue's).
-- Error codes: not_authenticated.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.notification_outbox where user_id = v_uid;
  delete from public.notification_outbox
    where letter_id in (select id from public.letters where sender_id = v_uid and status in ('draft', 'scheduled'));
  delete from public.letters where sender_id = v_uid and status in ('draft', 'scheduled');
  delete from public.connections where requester_id = v_uid or addressee_id = v_uid;
  delete from public.invites where owner_id = v_uid;
  delete from public.blocks where blocker_id = v_uid or blocked_id = v_uid;
  delete from public.api_rate_limits where user_id = v_uid;

  update public.profiles
  set deleted_at = coalesce(deleted_at, now()),
      -- The free-text display name (often a real name) is replaced by the username, which is
      -- kept anyway; profiles_onboarded_complete requires a display name once onboarded.
      display_name = coalesce(username, display_name),
      avatar_key = null,
      discoverable_by_username = false,
      discoverable_by_email = false,
      receive_mode = 'invite_only',
      read_receipts_enabled = false
  where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
