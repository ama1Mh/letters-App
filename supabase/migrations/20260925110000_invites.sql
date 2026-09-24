-- Phase 5: invites (PLAN §3.6/§4.1, DEC-012). One active (non-revoked) invite per owner; redeeming
-- creates an already-accepted connection (DEC-007). Codes: random 10-char base32, not guessable.
-- Redemption is idempotent for the same redeemer (calling it again just returns the existing
-- connection rather than erroring), matching DEC-012's "redemption is idempotent".

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  code text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  max_uses int,
  constraint invites_code_format check (code ~ '^[A-Z2-7]{10}$') -- base32 (RFC 4648, no padding)
);

create unique index invites_code_unique_idx on public.invites (code);
-- At most one *active* (non-revoked) invite per owner; regenerating revokes the old one first
-- (get_or_create_invite()/regenerate_invite() below), so this only ever excludes already-revoked
-- rows, never blocks a legitimate regenerate.
create unique index invites_one_active_per_owner_idx on public.invites (owner_id) where revoked_at is null;

alter table public.invites enable row level security;
revoke all on public.invites from public, anon, authenticated;
grant select on public.invites to authenticated;

-- The owner reads their own invite (to display/share it); redeem_invite() is the only way to look
-- up an invite BY CODE (PLAN §3.6), so there is deliberately no policy letting a stranger find an
-- invite row by scanning/guessing - only by already knowing the code, through the RPC.
create policy invites_select_own on public.invites
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- Random 10-char base32 code (RFC 4648 alphabet minus 0/1/8/9 to avoid look-alikes with O/I/B/g,
-- matching the spirit of DEC-010's username look-alike protection). Collisions are astronomically
-- unlikely (32^10 space) but handled anyway: the caller retries on a unique_violation.
create function public.generate_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- floor(), not a bare ::int cast: Postgres's numeric-to-integer cast rounds to nearest, not
  -- truncates, so a draw like 31.9 would round to 32 and produce an out-of-range substr position
  -- (the alphabet is 32 characters, valid 1-indexed positions are 1-32; floor()+1 always lands in
  -- that range for random()'s [0,1) output, a bare ::int occasionally would not).
  select string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', floor(random() * 32)::int + 1, 1), '')
  from generate_series(1, 10);
$$;

revoke all on function public.generate_invite_code() from public, anon, authenticated;

-- Returns the caller's active invite, creating one if they have none. Codes: PLAN §4.2.
create function public.get_or_create_invite()
returns public.invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.invites;
  v_attempt int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row from public.invites where owner_id = v_uid and revoked_at is null;
  if found then
    return v_row;
  end if;

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.invites (owner_id, code)
      values (v_uid, public.generate_invite_code())
      returning * into v_row;
      return v_row;
    exception
      when unique_violation then
        -- Two possible causes: a (vanishingly unlikely) code collision, or a concurrent call from
        -- this same owner that already created their active invite first. Re-checking handles the
        -- second case correctly instead of retrying into the same violation every time.
        select * into v_row from public.invites where owner_id = v_uid and revoked_at is null;
        if found then
          return v_row;
        end if;
        if v_attempt >= 5 then
          raise exception 'invite_code_generation_failed';
        end if;
        -- else retry with a fresh code
    end;
  end loop;
end;
$$;

-- Revokes the current active invite (if any) and creates a fresh one. PLAN: "regenerate = revoke
-- the old one".
create function public.regenerate_invite()
returns public.invites
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

  update public.invites set revoked_at = now() where owner_id = v_uid and revoked_at is null;
  return public.get_or_create_invite();
end;
$$;

-- Redeeming your own invite is a no-op error (not a connection to yourself); an unknown, revoked,
-- or expired code all return the identical generic error (DEC-012: "identical generic error for
-- unknown/expired/revoked"), so a guesser learns nothing from the difference. Idempotent: redeeming
-- the same code again while already connected to the owner returns quietly rather than erroring.
create function public.redeem_invite(p_code text)
returns uuid -- the resulting connection id
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites;
  v_existing public.connections;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.check_rate_limit('redeem_invite', 20, interval '1 hour') then
    raise exception 'rate_limited';
  end if;

  select * into v_invite
  from public.invites
  where code = upper(btrim(p_code))
    and revoked_at is null
    and (expires_at is null or expires_at > now());
  if not found then
    raise exception 'invite_not_found';
  end if;
  if v_invite.owner_id = v_uid then
    raise exception 'invalid_input';
  end if;
  if public.is_blocked(v_uid, v_invite.owner_id) then
    raise exception 'invite_not_found'; -- same neutral code; never confirm a block
  end if;

  select * into v_existing
  from public.connections
  where least(requester_id, addressee_id) = least(v_uid, v_invite.owner_id)
    and greatest(requester_id, addressee_id) = greatest(v_uid, v_invite.owner_id);

  if found then
    if v_existing.status = 'accepted' then
      return v_existing.id; -- idempotent: already connected via this or another route
    end if;
    -- A pending or declined row for the pair is replaced: redeeming an invite always succeeds and
    -- always results in an accepted connection (DEC-007: "redeeming it creates the connection
    -- already accepted"), regardless of any prior pending request or an old decline/cooldown - an
    -- invite is a stronger signal of consent than a request, so it is not subject to that cooldown.
    delete from public.connections where id = v_existing.id;
  end if;

  insert into public.connections (requester_id, addressee_id, status, via, invite_id, responded_at)
  values (v_uid, v_invite.owner_id, 'accepted', 'invite', v_invite.id, now())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.get_or_create_invite() from public, anon, authenticated;
revoke all on function public.regenerate_invite() from public, anon, authenticated;
revoke all on function public.redeem_invite(text) from public, anon, authenticated;
grant execute on function public.get_or_create_invite() to authenticated;
grant execute on function public.regenerate_invite() to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;

-- Now that invites exists, connect it to connections.invite_id (deferred from the Phase 5
-- blocks/connections migration to avoid a forward reference).
alter table public.connections
  add constraint connections_invite_id_fkey foreign key (invite_id) references public.invites (id);
