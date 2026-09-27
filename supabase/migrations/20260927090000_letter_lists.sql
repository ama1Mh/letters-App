-- Phase 6 step 3B (M0): read functions for the inbox, the Scheduled / Sent lists and the reading
-- view (PLAN §4.1, DEC-044 (2), DEC-046). Forward-only; nothing here writes.
--
-- Why functions and not plain selects:
--   - read_at is not client-selectable at all (DEC-044 (2)); the sender may only see it through
--     masked_read_at(), which these functions apply per row.
--   - profiles_select_own / profiles_select_connection_related only show a profile to its owner
--     or to someone with a connections row. A letter to or from a `receive_mode = everyone` user
--     needs no connection, so the other person's name would otherwise be invisible.
--
-- Visibility is the same as the letters RLS policies, narrowed further:
--   - recipient: delivered only, not deleted-for-me (identical to letters_select_recipient);
--   - sender: scheduled / delivered / undeliverable, not deleted-for-me. Drafts are excluded - they
--     are read through the drafts repository (local-first). Excluding drafts also means the other
--     person's profile is only returned for letters that passed can_send() in send_letter(), never
--     for an arbitrary recipient_id a client typed into a draft.
-- The other person's public fields (username, display_name, avatar_key) are null when that account
-- is deleted. No email, no read_at beyond masked_read_at(). Letters from or to someone later
-- blocked stay visible (owner decision 2026-09-27; Phase 9 decides otherwise if needed).
--
-- Paging is keyset on (sort_at, id), returned with every row so the client passes the last row
-- back as the cursor. p_limit defaults to 30 and is clamped to 1..100.

-- ---------------------------------------------------------------------------------------------
-- list_inbox(cursor_at, cursor_id, limit): delivered letters I received, newest first
-- ---------------------------------------------------------------------------------------------
create function public.list_inbox(
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 30
)
returns table (
  id uuid,
  thread_id uuid,
  subject text,
  preview text,
  body_dir public.text_dir,
  delivered_at timestamptz,
  read_at timestamptz,
  sort_at timestamptz,
  sender_id uuid,
  sender_username text,
  sender_display_name text,
  sender_avatar_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if (p_cursor_at is null) <> (p_cursor_id is null) then
    raise exception 'invalid_input';
  end if;

  return query
  select
    l.id, l.thread_id, l.subject,
    left(btrim(regexp_replace(l.body, '\s+', ' ', 'g')), 200),
    l.body_dir, l.delivered_at,
    l.read_at, -- the caller is the recipient: their own read state (masked_read_at() agrees)
    l.delivered_at,
    l.sender_id,
    case when p.deleted_at is null then p.username end,
    case when p.deleted_at is null then p.display_name end,
    case when p.deleted_at is null then p.avatar_key end
  from public.letters l
  left join public.profiles p on p.id = l.sender_id
  where l.recipient_id = v_uid
    and l.status = 'delivered'
    and l.recipient_deleted_at is null
    and (p_cursor_at is null or (l.delivered_at, l.id) < (p_cursor_at, p_cursor_id))
  order by l.delivered_at desc, l.id desc
  limit v_limit;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- list_sent(kind, cursor_at, cursor_id, limit): my non-draft letters
--   kind 'scheduled': status scheduled, soonest first (sort_at = scheduled_at, cursor moves later)
--   kind 'sent':      delivered and undeliverable, newest first (sort_at = delivered_at, or
--                     scheduled_at for undeliverable letters, which never get delivered_at)
-- ---------------------------------------------------------------------------------------------
create function public.list_sent(
  p_kind text,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 30
)
returns table (
  id uuid,
  thread_id uuid,
  subject text,
  preview text,
  body_dir public.text_dir,
  status public.letter_status,
  scheduled_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  sort_at timestamptz,
  recipient_id uuid,
  recipient_username text,
  recipient_display_name text,
  recipient_avatar_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_kind is null or p_kind not in ('scheduled', 'sent')
     or (p_cursor_at is null) <> (p_cursor_id is null) then
    raise exception 'invalid_input';
  end if;

  if p_kind = 'scheduled' then
    return query
    select
      l.id, l.thread_id, l.subject,
      left(btrim(regexp_replace(l.body, '\s+', ' ', 'g')), 200),
      l.body_dir, l.status, l.scheduled_at, l.delivered_at,
      null::timestamptz, -- never read: not delivered yet
      l.scheduled_at,
      l.recipient_id,
      case when p.deleted_at is null then p.username end,
      case when p.deleted_at is null then p.display_name end,
      case when p.deleted_at is null then p.avatar_key end
    from public.letters l
    left join public.profiles p on p.id = l.recipient_id
    where l.sender_id = v_uid
      and l.status = 'scheduled'
      and l.sender_deleted_at is null
      and (p_cursor_at is null or (l.scheduled_at, l.id) > (p_cursor_at, p_cursor_id))
    order by l.scheduled_at, l.id
    limit v_limit;
  else
    return query
    select
      s.id, s.thread_id, s.subject,
      left(btrim(regexp_replace(s.body, '\s+', ' ', 'g')), 200),
      s.body_dir, s.status, s.scheduled_at, s.delivered_at,
      public.masked_read_at(v_uid, s.sender_id, s.recipient_id, s.status, s.read_at),
      s.sort_at,
      s.recipient_id,
      case when p.deleted_at is null then p.username end,
      case when p.deleted_at is null then p.display_name end,
      case when p.deleted_at is null then p.avatar_key end
    from (
      select l.*, coalesce(l.delivered_at, l.scheduled_at, l.created_at) as sort_at
      from public.letters l
      where l.sender_id = v_uid
        and l.status in ('delivered', 'undeliverable')
        and l.sender_deleted_at is null
    ) s
    left join public.profiles p on p.id = s.recipient_id
    where p_cursor_at is null or (s.sort_at, s.id) < (p_cursor_at, p_cursor_id)
    order by s.sort_at desc, s.id desc
    limit v_limit;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- get_letter(id): one letter for the reading view, as its sender or recipient
-- ---------------------------------------------------------------------------------------------
-- Error codes: not_authenticated, invalid_input, not_found (no such letter, a draft, deleted for
-- the caller, not yet delivered to a recipient, or not the caller's - one code for all, so a
-- scheduled letter's existence is not revealed to its recipient).
create function public.get_letter(p_letter_id uuid)
returns table (
  id uuid,
  thread_id uuid,
  parent_letter_id uuid,
  subject text,
  body text,
  body_dir public.text_dir,
  design jsonb,
  status public.letter_status,
  scheduled_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  viewer_role text,
  sender_id uuid,
  sender_username text,
  sender_display_name text,
  sender_avatar_key text,
  recipient_id uuid,
  recipient_username text,
  recipient_display_name text,
  recipient_avatar_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_letter_id is null then
    raise exception 'invalid_input';
  end if;

  return query
  select
    l.id, l.thread_id, l.parent_letter_id, l.subject, l.body, l.body_dir, l.design,
    l.status, l.scheduled_at, l.delivered_at,
    public.masked_read_at(v_uid, l.sender_id, l.recipient_id, l.status, l.read_at),
    -- A letter to yourself is read as its recipient once delivered (mark_read applies).
    case when l.recipient_id = v_uid and l.status = 'delivered' then 'recipient' else 'sender' end,
    l.sender_id,
    case when ps.deleted_at is null then ps.username end,
    case when ps.deleted_at is null then ps.display_name end,
    case when ps.deleted_at is null then ps.avatar_key end,
    l.recipient_id,
    case when pr.deleted_at is null then pr.username end,
    case when pr.deleted_at is null then pr.display_name end,
    case when pr.deleted_at is null then pr.avatar_key end
  from public.letters l
  left join public.profiles ps on ps.id = l.sender_id
  left join public.profiles pr on pr.id = l.recipient_id
  where l.id = p_letter_id
    and (
      (l.sender_id = v_uid and l.status <> 'draft' and l.sender_deleted_at is null)
      or (l.recipient_id = v_uid and l.status = 'delivered' and l.recipient_deleted_at is null)
    );

  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke all on function public.list_inbox(timestamptz, uuid, int) from public, anon, authenticated;
revoke all on function public.list_sent(text, timestamptz, uuid, int) from public, anon, authenticated;
revoke all on function public.get_letter(uuid) from public, anon, authenticated;
grant execute on function public.list_inbox(timestamptz, uuid, int) to authenticated;
grant execute on function public.list_sent(text, timestamptz, uuid, int) to authenticated;
grant execute on function public.get_letter(uuid) to authenticated;
