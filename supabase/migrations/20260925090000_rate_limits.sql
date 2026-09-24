-- Phase 5: generic rate limiting (PLAN §4.1's api_rate_limits table). Numbers passed to
-- check_rate_limit() by each caller are provisional (OPEN-5) - literal values with a comment, not
-- named SQL constants (Postgres has no first-class constant mechanism cheap enough to justify
-- here); revisit together with the OPEN-5 TypeScript-side constants when finalized.

create table public.api_rate_limits (
  user_id uuid not null references public.profiles (id),
  action text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (user_id, action, window_start)
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public, anon, authenticated;
-- No policies, no grants: server-only (PLAN §4.1). All access is through check_rate_limit(),
-- always called from inside another SECURITY DEFINER RPC, never directly by a client.

-- Fixed-window limiter: floors `now()` to a p_window-sized bucket, atomically increments that
-- bucket's counter, and reports whether this call was still under p_limit. `on conflict ... do
-- update` makes the increment race-safe under concurrent calls in the same window.
create function public.check_rate_limit(p_action text, p_limit int, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_window_start timestamptz;
  v_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window)
  );

  insert into public.api_rate_limits (user_id, action, window_start, count)
  values (v_uid, p_action, v_window_start, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.api_rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Not granted to anyone, including authenticated: only ever called from inside another SECURITY
-- DEFINER RPC's own body (which runs as that function's owner, not the original caller - the same
-- reasoning that keeps is_reserved_word() in profiles.sql revoked). Never called directly from a
-- client or from a plain CHECK constraint.
revoke all on function public.check_rate_limit(text, int, interval) from public, anon, authenticated;
