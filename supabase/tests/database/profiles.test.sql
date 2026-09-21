-- pgTAP tests for public.profiles (Phase 2). Run with `supabase test db` (CI: database.yml).
-- The vectors mirror mobile/__tests__/username.test.ts and displayName.test.ts.
--
-- no_plan() on purpose: this file was written without a local Postgres to count against.
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------------------------
-- Fixtures: five users with a profile row each (created by the sign-up trigger)
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'u1@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000002', 'u2@example.test', '{"locale":"ar"}'),
  ('00000000-0000-0000-0000-000000000003', 'u3@example.test', '{"locale":"fr"}'),
  ('00000000-0000-0000-0000-000000000004', 'u4@example.test', '{}'),
  ('00000000-0000-0000-0000-000000000005', 'u5@example.test', '{}');

-- ---------------------------------------------------------------------------------------------
-- Sign-up trigger and defaults
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from public.profiles where id::text like '00000000-0000-0000-0000-00000000000_'),
  5,
  'sign-up creates a profile for every new user'
);

select results_eq(
  $$ select receive_mode::text, discoverable_by_username, discoverable_by_email,
            read_receipts_enabled, username is null, display_name is null, onboarded_at is null
     from public.profiles where id = '00000000-0000-0000-0000-000000000001' $$,
  $$ values ('invite_only', true, false, true, true, true, true) $$,
  'new profiles default to invite_only, username-discoverable, not email-discoverable, and un-onboarded'
);

select is((select locale::text from public.profiles where id = '00000000-0000-0000-0000-000000000001'), 'en', 'locale defaults to en');
select is((select locale::text from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 'ar', 'sign-up metadata locale ar is honored');
select is((select locale::text from public.profiles where id = '00000000-0000-0000-0000-000000000003'), 'en', 'an unsupported metadata locale falls back to en');

-- ---------------------------------------------------------------------------------------------
-- Structure and privileges
-- ---------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS is enabled on profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.reserved_words'::regclass), 'RLS is enabled on reserved_words');
select policies_are('public', 'profiles', array['profiles_select_own', 'profiles_update_own']::name[], 'profiles has exactly the expected policies');
select col_is_unique('public', 'profiles', 'username', 'username is unique');
select col_is_unique('public', 'profiles', 'username_skeleton', 'username skeleton is unique (look-alike protection)');

select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon cannot select profiles');
select ok(has_table_privilege('authenticated', 'public.profiles', 'select'), 'authenticated can select profiles (rows limited by RLS)');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'insert'), 'authenticated cannot insert profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'delete'), 'authenticated cannot delete profiles');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'username', 'update'), 'username is not directly updatable');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'avatar_key', 'update'), 'avatar_key is not directly updatable yet');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'onboarded_at', 'update'), 'onboarded_at is not directly updatable');
select ok(has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update'), 'display_name is updatable');
select ok(not has_table_privilege('authenticated', 'public.reserved_words', 'select'), 'authenticated cannot read reserved_words');

select ok(not has_function_privilege('anon', 'public.complete_onboarding(text, text, public.app_locale, boolean)', 'execute'), 'anon cannot run complete_onboarding');
select ok(has_function_privilege('authenticated', 'public.complete_onboarding(text, text, public.app_locale, boolean)', 'execute'), 'authenticated can run complete_onboarding');
select ok(not has_function_privilege('anon', 'public.check_username_available(text)', 'execute'), 'anon cannot run check_username_available');
select ok(has_function_privilege('authenticated', 'public.check_username_available(text)', 'execute'), 'authenticated can run check_username_available');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), 'clients cannot run the sign-up trigger function');
select ok(not has_function_privilege('authenticated', 'public.is_reserved_word(text)', 'execute'), 'clients cannot run is_reserved_word directly');

-- ---------------------------------------------------------------------------------------------
-- Helper functions: skeleton and username format (vectors shared with the TypeScript tests)
-- ---------------------------------------------------------------------------------------------
select is(public.username_skeleton('paypa1'), public.username_skeleton('paypal'), 'skeleton: paypa1 = paypal');
select is(public.username_skeleton('paypai'), public.username_skeleton('paypal'), 'skeleton: paypai = paypal');
select is(public.username_skeleton('rnia'), public.username_skeleton('mia'), 'skeleton: rnia = mia');
select is(public.username_skeleton('a_b'), public.username_skeleton('ab'), 'skeleton: a_b = ab');
select is(public.username_skeleton('vvin'), public.username_skeleton('win'), 'skeleton: vvin = win');
select is(public.username_skeleton('g00gle'), public.username_skeleton('google'), 'skeleton: g00gle = google');
select is(public.username_skeleton('5ara'), public.username_skeleton('sara'), 'skeleton: 5ara = sara');
select isnt(public.username_skeleton('sara'), public.username_skeleton('sarah'), 'skeleton: sara <> sarah');
select isnt(public.username_skeleton('mia'), public.username_skeleton('mira'), 'skeleton: mia <> mira');
select is(public.username_skeleton('r_n'), 'm', 'skeleton order: underscore is dropped before rn -> m');
select is(public.username_skeleton('rn1'), 'ml', 'skeleton: rn1 -> ml');
select is(public.username_skeleton('vv0'), 'wo', 'skeleton: vv0 -> wo');
select is(public.username_skeleton('rrnn'), 'rmn', 'skeleton: single pass, no re-scan');
select is(public.username_skeleton('Sara_92'), 'sara92', 'skeleton lowercases and drops underscores');
select is(public.username_skeleton(null), null, 'skeleton of null is null');

select ok(public.is_valid_username('sara_92'), 'valid username: sara_92');
select ok(public.is_valid_username('abc'), 'valid username: minimum length');
select ok(public.is_valid_username(repeat('a', 20)), 'valid username: maximum length');
select ok(not public.is_valid_username('ab'), 'invalid username: too short');
select ok(not public.is_valid_username(repeat('a', 21)), 'invalid username: too long');
select ok(not public.is_valid_username('Sara'), 'invalid username: uppercase is not a stored form');
select ok(not public.is_valid_username('1abc'), 'invalid username: starts with a digit');
select ok(not public.is_valid_username('_abc'), 'invalid username: starts with underscore');
select ok(not public.is_valid_username('abc_'), 'invalid username: trailing underscore');
select ok(not public.is_valid_username('a__b'), 'invalid username: consecutive underscores');
select ok(not public.is_valid_username('sara-92'), 'invalid username: hyphen');
select ok(not public.is_valid_username('sara.92'), 'invalid username: dot');
select ok(not public.is_valid_username(null), 'invalid username: null');

-- ---------------------------------------------------------------------------------------------
-- Helper function: display-name structure
-- ---------------------------------------------------------------------------------------------
select ok(public.is_valid_display_name('Sara'), 'valid display name: Latin');
select ok(public.is_valid_display_name('Sara Ali'), 'valid display name: two words');
select ok(public.is_valid_display_name('سارة أحمد'), 'valid display name: Arabic');
select ok(public.is_valid_display_name('Sara سارة'), 'valid display name: mixed scripts');
select ok(public.is_valid_display_name('Dr.Ahmed'), 'valid display name: dot in an ordinary name');
select ok(public.is_valid_display_name('123'), 'valid display name: digits only');
select ok(public.is_valid_display_name(repeat('a', 50)), 'valid display name: 50 characters');
select ok(not public.is_valid_display_name(repeat('a', 51)), 'invalid display name: 51 characters');
select ok(not public.is_valid_display_name(''), 'invalid display name: empty');
select ok(not public.is_valid_display_name(' Sara'), 'invalid display name: leading space');
select ok(not public.is_valid_display_name('Sara '), 'invalid display name: trailing space');
select ok(not public.is_valid_display_name('Sara  Ali'), 'invalid display name: double space');
select ok(not public.is_valid_display_name('Sara' || chr(9) || 'Ali'), 'invalid display name: tab');
select ok(not public.is_valid_display_name('Sa' || chr(7) || 'ra'), 'invalid display name: control character');
select ok(not public.is_valid_display_name('Sa' || chr(8203) || 'ra'), 'invalid display name: zero-width space (U+200B)');
select ok(not public.is_valid_display_name('Sa' || chr(8206) || 'ra'), 'invalid display name: left-to-right mark (U+200E)');
select ok(not public.is_valid_display_name('Sa' || chr(8238) || 'ra'), 'invalid display name: right-to-left override (U+202E)');
select ok(not public.is_valid_display_name('Sa' || chr(8294) || 'ra'), 'invalid display name: isolate (U+2066)');
select ok(not public.is_valid_display_name('Sa' || chr(65279) || 'ra'), 'invalid display name: BOM (U+FEFF)');
select ok(not public.is_valid_display_name('Jose' || chr(769)), 'invalid display name: not NFC-normalized');
select ok(not public.is_valid_display_name('!!! ---'), 'invalid display name: no letter or digit');
select ok(not public.is_valid_display_name('sara@home'), 'invalid display name: @');
select ok(not public.is_valid_display_name('sara' || chr(65312) || 'home'), 'invalid display name: fullwidth @');
select ok(not public.is_valid_display_name('sara' || chr(65131) || 'home'), 'invalid display name: small @');
select ok(not public.is_valid_display_name('http://evil.example'), 'invalid display name: URL with scheme');
select ok(not public.is_valid_display_name('visit www.evil.example'), 'invalid display name: www URL');
select ok(not public.is_valid_display_name('evil.com'), 'invalid display name: domain-like');
select ok(not public.is_valid_display_name(null), 'invalid display name: null');

-- Reserved words are checked on the skeleton.
select ok(public.is_reserved_word('admin'), 'reserved: admin');
select ok(public.is_reserved_word('ADMIN'), 'reserved: ADMIN');
select ok(public.is_reserved_word('adm1n'), 'reserved look-alike: adm1n');
select ok(public.is_reserved_word('ad_min'), 'reserved look-alike: ad_min');
select ok(public.is_reserved_word('letterapp'), 'reserved: brand word');
select ok(not public.is_reserved_word('sara'), 'not reserved: sara');
select ok(not public.is_reserved_word('admin_sara'), 'not reserved: contains a reserved word');

-- ---------------------------------------------------------------------------------------------
-- As user 1: own row only, column-limited writes, onboarding
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.profiles), 1, 'a user sees only their own profile');
select is((select id from public.profiles), '00000000-0000-0000-0000-000000000001'::uuid, 'the visible row is their own');
select is_empty($$ select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000002' $$, 'another user''s profile is invisible');
select lives_ok($$ update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-000000000002' $$, 'updating another user''s row is not an error');
select throws_ok($$ update public.profiles set username = 'hacker' where id = '00000000-0000-0000-0000-000000000001' $$, '42501', null, 'username cannot be written directly');
select throws_ok($$ update public.profiles set avatar_key = 'x' where id = '00000000-0000-0000-0000-000000000001' $$, '42501', null, 'avatar_key cannot be written directly');
select throws_ok($$ update public.profiles set onboarded_at = now() where id = '00000000-0000-0000-0000-000000000001' $$, '42501', null, 'onboarded_at cannot be written directly');
select throws_ok($$ insert into public.profiles (id) values ('00000000-0000-0000-0000-000000000009') $$, '42501', null, 'clients cannot insert profiles');
select throws_ok($$ delete from public.profiles where id = '00000000-0000-0000-0000-000000000001' $$, '42501', null, 'clients cannot delete profiles');
select throws_ok($$ select * from public.reserved_words $$, '42501', null, 'clients cannot read reserved_words');
select throws_ok($$ update public.profiles set display_name = 'x@y' where id = '00000000-0000-0000-0000-000000000001' $$, '23514', null, 'an invalid display name is rejected by the CHECK constraint');

select lives_ok($$ select public.complete_onboarding('Sara_92', 'Sara Ali', 'ar', true) $$, 'onboarding succeeds');
select is((select username from public.profiles), 'sara_92', 'the username is stored lowercase');
select is((select display_name from public.profiles), 'Sara Ali', 'the display name is stored');
select is((select locale::text from public.profiles), 'ar', 'the locale is stored');
select is((select discoverable_by_email from public.profiles), true, 'the email-discoverability choice is stored');
select ok((select onboarded_at is not null from public.profiles), 'onboarded_at is set');
select is((select username_skeleton from public.profiles), 'sara92', 'the skeleton is generated');
select is(public.check_username_available('sara_92'), true, 'the owner sees their own username as available');
select throws_ok($$ select public.complete_onboarding('other_name', 'Sara Ali', 'ar', true) $$, 'P0001', 'already_onboarded', 'onboarding cannot be repeated');
select lives_ok($$ update public.profiles set display_name = 'Sara Ali Two' where id = '00000000-0000-0000-0000-000000000001' $$, 'a valid display-name change is allowed');
select throws_ok($$ update public.profiles set display_name = null where id = '00000000-0000-0000-0000-000000000001' $$, '23514', null, 'an onboarded profile cannot lose its display name');
select lives_ok($$ update public.profiles set receive_mode = 'everyone', discoverable_by_username = false, read_receipts_enabled = false where id = '00000000-0000-0000-0000-000000000001' $$, 'settings columns are updatable');

reset role;
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000002'), null, 'user 1 did not change user 2''s profile');

-- ---------------------------------------------------------------------------------------------
-- As user 2: availability answers and every onboarding failure code
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is(public.check_username_available('sara_92'), false, 'a taken username is unavailable');
select is(public.check_username_available('SARA_92'), false, 'availability ignores case');
select is(public.check_username_available('sara92'), false, 'a look-alike of a taken username is unavailable');
select is(public.check_username_available('  zed_1 '), true, 'a free username is available (trimmed)');
select is(public.check_username_available('ab'), false, 'too short is unavailable');
select is(public.check_username_available('9abc'), false, 'an invalid username is unavailable');
select is(public.check_username_available('admin'), false, 'a reserved word is unavailable');
select is(public.check_username_available('adm1n'), false, 'a reserved look-alike is unavailable');
select is(public.check_username_available('letterapp'), false, 'a brand word is unavailable');
select is(public.check_username_available(null), false, 'null is unavailable');

select throws_ok($$ select public.complete_onboarding('9abc', 'Zed', 'en', false) $$, 'P0001', 'username_invalid', 'onboarding: invalid username (digit first)');
select throws_ok($$ select public.complete_onboarding('ab', 'Zed', 'en', false) $$, 'P0001', 'username_invalid', 'onboarding: invalid username (too short)');
select throws_ok($$ select public.complete_onboarding('a__b', 'Zed', 'en', false) $$, 'P0001', 'username_invalid', 'onboarding: invalid username (double underscore)');
select throws_ok($$ select public.complete_onboarding('admin', 'Zed', 'en', false) $$, 'P0001', 'username_unavailable', 'onboarding: reserved username');
select throws_ok($$ select public.complete_onboarding('adm1n', 'Zed', 'en', false) $$, 'P0001', 'username_unavailable', 'onboarding: reserved look-alike');
select throws_ok($$ select public.complete_onboarding('sara_92', 'Zed', 'en', false) $$, 'P0001', 'username_unavailable', 'onboarding: taken username');
select throws_ok($$ select public.complete_onboarding('SARA_92', 'Zed', 'en', false) $$, 'P0001', 'username_unavailable', 'onboarding: taken username, other case');
select throws_ok($$ select public.complete_onboarding('sara92', 'Zed', 'en', false) $$, 'P0001', 'username_unavailable', 'onboarding: look-alike of a taken username');
select throws_ok($$ select public.complete_onboarding('zed_1', null, 'en', false) $$, 'P0001', 'invalid_input', 'onboarding: missing display name');
select throws_ok($$ select public.complete_onboarding('zed_1', 'x@y', 'en', false) $$, 'P0001', 'display_name_invalid', 'onboarding: @ in display name');
select throws_ok($$ select public.complete_onboarding('zed_1', 'evil.com', 'en', false) $$, 'P0001', 'display_name_invalid', 'onboarding: URL-like display name');
select throws_ok($$ select public.complete_onboarding('zed_1', ' Zed', 'en', false) $$, 'P0001', 'display_name_invalid', 'onboarding: leading space in display name');
select throws_ok($$ select public.complete_onboarding('zed_1', 'Z' || chr(8238) || 'ed', 'en', false) $$, 'P0001', 'display_name_invalid', 'onboarding: bidi override in display name');
select throws_ok($$ select public.complete_onboarding('zed_1', repeat('a', 51), 'en', false) $$, 'P0001', 'display_name_invalid', 'onboarding: display name too long');
select throws_ok($$ select public.complete_onboarding('zed_1', 'Admin', 'en', false) $$, 'P0001', 'display_name_reserved', 'onboarding: reserved display name');
select throws_ok($$ select public.complete_onboarding('zed_1', 'A dmin', 'en', false) $$, 'P0001', 'display_name_reserved', 'onboarding: reserved display name split by a space');
select is((select onboarded_at is null from public.profiles), true, 'failed onboarding attempts changed nothing');

select lives_ok($$ select public.complete_onboarding('paypal', 'سارة أحمد', 'ar', false) $$, 'onboarding with an Arabic display name succeeds');
select is((select display_name from public.profiles), 'سارة أحمد', 'the Arabic display name is stored as sent');

reset role;

-- ---------------------------------------------------------------------------------------------
-- As users 3-5: look-alike collisions against existing usernames
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.complete_onboarding('paypa1', 'Pat', 'en', false) $$, 'P0001', 'username_unavailable', 'paypa1 collides with paypal');
select throws_ok($$ select public.complete_onboarding('payp_al', 'Pat', 'en', false) $$, 'P0001', 'username_unavailable', 'payp_al collides with paypal');
select lives_ok($$ select public.complete_onboarding('mia', 'Mia', 'en', false) $$, 'user 3 onboards as mia');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.complete_onboarding('rnia', 'Ria', 'en', false) $$, 'P0001', 'username_unavailable', 'rnia collides with mia');
select lives_ok($$ select public.complete_onboarding('xab', 'Xab', 'en', false) $$, 'user 4 onboards as xab');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.complete_onboarding('xa_b', 'Xa', 'en', false) $$, 'P0001', 'username_unavailable', 'xa_b collides with xab');
select throws_ok($$ select public.complete_onboarding('x_a_b', 'Xa', 'en', false) $$, 'P0001', 'username_unavailable', 'x_a_b collides with xab');
reset role;

-- ---------------------------------------------------------------------------------------------
-- Authentication edge cases
-- ---------------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.check_username_available('zed_1') $$, 'P0001', 'not_authenticated', 'check_username_available needs a signed-in user');
select throws_ok($$ select public.complete_onboarding('zed_1', 'Zed', 'en', false) $$, 'P0001', 'not_authenticated', 'complete_onboarding needs a signed-in user');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.complete_onboarding('zed_1', 'Zed', 'en', false) $$, 'P0001', 'profile_not_found', 'a user without a profile row cannot onboard');
reset role;

set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select public.check_username_available('zed_1') $$, '42501', null, 'anon cannot check usernames');
select throws_ok($$ select public.complete_onboarding('zed_1', 'Zed', 'en', false) $$, '42501', null, 'anon cannot onboard');
reset role;

select * from finish();
rollback;
