-- Phase 5: blocks, connections, and can_send() (PLAN §3.6/§4.1, DEC-006/007/013).
--
-- Blocking (DEC-013): works regardless of receive_mode and connection state, mutual in effect,
-- deletes any connection/pending request between the two users, and the blocked person is never
-- told. Only the RPCs land in this phase - the "Blocked users" management screen is Phase 9
-- ("Safety, privacy, settings"), not built here.
--
-- Connections (DEC-007): a mutual pen-pal link, or a pending request toward one. All writes are
-- RPC-only; a client never writes `connections` directly (CLAUDE.md).
--
-- can_send() implements DEC-007's rule list exactly; nothing calls it yet (send_letter is Phase 6),
-- but PLAN assigns it to this phase's migration, and its invite_only branch is exactly what this
-- phase's exit criterion ("invite-only flow works end to end") needs proven correct now.

-- ---------------------------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id),
  blocked_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;
revoke all on public.blocks from public, anon, authenticated;
-- The blocker may read their own blocks (Phase 9's future "blocked users" screen); the blocked
-- person is never told (DEC-013), so there is no policy letting them see rows where they are
-- blocked_id.
grant select on public.blocks to authenticated;

create policy blocks_select_own on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

-- Mutual in effect (DEC-013): true if either direction blocks. Internal only (see the file header
-- for the is_reserved_word()-style reasoning behind every revoke-all in this file).
create function public.is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

revoke all on function public.is_blocked(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- connections
-- ---------------------------------------------------------------------------------------------

create type public.connection_status as enum ('pending', 'accepted', 'declined');
create type public.connection_via as enum ('invite', 'request');

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id),
  addressee_id uuid not null references public.profiles (id),
  status public.connection_status not null default 'pending',
  via public.connection_via not null,
  -- FK added by the invites migration once that table exists (avoids a forward reference here).
  invite_id uuid,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint connections_not_self check (requester_id <> addressee_id),
  constraint connections_responded_consistency check (
    (status = 'pending' and responded_at is null)
    or (status in ('accepted', 'declined') and responded_at is not null)
  )
);

-- At most one row (of any status) per unordered pair at a time: request_connection() below
-- deletes a stale declined row itself once the DEC-007 cooldown has passed, rather than this index
-- allowing a second row to coexist with it.
create unique index connections_unordered_pair_idx
  on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index connections_requester_idx on public.connections (requester_id, status);
create index connections_addressee_idx on public.connections (addressee_id, status);

alter table public.connections enable row level security;
revoke all on public.connections from public, anon, authenticated;
grant select on public.connections to authenticated;

create policy connections_select_own on public.connections
  for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

-- can_send(sender, recipient, parent_letter_id): PLAN §3.6 / DEC-007's rule list, in order.
-- Internal only - nothing calls it yet; send_letter() (Phase 6) will.
create function public.can_send(p_sender uuid, p_recipient uuid, p_parent_letter_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_receive_mode public.receive_mode;
begin
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
  if v_receive_mode is null then
    return false; -- recipient does not exist
  end if;
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

-- Provisional (OPEN-5): 30-day re-request cooldown after a decline, max 20 outstanding pending
-- requests sent by one user, 20 requests/day. Revisit together with the equivalent
-- mobile/src/domain/ constants when these are no longer provisional.
create function public.request_connection(p_addressee_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.connections;
  v_pending_count int;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_addressee_id is null or p_addressee_id = v_uid then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from public.profiles where id = p_addressee_id) then
    raise exception 'profile_not_found';
  end if;
  -- Neutral code: never confirm a block exists either direction (DEC-013).
  if public.is_blocked(v_uid, p_addressee_id) then
    raise exception 'not_found';
  end if;
  if not public.check_rate_limit('request_connection', 20, interval '1 day') then
    raise exception 'rate_limited';
  end if;

  select * into v_existing
  from public.connections
  where least(requester_id, addressee_id) = least(v_uid, p_addressee_id)
    and greatest(requester_id, addressee_id) = greatest(v_uid, p_addressee_id)
  for update;

  if found then
    if v_existing.status = 'accepted' then
      raise exception 'already_connected';
    elsif v_existing.status = 'pending' then
      raise exception 'already_pending';
    elsif v_existing.status = 'declined' and v_existing.responded_at > now() - interval '30 days' then
      raise exception 'recently_declined';
    end if;
    -- Cooldown has passed: replace the old row rather than trying to reuse it in place.
    delete from public.connections where id = v_existing.id;
  end if;

  select count(*) into v_pending_count
  from public.connections
  where requester_id = v_uid and status = 'pending';
  if v_pending_count >= 20 then
    raise exception 'too_many_pending';
  end if;

  insert into public.connections (requester_id, addressee_id, status, via)
  values (v_uid, p_addressee_id, 'pending', 'request')
  returning id into v_id;

  return v_id;
end;
$$;

create function public.accept_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.connections;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row from public.connections where id = p_connection_id for update;
  if not found or v_row.addressee_id <> v_uid then
    raise exception 'not_found';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'not_pending';
  end if;

  update public.connections set status = 'accepted', responded_at = now() where id = p_connection_id;
end;
$$;

create function public.decline_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.connections;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row from public.connections where id = p_connection_id for update;
  if not found or v_row.addressee_id <> v_uid then
    raise exception 'not_found';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'not_pending';
  end if;

  update public.connections set status = 'declined', responded_at = now() where id = p_connection_id;
end;
$$;

create function public.cancel_connection_request(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.connections;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row from public.connections where id = p_connection_id for update;
  if not found or v_row.requester_id <> v_uid then
    raise exception 'not_found';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'not_pending';
  end if;

  delete from public.connections where id = p_connection_id;
end;
$$;

create function public.remove_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.connections;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row from public.connections where id = p_connection_id for update;
  if not found or (v_row.requester_id <> v_uid and v_row.addressee_id <> v_uid) then
    raise exception 'not_found';
  end if;
  if v_row.status <> 'accepted' then
    raise exception 'not_connected';
  end if;

  delete from public.connections where id = p_connection_id;
end;
$$;

revoke all on function public.request_connection(uuid) from public, anon, authenticated;
revoke all on function public.accept_connection(uuid) from public, anon, authenticated;
revoke all on function public.decline_connection(uuid) from public, anon, authenticated;
revoke all on function public.cancel_connection_request(uuid) from public, anon, authenticated;
revoke all on function public.remove_connection(uuid) from public, anon, authenticated;
grant execute on function public.request_connection(uuid) to authenticated;
grant execute on function public.accept_connection(uuid) to authenticated;
grant execute on function public.decline_connection(uuid) to authenticated;
grant execute on function public.cancel_connection_request(uuid) to authenticated;
grant execute on function public.remove_connection(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- block_user / unblock_user (defined after connections so they can delete from it)
-- ---------------------------------------------------------------------------------------------

create function public.block_user(p_blocked_id uuid)
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
  if p_blocked_id is null or p_blocked_id = v_uid then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from public.profiles where id = p_blocked_id) then
    raise exception 'profile_not_found';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.connections
  where least(requester_id, addressee_id) = least(v_uid, p_blocked_id)
    and greatest(requester_id, addressee_id) = greatest(v_uid, p_blocked_id);
end;
$$;

create function public.unblock_user(p_blocked_id uuid)
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
  delete from public.blocks where blocker_id = v_uid and blocked_id = p_blocked_id;
end;
$$;

revoke all on function public.block_user(uuid) from public, anon, authenticated;
revoke all on function public.unblock_user(uuid) from public, anon, authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
