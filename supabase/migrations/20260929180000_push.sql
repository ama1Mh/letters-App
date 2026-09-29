-- Phase 7 (server side): device tokens and the notification sender's database API (PLAN §4.1
-- `devices`, §6.5 push without letter content, DEC-004 Expo Push Service). Forward-only.
--
-- The outbox (20260925160000_delivery.sql) already holds one content-free row per delivered
-- letter. This adds where to send it (devices) and the functions the `send-notifications` Edge
-- Function uses to drain it safely:
--   claim_notifications()   - leases due rows (so concurrent runs never send one twice) and returns
--                             what the push text needs: the recipient's locale and tokens, and the
--                             sender's public name (never subject or body);
--   complete_notification() - records the outcome: sent, or retry later with backoff, or failed;
--   forget_device_token()   - drops a token the push provider reports as no longer registered.
-- Those three are for service_role only. Clients register/unregister their own device through
-- register_device() / unregister_device(). delete_my_account() now also removes devices.
-- Not here (needs the owner): FCM credentials in EAS, the app-side expo-notifications code, and the
-- pg_cron schedule that invokes the Edge Function with a stored service key.

-- ---------------------------------------------------------------------------------------------
-- devices
-- ---------------------------------------------------------------------------------------------
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  -- Expo push token, e.g. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]. One owner at a time.
  push_token text not null unique,
  platform text not null,
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint devices_push_token_format check (push_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$'),
  constraint devices_platform check (platform in ('android', 'ios')),
  constraint devices_app_version_length check (app_version is null or char_length(app_version) <= 32)
);

create index devices_user_idx on public.devices (user_id);

alter table public.devices enable row level security;
revoke all on public.devices from public, anon, authenticated;
-- Owners may see their own devices (e.g. a future "signed-in devices" screen); writes only via RPC.
grant select (id, platform, app_version, last_seen_at, created_at) on public.devices to authenticated;
create policy devices_select_own on public.devices
  for select to authenticated
  using (user_id = (select auth.uid()));

-- register_device(token, platform, app_version): the signed-in user claims this device's token.
-- A token that belonged to someone else moves to the caller (the device changed hands: the push
-- must follow whoever is signed in now). Rate-limited (30 a day). Error codes: not_authenticated,
-- invalid_input, rate_limited.
create function public.register_device(p_push_token text, p_platform text, p_app_version text default null)
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
  if p_push_token is null or p_push_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$'
     or p_platform is null or p_platform not in ('android', 'ios')
     or (p_app_version is not null and char_length(p_app_version) > 32) then
    raise exception 'invalid_input';
  end if;
  if not public.check_rate_limit('register_device', 30, interval '1 day') then
    raise exception 'rate_limited';
  end if;

  insert into public.devices (user_id, push_token, platform, app_version)
  values (v_uid, p_push_token, p_platform, p_app_version)
  on conflict (push_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        app_version = excluded.app_version,
        last_seen_at = now();
end;
$$;

-- unregister_device(token): on sign-out. Only the caller's own token; silent otherwise (no hint
-- whether someone else holds it). Error codes: not_authenticated.
create function public.unregister_device(p_push_token text)
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
  delete from public.devices where push_token = p_push_token and user_id = v_uid;
end;
$$;

revoke all on function public.register_device(text, text, text) from public, anon, authenticated;
revoke all on function public.unregister_device(text) from public, anon, authenticated;
grant execute on function public.register_device(text, text, text) to authenticated;
grant execute on function public.unregister_device(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The sender's API (service_role only)
-- ---------------------------------------------------------------------------------------------
-- claim_notifications(limit, lease): leases up to p_limit due pending rows (FOR UPDATE SKIP LOCKED,
-- so two concurrent runs split the work instead of both taking the same rows) and returns, per
-- row, only what a localized "new letter from {name}" push needs. A row whose recipient has no
-- device is still returned (with no tokens) so the sender can close it. Rows stay 'pending' while
-- leased; a crashed run's lease simply expires and the row is claimed again.
create function public.claim_notifications(p_limit int default 100, p_lease interval default interval '2 minutes')
returns table (
  outbox_id uuid,
  letter_id uuid,
  type public.notification_type,
  attempts int,
  recipient_locale public.app_locale,
  sender_username text,
  sender_display_name text,
  push_tokens text[]
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select o.id
    from public.notification_outbox o
    where o.status = 'pending'
      and o.next_attempt_at <= now()
      and (o.locked_until is null or o.locked_until < now())
    order by o.next_attempt_at, o.id
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update skip locked
  ), leased as (
    update public.notification_outbox o
    set locked_until = now() + coalesce(p_lease, interval '2 minutes')
    from due
    where o.id = due.id
    returning o.id, o.letter_id, o.user_id, o.type, o.attempts
  )
  select
    leased.id,
    leased.letter_id,
    leased.type,
    leased.attempts,
    r.locale,
    case when s.deleted_at is null then s.username end,
    case when s.deleted_at is null then s.display_name end,
    coalesce((select array_agg(d.push_token order by d.last_seen_at desc)
              from public.devices d where d.user_id = leased.user_id), array[]::text[])
  from leased
  join public.profiles r on r.id = leased.user_id
  join public.letters l on l.id = leased.letter_id
  left join public.profiles s on s.id = l.sender_id;
end;
$$;

-- complete_notification(id, ok, ticket, error): 'sent' when the provider accepted it; otherwise one
-- more attempt with exponential backoff (1, 2, 4 ... minutes, capped at 1 hour), and 'failed' after
-- the 8th attempt. `p_error` is the provider's error code/message only (never letter content).
create function public.complete_notification(
  p_outbox_id uuid,
  p_ok boolean,
  p_ticket_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_ok then
    update public.notification_outbox
    set status = 'sent', sent_at = now(), expo_ticket_id = p_ticket_id, locked_until = null,
        attempts = attempts + 1, error = null
    where id = p_outbox_id and status = 'pending';
  else
    update public.notification_outbox
    set attempts = attempts + 1,
        status = case when attempts + 1 >= 8 then 'failed'::public.notification_status else status end,
        next_attempt_at = now() + least(interval '1 minute' * power(2, attempts), interval '1 hour'),
        locked_until = null,
        error = left(p_error, 500)
    where id = p_outbox_id and status = 'pending';
  end if;
end;
$$;

-- forget_device_token(token): the provider said this token is no longer registered.
create function public.forget_device_token(p_push_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.devices where push_token = p_push_token;
$$;

revoke all on function public.claim_notifications(int, interval) from public, anon, authenticated;
revoke all on function public.complete_notification(uuid, boolean, text, text) from public, anon, authenticated;
revoke all on function public.forget_device_token(text) from public, anon, authenticated;
grant execute on function public.claim_notifications(int, interval) to service_role;
grant execute on function public.complete_notification(uuid, boolean, text, text) to service_role;
grant execute on function public.forget_device_token(text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- delete_my_account(): also remove the account's devices (redefined; otherwise identical to
-- 20260929140000_safety.sql)
-- ---------------------------------------------------------------------------------------------
create or replace function public.delete_my_account()
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

  delete from public.devices where user_id = v_uid;
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
