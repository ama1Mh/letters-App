-- Public name chosen 2026-10-01: Mirsal / مرسال (DEC-055). Reserve both spellings for usernames and
-- display names, in step with RESERVED_BRAND_WORDS in mobile/brand.config.ts. 'letterapp' stays
-- reserved: it is still the dev identity (package, scheme, slug).

alter table public.reserved_words drop constraint reserved_words_word_check;
alter table public.reserved_words
  add constraint reserved_words_word_check check (word ~ '^([a-z0-9]+|[ء-ي]+)$');

insert into public.reserved_words (word) values ('mirsal'), ('مرسال')
on conflict (word) do nothing;
