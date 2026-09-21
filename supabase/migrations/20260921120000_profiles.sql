-- Phase 2: profiles (PLAN §4.1, DEC-006, DEC-010).
--
-- Rules that must stay in step with the app:
--   * username rules and the skeleton mapping  -> mobile/src/domain/username.ts
--   * display-name rules                       -> mobile/src/domain/displayName.ts
--   * reserved words                           -> RESERVED_WORDS there and in brand.config.ts
--
-- The database is the authority. The app validates first only to give better messages. Errors
-- raised by the RPCs below are stable codes (the exception message), never display text.

create type public.app_locale as enum ('en', 'ar');
create type public.receive_mode as enum ('everyone', 'invite_only');

-- ---------------------------------------------------------------------------------------------
-- Pure helpers (immutable, so they can back CHECK constraints and a generated column)
-- ---------------------------------------------------------------------------------------------

-- Canonical look-alike form (DEC-010). Order is part of the contract: drop '_', then rn -> m,
-- then vv -> w, then 0->o, 1->l, i->l, 5->s. replace() is a single left-to-right, non-overlapping
-- pass, exactly like the app's global regex replace.
create function public.username_skeleton(p_username text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select translate(
    replace(replace(replace(lower(p_username), '_', ''), 'rn', 'm'), 'vv', 'w'),
    '01i5',
    'olls'
  );
$$;

-- Stored form only: lowercase letters, digits and '_', 3-20 characters, starts with a letter,
-- no trailing '_', no '__'.
create function public.is_valid_username(p_username text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_username is not null
     and p_username ~ '^[a-z][a-z0-9_]{2,19}$'
     and p_username !~ '_$'
     and p_username !~ '__';
$$;

-- Structure of a (client-sanitized) display name. Reserved words need a table lookup and are
-- checked by a trigger instead. The database rejects the characters DEC-010 lists (zero-width,
-- bidi marks/overrides/isolates, BOM) and control characters; the app strips a wider set first.
create function public.is_valid_display_name(p_name text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_name is not null
     and p_name is nfc normalized
     and char_length(p_name) between 1 and 50
     -- Only plain single spaces, none at the ends.
     and p_name = btrim(p_name)
     and p_name !~ '  '
     and regexp_replace(p_name, ' ', '', 'g') !~ '[[:space:]]'
     -- Control characters (C0, DEL, C1).
     and p_name !~ '[\x01-\x1f\x7f-\x9f]'
     -- U+200B-U+200F, U+202A-U+202E, U+2066-U+2069, U+FEFF (built from code points).
     and p_name !~ (
       '[' || chr(8203) || '-' || chr(8207)
           || chr(8234) || '-' || chr(8238)
           || chr(8294) || '-' || chr(8297)
           || chr(65279) || ']'
     )
     -- '@', fullwidth '@' (U+FF20), small '@' (U+FE6B).
     and position('@' in p_name) = 0
     and position(chr(65312) in p_name) = 0
     and position(chr(65131) in p_name) = 0
     -- At least one letter or digit.
     and p_name ~ '[[:alnum:]]'
     -- No URL-like text (heuristic, same as the app): '://', 'www.', or a dot before a common TLD.
     and p_name !~* '://'
     and p_name !~* '(^|[^[:alnum:]])www\.'
     and p_name !~* '[[:alnum:]-]\.(com|net|org|io|app|me|co|ly|link|xyz|info|biz|dev|ai|gg|tv|ws|cc)([^[:alnum:]]|$)';
$$;

-- ---------------------------------------------------------------------------------------------
-- Reserved words (DEC-010). Checked on the skeleton, so look-alikes are blocked as well.
-- ---------------------------------------------------------------------------------------------

create table public.reserved_words (
  word text primary key check (word ~ '^[a-z0-9]+$')
);

insert into public.reserved_words (word) values
  ('admin'), ('administrator'), ('support'), ('help'), ('staff'), ('moderator'), ('official'),
  ('system'), ('security'), ('root'), ('null'), ('undefined'), ('api'), ('www'),
  ('letterapp'); -- brand words: keep in step with brand.config.ts; add the final brand at the naming freeze

alter table public.reserved_words enable row level security; -- no policies: nobody but the owner reads it
revoke all on public.reserved_words from public, anon, authenticated;

create function public.is_reserved_word(p_value text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reserved_words r
    where public.username_skeleton(r.word) = public.username_skeleton(p_value)
  );
$$;

revoke all on function public.is_reserved_word(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- profiles (1:1 with auth.users). Created by a trigger at sign-up with everything unset;
-- username and display name are chosen during onboarding.
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Stored lowercase, so a plain unique constraint is case-insensitive uniqueness.
  username text unique,
  -- Look-alike protection: two usernames with the same skeleton cannot coexist.
  username_skeleton text generated always as (public.username_skeleton(username)) stored unique,
  display_name text,
  avatar_key text, -- preset icon key; not writable by clients until the catalog exists (DEC-011)
  locale public.app_locale not null default 'en',
  receive_mode public.receive_mode not null default 'invite_only',
  discoverable_by_username boolean not null default true,
  discoverable_by_email boolean not null default false,
  read_receipts_enabled boolean not null default true,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_username_format check (username is null or public.is_valid_username(username)),
  constraint profiles_display_name_format check (display_name is null or public.is_valid_display_name(display_name)),
  constraint profiles_onboarded_complete check (onboarded_at is null or (username is not null and display_name is not null))
);

-- Reserved words (table lookup, so a trigger and not a CHECK).
create function public.profiles_check_reserved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.username is not null
     and (tg_op = 'INSERT' or new.username is distinct from old.username)
     and public.is_reserved_word(new.username) then
    raise exception 'username_unavailable';
  end if;

  if new.display_name is not null
     and (tg_op = 'INSERT' or new.display_name is distinct from old.display_name)
     and public.is_reserved_word(regexp_replace(new.display_name, '\s+', '', 'g')) then
    raise exception 'display_name_reserved';
  end if;

  return new;
end;
$$;

revoke all on function public.profiles_check_reserved() from public, anon, authenticated;

create trigger profiles_check_reserved
  before insert or update on public.profiles
  for each row execute function public.profiles_check_reserved();

-- ---------------------------------------------------------------------------------------------
-- Row level security: default deny. A user reads and updates only their own row, and only the
-- columns granted below. Username is set through complete_onboarding(), never directly.
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, locale, receive_mode, discoverable_by_username, discoverable_by_email, read_receipts_enabled)
  on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Sign-up trigger: every new auth user gets a profile row.
-- ---------------------------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, locale)
  values (
    new.id,
    case
      when new.raw_user_meta_data ->> 'locale' in ('en', 'ar')
        then (new.raw_user_meta_data ->> 'locale')::public.app_locale
      else 'en'
    end
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- RPCs (all check auth.uid()). Failure = exception whose message is a stable code.
-- ---------------------------------------------------------------------------------------------

-- Is this username free for the caller? False for invalid, reserved, taken and look-alike names
-- alike, so the answer never says which. Returns true for the caller's own current username.
-- TODO(OPEN-5): rate-limit availability checks once the shared rate-limit table exists.
create function public.check_username_available(p_username text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_username text := lower(btrim(p_username));
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_valid_username(v_username) or public.is_reserved_word(v_username) then
    return false;
  end if;

  return not exists (
    select 1
    from public.profiles p
    where p.username_skeleton = public.username_skeleton(v_username)
      and p.id <> v_uid
  );
end;
$$;

-- Finishes onboarding in one step. Codes: not_authenticated, invalid_input, username_invalid,
-- display_name_invalid, username_unavailable (taken, look-alike or reserved), display_name_reserved,
-- profile_not_found, already_onboarded.
create function public.complete_onboarding(
  p_username text,
  p_display_name text,
  p_locale public.app_locale,
  p_discoverable_by_email boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_username text := lower(btrim(p_username));
  v_onboarded_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_display_name is null or p_locale is null or p_discoverable_by_email is null then
    raise exception 'invalid_input';
  end if;
  if not public.is_valid_username(v_username) then
    raise exception 'username_invalid';
  end if;
  if not public.is_valid_display_name(p_display_name) then
    raise exception 'display_name_invalid';
  end if;

  select p.onboarded_at into v_onboarded_at
  from public.profiles p
  where p.id = v_uid
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;
  if v_onboarded_at is not null then
    raise exception 'already_onboarded';
  end if;

  begin
    update public.profiles
    set username = v_username,
        display_name = p_display_name,
        locale = p_locale,
        discoverable_by_email = p_discoverable_by_email,
        onboarded_at = now()
    where id = v_uid;
  exception
    when unique_violation then
      raise exception 'username_unavailable';
  end;
end;
$$;

revoke all on function public.check_username_available(text) from public, anon, authenticated;
revoke all on function public.complete_onboarding(text, text, public.app_locale, boolean) from public, anon, authenticated;
grant execute on function public.check_username_available(text) to authenticated;
grant execute on function public.complete_onboarding(text, text, public.app_locale, boolean) to authenticated;
