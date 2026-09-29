-- Preset avatars (DEC-011, PLAN §7 MVP: "preset avatar"). Forward-only.
-- profiles.avatar_key was reserved in the Phase 2 migration but not client-writable "until the
-- catalog exists"; shared/avatar-catalog.json now does. The key list below mirrors that file and
-- mobile/src/domain/avatar.ts - all three change together (mobile/__tests__/avatar.test.ts checks
-- this migration against the catalog), the same convention as is_valid_design().
-- No images, no Storage bucket (DEC-011); null means "no avatar".

-- Not revoked: a CHECK constraint's function runs with the writer's privileges (see
-- is_valid_design() in 20260924180000_letters_design_validation.sql).
create function public.is_valid_avatar_key(p_key text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_key is null or p_key in (
    'paw', 'star', 'moon', 'sun', 'flower', 'leaf', 'heart', 'planet', 'rocket', 'music', 'book',
    'coffee', 'bicycle', 'boat', 'camera', 'palette', 'diamond', 'earth', 'flame', 'fish', 'ball',
    'gift', 'ice_cream', 'umbrella'
  );
$$;

alter table public.profiles
  add constraint profiles_avatar_key_valid check (public.is_valid_avatar_key(avatar_key));

-- Clients may now set their own avatar (rows limited by profiles_update_own).
grant update (avatar_key) on public.profiles to authenticated;
