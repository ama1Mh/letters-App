-- Phase 12.2: letter design v2 (DEC-060/061/062). A letter's composition is structured data:
-- paper, font, ink, text size and a list of placed elements (stamps, stickers, postmarks), each with
-- a position, scale, rotation and stacking order. Mirrors mobile/src/domain/design.ts's zod schema
-- and shared/design-catalog.json (version 2); all three must change together.
--
-- Forward-only. is_valid_design() now accepts:
--   v1: exactly the Phase 4 rules, frozen. Existing letters keep v1 designs forever: delivered
--       letters can never be rewritten (letters_prevent_delivered_update), and a CHECK constraint is
--       re-evaluated on every UPDATE of the row, including mark_read() and delete-for-me, so v1 must
--       stay valid. The app upgrades v1 to v2 when it reads a letter.
--   v2: the new shape, with the owner-approved limits (DEC-061 (3)): at most 24 elements, scale
--       0.3-3, and at most 8192 bytes of serialized design. The limits are enforced here, not only
--       in the app.
-- No table, column, policy, grant, RPC, trigger, cron, push or Realtime change: the composition
-- travels in the existing letters.design column, which every send/deliver/read path already
-- carries untouched. The server never renders or reconstructs anything from an image.
--
-- None of these functions are revoked: a CHECK constraint is evaluated with the privileges of the
-- role writing the row (see 20260924180000_letters_design_validation.sql), and is_valid_design()
-- calls the helpers below, so the writer needs EXECUTE on all of them. They read nothing but their
-- argument.
--
-- Every numeric cast sits behind a CASE on jsonb_typeof(): Postgres does not promise left-to-right
-- evaluation of AND, so a string where a number belongs must be rejected without ever being cast
-- (a cast error would surface as 22P02 instead of the constraint's 23514). Verified read-only on the
-- linked project in the 12.0 spike.

-- ---------------------------------------------------------------------------------------------
-- v1: the Phase 4 rules, unchanged
-- ---------------------------------------------------------------------------------------------

create function public.is_valid_design_v1(p_design jsonb)
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

-- ---------------------------------------------------------------------------------------------
-- v2
-- ---------------------------------------------------------------------------------------------

-- One placed element: exactly these eight keys, an 8-character [a-z0-9] id, an asset from its own
-- type's catalog, x in [0, 1] and y in [0, 40] (canvas-width units from the physical top-left),
-- scale in [0.3, 3], rotation in [-180, 180] degrees, and an integer z in [0, 23].
create function public.is_valid_design_element(p_element jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_element) = 'object'
    and (select count(*) from jsonb_object_keys(p_element)) = 8
    and p_element ?& array['id', 'type', 'asset', 'x', 'y', 'scale', 'rotation', 'z']
    and jsonb_typeof(p_element -> 'id') = 'string'
    and (p_element ->> 'id') ~ '^[a-z0-9]{8}$'
    and case p_element ->> 'type'
          when 'stamp' then p_element ->> 'asset' in ('stamp_dove', 'stamp_palm', 'stamp_lighthouse')
          when 'sticker' then p_element ->> 'asset' in ('sticker_flower', 'sticker_moon', 'sticker_washi')
          when 'postmark' then p_element ->> 'asset' in ('postmark_round', 'postmark_wavy')
          else false
        end
    and case when jsonb_typeof(p_element -> 'x') = 'number'
          then (p_element ->> 'x')::numeric between 0 and 1 else false end
    and case when jsonb_typeof(p_element -> 'y') = 'number'
          then (p_element ->> 'y')::numeric between 0 and 40 else false end
    and case when jsonb_typeof(p_element -> 'scale') = 'number'
          then (p_element ->> 'scale')::numeric between 0.3 and 3 else false end
    and case when jsonb_typeof(p_element -> 'rotation') = 'number'
          then (p_element ->> 'rotation')::numeric between -180 and 180 else false end
    and case when jsonb_typeof(p_element -> 'z') = 'number'
          then (p_element ->> 'z')::numeric between 0 and 23
               and (p_element ->> 'z')::numeric = trunc((p_element ->> 'z')::numeric)
          else false end,
    false
  );
$$;

create function public.is_valid_design_v2(p_design jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_design) = 'object'
    -- Size first: everything after it walks the document.
    and octet_length(p_design::text) <= 8192
    and (select count(*) from jsonb_object_keys(p_design)) = 7
    and p_design ?& array['v', 'paper', 'font', 'ink', 'textSize', 'layout', 'elements']
    and jsonb_typeof(p_design -> 'v') = 'number' -- "2" as a string is not version 2
    and (p_design ->> 'v') = '2'
    and p_design ->> 'paper' in ('aged_cream', 'warm_ivory', 'parchment')
    and p_design ->> 'font' in (
      'caveat', 'im_fell_english', 'playfair_display', 'aref_ruqaa', 'amiri', 'reem_kufi', 'cairo',
      'tajawal'
    )
    and p_design ->> 'ink' in ('black', 'dark_brown', 'faded_blue', 'burgundy', 'forest_green', 'sepia')
    and p_design ->> 'textSize' in ('s', 'm', 'l')
    and p_design ->> 'layout' = 'standard'
    and jsonb_typeof(p_design -> 'elements') = 'array'
    and jsonb_array_length(p_design -> 'elements') <= 24
    and not exists (
      select 1
      from jsonb_array_elements(p_design -> 'elements') as e(value)
      where not public.is_valid_design_element(e.value)
    )
    and (
      select count(distinct e.value ->> 'id')
      from jsonb_array_elements(p_design -> 'elements') as e(value)
    ) = jsonb_array_length(p_design -> 'elements'),
    false
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Dispatcher (the function the letters_design_is_valid CHECK already calls)
-- ---------------------------------------------------------------------------------------------

-- CREATE OR REPLACE keeps the constraint bound to this function. Replacing it does not re-check
-- existing rows; every existing row is v1, which the v1 branch accepts exactly as before.
create or replace function public.is_valid_design(p_design jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_design) = 'object'
    and case p_design ->> 'v'
          when '1' then public.is_valid_design_v1(p_design)
          when '2' then public.is_valid_design_v2(p_design)
          else false
        end,
    false
  );
$$;

-- New letters default to the v2 default design (shared/design-catalog.json "defaults"; matches
-- mobile/src/domain/design.ts defaultDesign()).
alter table public.letters
  alter column design set default
    '{"v":2,"paper":"aged_cream","font":"caveat","ink":"black","textSize":"m","layout":"standard","elements":[]}'::jsonb;
