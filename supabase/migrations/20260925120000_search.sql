-- Phase 5: username/email discovery (PLAN §3.6, DEC-008/009). Both RPCs, not direct table access:
-- clients never read auth.users, and profiles' own RLS already restricts SELECT to the caller's own
-- row (Phase 2), so search results can only ever come from a SECURITY DEFINER RPC.

create extension if not exists pg_trgm with schema extensions;
create index profiles_username_trgm_idx on public.profiles using gin (username extensions.gin_trgm_ops);

-- search_users(q): prefix match, q >= 3 chars, <= 20 rows, only discoverable_by_username = true,
-- excludes self and anyone who blocked the caller (or whom the caller blocked - is_blocked() is
-- symmetric). Returns the caller's connection_state per DEC-008: none | pending_out | pending_in |
-- connected, so the client can decide "Write letter" vs "Send connection request" vs "Requested"
-- vs "Respond to request" without a second round trip.
create function public.search_users(p_query text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_key text,
  receive_mode public.receive_mode,
  connection_state text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_query text := lower(btrim(p_query));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_query) < 3 then
    raise exception 'query_too_short';
  end if;
  if not public.check_rate_limit('search_users', 30, interval '1 hour') then
    raise exception 'rate_limited';
  end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_key,
    p.receive_mode,
    case
      when c.status = 'accepted' then 'connected'
      when c.status = 'pending' and c.requester_id = v_uid then 'pending_out'
      when c.status = 'pending' and c.addressee_id = v_uid then 'pending_in'
      else 'none'
    end as connection_state
  from public.profiles p
  left join public.connections c
    on least(c.requester_id, c.addressee_id) = least(v_uid, p.id)
   and greatest(c.requester_id, c.addressee_id) = greatest(v_uid, p.id)
   and c.status in ('accepted', 'pending')
  where p.id <> v_uid
    and p.username is not null
    and p.username like v_query || '%'
    and p.discoverable_by_username = true
    and not public.is_blocked(v_uid, p.id)
  order by p.username
  limit 20;
end;
$$;

revoke all on function public.search_users(text) from public, anon, authenticated;
grant execute on function public.search_users(text) to authenticated;

-- find_user_by_email(email): SECURITY DEFINER, exact case-insensitive match on a VERIFIED
-- auth.users.email, only if discoverable_by_email = true. Identical (empty) response for "no
-- account", "account exists but not discoverable" and "email not verified" - nothing about
-- existence leaks either way (DEC-009). Returns the same row shape as search_users (minus
-- connection_state, computed separately below to keep this query simple) so the client can reuse
-- one result-row type; the email address itself is never returned.
create function public.find_user_by_email(p_email text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_key text,
  receive_mode public.receive_mode,
  connection_state text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v_found record;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_email = '' or v_email is null then
    raise exception 'invalid_input';
  end if;
  if not public.check_rate_limit('find_user_by_email', 10, interval '1 hour') then
    raise exception 'rate_limited';
  end if;

  select p.id, p.username, p.display_name, p.avatar_key, p.receive_mode
  into v_found
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = v_email
    and u.email_confirmed_at is not null
    and p.discoverable_by_email = true
    and p.id <> v_uid
    and not public.is_blocked(v_uid, p.id);

  if not found then
    return; -- empty result set: identical for "no account" and "not discoverable" (DEC-009)
  end if;

  return query
  select
    v_found.id, v_found.username, v_found.display_name, v_found.avatar_key, v_found.receive_mode,
    case
      when c.status = 'accepted' then 'connected'
      when c.status = 'pending' and c.requester_id = v_uid then 'pending_out'
      when c.status = 'pending' and c.addressee_id = v_uid then 'pending_in'
      else 'none'
    end
  from (select 1) as one_row
  left join public.connections c
    on least(c.requester_id, c.addressee_id) = least(v_uid, v_found.id)
   and greatest(c.requester_id, c.addressee_id) = greatest(v_uid, v_found.id)
   and c.status in ('accepted', 'pending');
end;
$$;

revoke all on function public.find_user_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_by_email(text) to authenticated;
