-- Phase 6 step 3A: the pg_cron delivery job, letter change events over Realtime Broadcast, and a
-- read-receipt side-channel fix (PLAN §3.3/§4.1/§6.2, DEC-005/025/044/045). Forward-only.
--
-- Nothing in here contains delivery logic: the cron job only calls deliver_due_letters() (step 2),
-- which calls deliver_letter_internal(), still the single delivery transition.

-- ---------------------------------------------------------------------------------------------
-- 1. pg_cron: deliver due letters once a minute
-- ---------------------------------------------------------------------------------------------

-- Supabase's convention for pg_cron (what the dashboard and `supabase db diff` produce): the
-- extension lives in pg_catalog, its objects in the `cron` schema.
create extension if not exists pg_cron with schema pg_catalog;

-- cron.schedule() with a name upserts: re-running this statement replaces the job instead of
-- adding a second one. The job runs as the role that scheduled it (cron.job.username: the
-- migration role, `postgres`, which owns deliver_due_letters() and so can execute it). That is
-- why no grant is needed or added: deliver_due_letters() and deliver_letter_internal() stay
-- revoked from public/anon/authenticated (step 2), SECURITY DEFINER with an empty search_path.
-- The command is a single call - batch size 500, no business logic here. deliver_due_letters()
-- uses FOR UPDATE SKIP LOCKED, so an overrunning run and the next one never deliver the same
-- letter twice, and a run is safe to repeat at any time (a no-op when nothing is due).
select cron.schedule(
  'deliver-due-letters',
  '* * * * *',
  'select public.deliver_due_letters(500);'
);

-- ---------------------------------------------------------------------------------------------
-- 2. updated_at no longer changes on terminal letters (read-receipt side channel)
-- ---------------------------------------------------------------------------------------------

-- Found while designing Realtime for this step: mark_read() updates a delivered letter, the
-- letters_set_updated_at trigger bumped updated_at, and updated_at is selectable by the sender -
-- so the sender could read the time the recipient opened the letter even with read receipts off,
-- defeating DEC-044 (2)'s masking of read_at. The same held for recipient_deleted_at/
-- sender_deleted_at changes (Phase 9). Once a letter is delivered or undeliverable its content is
-- frozen anyway (letters_prevent_delivered_update), so updated_at now stays at the value it had
-- when the letter reached that state; the transition into it (scheduled -> delivered) still sets
-- it. updated_at only matters for draft sync (PLAN §4.3), which never touches terminal letters.
create or replace function public.letters_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('delivered', 'undeliverable') then
    new.updated_at := old.updated_at;
  else
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function public.letters_set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Realtime: letter events over Broadcast, not postgres_changes (owner decision 2026-09-26)
-- ---------------------------------------------------------------------------------------------

-- `letters` is deliberately NOT added to the supabase_realtime publication. postgres_changes
-- authorizes rows, not events: the sender's RLS policy matches their delivered letter, so the
-- sender would receive an UPDATE event at the moment mark_read() runs - the read time again,
-- whatever the read-receipt settings. (It would also send DELETE events, which skip RLS, to every
-- subscriber.) Instead this trigger publishes a minimal event per affected person through
-- realtime.send() to a private per-user topic, deciding per event who may learn of it.
--
-- Topic: 'letters:<user id>' (private). Payload: {"letter_id": ...} plus "status" for status
-- events - never subject, body, design, names, emails or timestamps. Clients react by refetching
-- through the normal RLS-checked reads/RPCs, so an event can never show more than a read would.
-- realtime.send() also adds a random "id" key to the payload.
--
-- Events:
--   letter_status     -> sender, on any status change of their letter (draft <-> scheduled,
--                        delivered, undeliverable), e.g. for another of their devices.
--   letter_delivered  -> recipient, on scheduled -> delivered only. Undeliverable letters are
--                        never visible to the recipient, so they get no event.
--   letter_read       -> recipient always (their own read state); sender only when
--                        masked_read_at() would show them read_at at that moment (reciprocal
--                        read receipts, DEC-044 (2)).
--   letter_deleted_for_me -> only the person who set their own *_deleted_at (Phase 9).
-- A letter to yourself gets each applicable event once per role, which is harmless.
--
-- realtime.send() catches its own errors and raises a WARNING, so a broadcast problem can never
-- roll back a delivery. It is SECURITY INVOKER, so this function runs it as its owner (postgres).
-- Drafts deleted by their sender produce no event (the sending device already knows; draft sync
-- on focus covers other devices, PLAN §4.3).
create function public.letters_broadcast_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform realtime.send(
      jsonb_build_object('letter_id', new.id, 'status', new.status),
      'letter_status', 'letters:' || new.sender_id::text, true);

    if new.status = 'delivered' then
      perform realtime.send(
        jsonb_build_object('letter_id', new.id),
        'letter_delivered', 'letters:' || new.recipient_id::text, true);
    end if;
  end if;

  if old.read_at is null and new.read_at is not null then
    perform realtime.send(
      jsonb_build_object('letter_id', new.id),
      'letter_read', 'letters:' || new.recipient_id::text, true);

    if new.sender_id <> new.recipient_id
       and public.masked_read_at(new.sender_id, new.sender_id, new.recipient_id, new.status, new.read_at)
           is not null then
      perform realtime.send(
        jsonb_build_object('letter_id', new.id),
        'letter_read', 'letters:' || new.sender_id::text, true);
    end if;
  end if;

  if old.sender_deleted_at is null and new.sender_deleted_at is not null then
    perform realtime.send(
      jsonb_build_object('letter_id', new.id),
      'letter_deleted_for_me', 'letters:' || new.sender_id::text, true);
  end if;

  if old.recipient_deleted_at is null and new.recipient_deleted_at is not null then
    perform realtime.send(
      jsonb_build_object('letter_id', new.id),
      'letter_deleted_for_me', 'letters:' || new.recipient_id::text, true);
  end if;

  return null;
end;
$$;

revoke all on function public.letters_broadcast_changes() from public, anon, authenticated;

create trigger letters_broadcast_changes
  after update on public.letters
  for each row execute function public.letters_broadcast_changes();

-- Who may receive: an authenticated user may join only their own 'letters:<uid>' topic, broadcast
-- only (no presence). No INSERT policy: clients cannot send on these topics, so every event on
-- them comes from the trigger above. Only private channels are checked against these policies -
-- the linked project's Realtime "Allow public access" setting must be turned off so a client
-- cannot join the same topic as a public channel (cloud verification step, DEC-045).
create policy letters_topic_receive_own on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'letters:' || (select auth.uid())::text
  );
