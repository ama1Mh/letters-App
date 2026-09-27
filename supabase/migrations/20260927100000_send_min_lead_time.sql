-- Phase 6 M0: a scheduled send must be at least 1 minute ahead (owner decision 2026-09-27, DEC-046),
-- so the server and the app's schedule picker enforce the same rule. Forward-only.
--
-- send_letter() is identical to 20260925160000_delivery.sql's version except for one added check:
-- a time after now() but less than 1 minute ahead raises the new code `schedule_too_soon`.
-- `schedule_in_past` (at or before now()) and `schedule_too_far` (more than 5 years) are
-- unchanged; send-now (p_scheduled_at null) is unaffected. Exactly now() + 1 minute is allowed.
-- The app's schedule picker (Phase 6 mobile) must use the same 1-minute value.
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
  elsif p_scheduled_at < now() + interval '1 minute' then
    raise exception 'schedule_too_soon';
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
