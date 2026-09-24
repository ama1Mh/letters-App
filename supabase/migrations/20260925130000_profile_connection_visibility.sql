-- Phase 5 follow-up: profiles.profiles_select_own (20260921120000_profiles.sql) only lets a user
-- read their own row. That is too narrow for the connections inbox (app/connections.tsx), which
-- needs to show the *other* party's username/display name for both incoming and outgoing pending
-- requests via a PostgREST embed - a plain embed is subject to RLS on the embedded table, it does
-- not go through a SECURITY DEFINER RPC the way search_users()/find_user_by_email() do.
--
-- Adds a second, purely additive SELECT policy (RLS policies for the same command are OR'd
-- together): a profile is also visible to a user who has any `connections` row with it, pending or
-- accepted. This only ever exposes the same non-secret columns profiles already grants to
-- `authenticated` (no email column exists on profiles; email lives in auth.users, never touched
-- here) to someone the caller has already requested, been requested by, or connected with.

create policy profiles_select_connection_related on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.connections c
      where (c.requester_id = (select auth.uid()) and c.addressee_id = profiles.id)
         or (c.addressee_id = (select auth.uid()) and c.requester_id = profiles.id)
    )
  );
