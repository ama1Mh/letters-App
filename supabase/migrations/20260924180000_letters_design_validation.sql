-- Phase 4: validate `letters.design` against the design catalog (PLAN §3.4: "server validates
-- keys/version only"). Mirrors mobile/src/domain/design.ts's zod schema and
-- shared/design-catalog.json; all three must change together, the same convention already used for
-- the username reserved-word list (DEC-010).
--
-- Replaces the earlier structural-only check from the Phase 3 migration
-- (jsonb_typeof(design) = 'object') with the full shape + catalog-key check, now that the catalog
-- exists. That migration has already run in CI since it was written, so this is a new migration
-- rather than an edit to it.

alter table public.letters drop constraint letters_design_is_object;

-- `coalesce(..., false)` matters, not just style: a Postgres CHECK constraint treats a NULL result
-- as *satisfied* (not violated), and several of these comparisons are NULL, not false, for a
-- missing key (e.g. `p_design -> 'stickers'` on a design object with no "stickers" key at all is
-- SQL NULL, so `jsonb_typeof(...) = 'array'` is NULL, not false). Without the coalesce, a design
-- missing a field could pass the constraint outright instead of being rejected.
create function public.is_valid_design(p_design jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    p_design is not null
    and jsonb_typeof(p_design) = 'object'
    and (p_design ->> 'v') = '1'
    and p_design ->> 'paper' in ('cream', 'blush', 'sky', 'mint', 'sand', 'lavender')
    and p_design ->> 'font' in ('caveat', 'playfair_display', 'cairo', 'tajawal', 'amiri')
    and p_design ->> 'ink' in (
      'classic_black', 'navy', 'forest', 'burgundy', 'charcoal', 'royal_purple', 'warm_brown', 'teal'
    )
    and p_design ->> 'layout' = 'standard'
    and (p_design ->> 'stamp' is null or p_design ->> 'stamp' in ('heart', 'star', 'ribbon', 'rocket'))
    and jsonb_typeof(p_design -> 'stickers') = 'array'
    and jsonb_array_length(p_design -> 'stickers') = 0,
    false
  );
$$;

revoke all on function public.is_valid_design(jsonb) from public, anon, authenticated;

alter table public.letters
  add constraint letters_design_is_valid check (public.is_valid_design(design));

-- The Phase 3 column default ('{}'::jsonb) is no longer valid under the check above: every insert
-- that relies on the default (i.e. does not pass design explicitly) needs a real default design.
-- Matches mobile/src/domain/design.ts's defaultDesign() and shared/design-catalog.json's own
-- "defaults" entry exactly.
alter table public.letters
  alter column design set default
    '{"v":1,"paper":"cream","font":"caveat","ink":"classic_black","layout":"standard","stamp":null,"stickers":[]}'::jsonb;
