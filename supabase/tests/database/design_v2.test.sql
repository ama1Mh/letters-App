-- pgTAP tests for letter design v2 (20261003090000_design_v2.sql, DEC-060/061/062).
-- Run with `supabase test db` (CI: database.yml). Mirrors mobile/__tests__/design.test.ts's
-- designSchema cases at the constraint layer.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000c01', 'd1@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000c02', 'd2@example.test', '{}');

-- A reusable valid design, edited per case below.
create temporary table t_design (d jsonb) on commit drop;
insert into t_design values ('{
  "v": 2, "paper": "aged_cream", "font": "amiri", "ink": "sepia", "textSize": "m", "layout": "standard",
  "elements": [
    {"id": "a1stamp1", "type": "stamp", "asset": "stamp_dove", "x": 0.82, "y": 0.14, "scale": 1, "rotation": -6, "z": 0},
    {"id": "b2stick1", "type": "sticker", "asset": "sticker_moon", "x": 0.3, "y": 1.1, "scale": 1.2, "rotation": 12.5, "z": 1},
    {"id": "c3post01", "type": "postmark", "asset": "postmark_round", "x": 0.6, "y": 0.3, "scale": 0.3, "rotation": 180, "z": 2}
  ]
}'::jsonb);

-- ---------------------------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------------------------
select ok(
  (select bool_and(provolatile = 'i' and not prosecdef) from pg_proc
   where oid in ('public.is_valid_design(jsonb)'::regprocedure,
                 'public.is_valid_design_v1(jsonb)'::regprocedure,
                 'public.is_valid_design_v2(jsonb)'::regprocedure,
                 'public.is_valid_design_element(jsonb)'::regprocedure)),
  'the design validators are IMMUTABLE and not SECURITY DEFINER'
);
select ok(
  has_function_privilege('authenticated', 'public.is_valid_design_element(jsonb)', 'execute'),
  'writers can execute the element helper (CHECK runs with the writer''s privileges)'
);

-- ---------------------------------------------------------------------------------------------
-- v1 stays valid (existing and delivered letters)
-- ---------------------------------------------------------------------------------------------
select ok(
  public.is_valid_design('{"v":1,"paper":"sky","font":"amiri","ink":"navy","layout":"standard","stamp":"heart","stickers":[]}'::jsonb),
  'a v1 design is still valid'
);
select ok(
  not public.is_valid_design('{"v":1,"paper":"aged_cream","font":"amiri","ink":"navy","layout":"standard","stamp":null,"stickers":[]}'::jsonb),
  'v1 does not accept v2 keys'
);

-- ---------------------------------------------------------------------------------------------
-- v2: valid shapes
-- ---------------------------------------------------------------------------------------------
select ok(public.is_valid_design((select d from t_design)), 'a realistic v2 composition is valid');
select ok(
  public.is_valid_design('{"v":2,"paper":"parchment","font":"aref_ruqaa","ink":"black","textSize":"l","layout":"standard","elements":[]}'::jsonb),
  'a v2 design with no elements is valid'
);
select ok(
  public.is_valid_design(
    (select jsonb_set(d, '{elements}', (
       select jsonb_agg(jsonb_build_object('id', lpad(i::text, 8, 'a'), 'type', 'sticker', 'asset', 'sticker_flower',
                                           'x', 0.1234, 'y', 39.9999, 'scale', 2.9999, 'rotation', -179.99, 'z', i - 1))
       from generate_series(1, 24) as i))
     from t_design)
  ),
  'exactly 24 elements at the edges of every range is valid'
);

-- ---------------------------------------------------------------------------------------------
-- v2: rejected shapes
-- ---------------------------------------------------------------------------------------------
select ok(not public.is_valid_design(null), 'null is invalid');
select ok(not public.is_valid_design('[]'::jsonb), 'an array is invalid');
select ok(not public.is_valid_design('{"v":3}'::jsonb), 'an unknown version is invalid');
select ok(not public.is_valid_design((select d || '{"v":"2"}' from t_design)), 'a string version is invalid');
select ok(not public.is_valid_design((select d || '{"paper":"gold_foil"}' from t_design)), 'an unknown paper is invalid');
select ok(not public.is_valid_design((select d || '{"font":"comic_sans"}' from t_design)), 'an unknown font is invalid');
select ok(not public.is_valid_design((select d || '{"ink":"invisible"}' from t_design)), 'an unknown ink is invalid');
select ok(not public.is_valid_design((select d || '{"textSize":"xl"}' from t_design)), 'an unknown text size is invalid');
select ok(not public.is_valid_design((select d || '{"layout":"fancy"}' from t_design)), 'an unknown layout is invalid');
select ok(not public.is_valid_design((select d || '{"blob":"x"}' from t_design)), 'an extra top-level key is invalid');
select ok(not public.is_valid_design((select d - 'textSize' from t_design)), 'a missing key is invalid');
select ok(not public.is_valid_design((select d || '{"elements":{}}' from t_design)), 'elements must be an array');
select ok(
  not public.is_valid_design(
    (select jsonb_set(d, '{elements}', (
       select jsonb_agg(jsonb_build_object('id', lpad(i::text, 8, 'a'), 'type', 'sticker', 'asset', 'sticker_flower',
                                           'x', 0.5, 'y', 1, 'scale', 1, 'rotation', 0, 'z', 0))
       from generate_series(1, 25) as i))
     from t_design)
  ),
  'more than 24 elements is invalid'
);
select ok(
  not public.is_valid_design((select d || jsonb_build_object('pad', repeat('x', 9000)) from t_design)),
  'a design over 8192 bytes is invalid'
);

-- Element-level cases: each replaces the first element with a broken copy.
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,scale}', '3.01') from t_design)), 'scale above 3 is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,scale}', '0.29') from t_design)), 'scale below 0.3 is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,x}', '1.01') from t_design)), 'x above 1 is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,x}', '-0.01') from t_design)), 'negative x is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,y}', '40.01') from t_design)), 'y above 40 is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,rotation}', '180.5') from t_design)), 'rotation above 180 is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,z}', '0.5') from t_design)), 'a fractional z is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,z}', '24') from t_design)), 'z above 23 is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,id}', '"ABCD1234"') from t_design)), 'an id with capitals is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,id}', '12345678') from t_design)), 'a numeric id is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,asset}', '"sticker_moon"') from t_design)), 'a sticker asset on a stamp is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,type}', '"photo"') from t_design)), 'an unknown element type is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0}', (d #> '{elements,0}') || '{"color":"red"}') from t_design)), 'an extra element key is invalid');
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,1,id}', '"a1stamp1"') from t_design)), 'duplicate element ids are invalid');
select lives_ok(
  $$ select public.is_valid_design((select jsonb_set(d, '{elements,0,x}', '"abc"') from t_design)) $$,
  'a string where a number belongs is rejected without a cast error'
);
select ok(not public.is_valid_design((select jsonb_set(d, '{elements,0,x}', '"0.5"') from t_design)), 'a numeric string x is invalid');

-- ---------------------------------------------------------------------------------------------
-- Through the table, as a user (RLS + CHECK)
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000c01","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.letters (id, sender_id, body, design)
     values ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000c01', 'hi',
             '{"v":2,"paper":"aged_cream","font":"amiri","ink":"sepia","textSize":"m","layout":"standard","elements":[{"id":"a1stamp1","type":"stamp","asset":"stamp_dove","x":0.82,"y":0.14,"scale":1,"rotation":-6,"z":0},{"id":"b2stick1","type":"sticker","asset":"sticker_moon","x":0.3,"y":1.1,"scale":1.2,"rotation":12.5,"z":1}]}'::jsonb) $$,
  'a user can save a draft with a v2 composition'
);
select is(
  (select design -> 'elements' -> 1 ->> 'rotation' from public.letters where id = 'd0000000-0000-0000-0000-000000000001'),
  '12.5',
  'the composition is stored exactly as sent'
);
select throws_ok(
  $$ update public.letters set design = jsonb_set(design, '{elements,0,scale}', '9')
     where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'an out-of-range scale is rejected on update'
);
select lives_ok(
  $$ insert into public.letters (id, sender_id, body)
     values ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000c01', 'default') $$,
  'a draft without a design gets the default'
);
select is(
  (select design from public.letters where id = 'd0000000-0000-0000-0000-000000000002'),
  '{"v":2,"paper":"aged_cream","font":"caveat","ink":"black","textSize":"m","layout":"standard","elements":[]}'::jsonb,
  'the column default is the v2 default design'
);
reset role;

-- ---------------------------------------------------------------------------------------------
-- Delivered letters: v1 keeps working for the remaining one-way updates; v2 is frozen
-- ---------------------------------------------------------------------------------------------
insert into public.letters (id, sender_id, recipient_id, body, status, delivered_at, design) values
  ('d0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02',
   'old', 'delivered', now(),
   '{"v":1,"paper":"cream","font":"caveat","ink":"classic_black","layout":"standard","stamp":"star","stickers":[]}'::jsonb),
  ('d0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02',
   'new', 'delivered', now(), (select d from t_design));

select lives_ok(
  $$ update public.letters set read_at = now() where id = 'd0000000-0000-0000-0000-000000000011' $$,
  'a delivered v1 letter can still be marked read (the CHECK re-runs on update)'
);
select lives_ok(
  $$ update public.letters set recipient_deleted_at = now() where id = 'd0000000-0000-0000-0000-000000000011' $$,
  'a delivered v1 letter can still be deleted-for-me'
);
select throws_ok(
  $$ update public.letters set design = jsonb_set(design, '{elements,0,x}', '0.1')
     where id = 'd0000000-0000-0000-0000-000000000012' $$,
  'P0001', 'delivered_immutable', 'a delivered v2 composition cannot change'
);

select * from finish();
rollback;
