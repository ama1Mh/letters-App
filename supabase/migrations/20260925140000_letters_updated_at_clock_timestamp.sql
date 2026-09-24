-- Forward-fixes a bug in letters_set_updated_at() (20260924120000_letters.sql), already applied to
-- the linked Supabase project before the bug was found and fixed in that file's own source (commit
-- 4803afa). Editing an already-applied migration in place does not get re-pushed to a live project
-- (`supabase db push` only pushes migrations not yet in that project's history), so the fix needs
-- its own forward migration rather than relying on the edited file alone - this is that migration.
--
-- Bug: the trigger set `new.updated_at := now()`. now()/current_timestamp is fixed for the whole
-- transaction in Postgres, so a row inserted and later updated within the same transaction (e.g. a
-- single pgTAP test file, which runs as one transaction) gets the identical value for created_at
-- and updated_at - "updated_at advances on update" can never pass this way, deterministically.
--
-- Fix: clock_timestamp() instead, which reflects the actual wall-clock time of each call. This is
-- a plain CREATE OR REPLACE FUNCTION: non-destructive, touches no table or row, and the existing
-- `letters_set_updated_at` trigger keeps working unchanged (a trigger references its function by
-- OID, which CREATE OR REPLACE FUNCTION preserves - the trigger does not need to be redefined).

create or replace function public.letters_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
