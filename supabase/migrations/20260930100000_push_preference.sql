-- Notification preference (PLAN Phase 9 "notification preferences", DEC-052). Forward-only.
-- One switch: push me when a letter is delivered to me (default on). It only silences the push;
-- delivery, the inbox and Realtime are unchanged (push is a hint, the inbox is the source of truth).
-- The version sorts after 20260930090000 (already applied), so it is dated 2026-09-30 too.

alter table public.profiles
  add column push_on_delivery boolean not null default true;

-- Clients may change their own preference (rows limited by profiles_update_own).
grant update (push_on_delivery) on public.profiles to authenticated;

-- claim_notifications(): unchanged except that a recipient who turned push off is returned with
-- no tokens, so the sender closes the row the same way as "no device" (nothing sent, no retry).
create or replace function public.claim_notifications(p_limit int default 100, p_lease interval default interval '2 minutes')
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
    case when r.push_on_delivery then
      coalesce((select array_agg(d.push_token order by d.last_seen_at desc)
                from public.devices d where d.user_id = leased.user_id), array[]::text[])
    else array[]::text[] end
  from leased
  join public.profiles r on r.id = leased.user_id
  join public.letters l on l.id = leased.letter_id
  left join public.profiles s on s.id = l.sender_id;
end;
$$;

-- create or replace keeps the existing grants; restate the intent (service_role only).
revoke all on function public.claim_notifications(int, interval) from public, anon, authenticated;
grant execute on function public.claim_notifications(int, interval) to service_role;
