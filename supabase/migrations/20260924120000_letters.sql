-- Phase 3: letters, drafts only (PLAN §4.1, §4.3, CLAUDE.md security rules).
--
-- Scope for this migration: create/read/edit/delete a *draft*. Sending, scheduling, delivery
-- (deliver_due_letters(), pg_cron, the outbox) and their RPCs (send_letter, unschedule_letter,
-- mark_read, delete_letter_for_me) are Phase 6/9. Replies (Phase 8) are not usable yet either: the
-- "a reply's parent must be a delivered letter addressed to the sender" rule from PLAN §4.1 is not
-- enforced here on purpose, since no delivered letter can exist yet yet - deferred to Phase 8.
--
-- What IS enforced now, because it is a standing CLAUDE.md rule rather than phase-scoped:
--   * RLS enabled, default deny.
--   * Clients cannot write status, delivered_at, sender_id, or any other server-controlled column
--     directly, at the column-privilege level (not just via CHECK) - only via RPC, added in later
--     phases. A client can only ever create/touch rows while status = 'draft'.
--   * A delivered letter is immutable, enforced by a trigger that ignores role (so even a future
--     SECURITY DEFINER RPC cannot accidentally violate it), even though nothing can produce a
--     'delivered' row yet.

create type public.letter_status as enum ('draft', 'scheduled', 'delivered', 'undeliverable');
create type public.text_dir as enum ('ltr', 'rtl');

create table public.letters (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id),
  -- Null while a draft has no recipient chosen yet (PLAN §4.1).
  recipient_id uuid references public.profiles (id),
  -- Root letter of the thread. Set by the trigger below: its own id for a fresh letter, or
  -- inherited from parent_letter_id for a reply.
  thread_id uuid not null,
  parent_letter_id uuid references public.letters (id),
  subject text,
  body text not null default '',
  -- Computed by the app on save (mobile/src/domain/bodyDirection.ts), not derived here: a letter's
  -- direction is independent of either side's UI language (DEC-014).
  body_dir public.text_dir not null default 'ltr',
  -- Versioned design JSON (PLAN §3.4). Only a structural check for now; key/version validation
  -- against shared/design-catalog.json is Phase 4.
  design jsonb not null default '{}'::jsonb,
  status public.letter_status not null default 'draft',
  scheduled_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  sender_deleted_at timestamptz,
  recipient_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint letters_subject_length check (subject is null or char_length(subject) <= 120),
  constraint letters_body_length check (char_length(body) <= 10000),
  constraint letters_design_is_object check (jsonb_typeof(design) = 'object'),
  constraint letters_scheduled_requires_time check (status <> 'scheduled' or scheduled_at is not null),
  constraint letters_nondraft_requires_recipient check (status = 'draft' or recipient_id is not null)
);

-- ---------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------

-- thread_id: a fresh letter is the root of its own thread; a reply inherits its parent's thread.
-- Column defaults run before a BEFORE INSERT trigger fires, so new.id already has its generated
-- value here.
create function public.letters_set_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_letter_id is not null then
    select thread_id into new.thread_id
    from public.letters
    where id = new.parent_letter_id;

    if new.thread_id is null then
      raise exception 'invalid_input'; -- parent_letter_id does not exist
    end if;
  elsif new.thread_id is null then
    new.thread_id := new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.letters_set_thread() from public, anon, authenticated;

create trigger letters_set_thread
  before insert on public.letters
  for each row execute function public.letters_set_thread();

create function public.letters_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.letters_set_updated_at() from public, anon, authenticated;

create trigger letters_set_updated_at
  before update on public.letters
  for each row execute function public.letters_set_updated_at();

-- Delivered letters are immutable (CLAUDE.md). Checks OLD.status, not the caller's role, so this
-- holds even for a future SECURITY DEFINER RPC that forgets to check it itself.
create function public.letters_prevent_delivered_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'delivered' then
    raise exception 'delivered_immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.letters_prevent_delivered_update() from public, anon, authenticated;

create trigger letters_prevent_delivered_update
  before update on public.letters
  for each row execute function public.letters_prevent_delivered_update();

-- ---------------------------------------------------------------------------------------------
-- Indexes (PLAN §4.1)
-- ---------------------------------------------------------------------------------------------

create index letters_recipient_inbox_idx on public.letters (recipient_id, delivered_at desc)
  where status = 'delivered';
create index letters_sender_list_idx on public.letters (sender_id, status, updated_at desc);
create index letters_scheduled_idx on public.letters (scheduled_at) where status = 'scheduled';
create index letters_thread_idx on public.letters (thread_id, created_at);

-- ---------------------------------------------------------------------------------------------
-- Row level security: default deny. A client may only ever create or edit their own DRAFT rows;
-- every other column and every other status transition is server-controlled (later phases' RPCs).
-- ---------------------------------------------------------------------------------------------

alter table public.letters enable row level security;

revoke all on public.letters from public, anon, authenticated;
grant select on public.letters to authenticated;
-- `id` is client-generatable (not server-only like status/sender_id): the offline drafts store
-- (PLAN §4.3, mobile/src/data/local/) generates one id and uses it both locally and remotely, so a
-- draft created offline and later synced never needs a separate "remote id" mapping.
grant insert (id, sender_id, recipient_id, subject, body, body_dir, design) on public.letters to authenticated;
grant update (recipient_id, subject, body, body_dir, design) on public.letters to authenticated;
grant delete on public.letters to authenticated;

-- SELECT: sender sees every status of their own letters; a recipient sees only what was actually
-- delivered to them and that they have not deleted-for-me (Phase 9 sets recipient_deleted_at).
create policy letters_select_sender on public.letters
  for select to authenticated
  using (sender_id = (select auth.uid()));

create policy letters_select_recipient on public.letters
  for select to authenticated
  using (
    recipient_id = (select auth.uid())
    and status = 'delivered'
    and recipient_deleted_at is null
  );

-- INSERT/UPDATE/DELETE: sender only, and only while status = 'draft' - both USING and WITH CHECK
-- require it, so a client cannot flip status away from 'draft' even in the same statement (status
-- is not among the granted UPDATE columns anyway; this is defense in depth).
create policy letters_insert_own_draft on public.letters
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and status = 'draft');

create policy letters_update_own_draft on public.letters
  for update to authenticated
  using (sender_id = (select auth.uid()) and status = 'draft')
  with check (sender_id = (select auth.uid()) and status = 'draft');

create policy letters_delete_own_draft on public.letters
  for delete to authenticated
  using (sender_id = (select auth.uid()) and status = 'draft');
