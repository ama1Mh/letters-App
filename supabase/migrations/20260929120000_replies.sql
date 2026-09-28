-- Phase 8: replies and threads (PLAN §4.1 "replies must reference a delivered parent addressed to
-- the sender", DEC-007 "replies always allowed unless either side blocked"). Forward-only.
--
-- can_send(sender, recipient, parent) already lets a reply through for an invite_only recipient
-- (Phase 5), and send_letter() / delivery already pass parent_letter_id to it. What was missing:
--   1. clients could not set parent_letter_id at all (not in the INSERT column grant);
--   2. nothing checked the parent: letters_set_thread() (SECURITY DEFINER) copies the thread of ANY
--      existing letter id, so granting the column alone would let a client attach its letter to a
--      stranger's thread, or point a reply draft at a third person (recipient_id stays updatable).
--
-- Rule, enforced for every writer (not just `authenticated`): a letter with a parent must have a
-- DELIVERED parent that was ADDRESSED TO ITS SENDER, and its recipient is that parent's sender. The
-- recipient is filled in when left null, and may not be changed to anyone else afterwards. Every
-- violation raises the one neutral code `invalid_input` (no hint whether the parent exists, is
-- someone else's, or is not delivered yet). parent_letter_id itself is insert-only.

create function public.letters_check_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.letters;
begin
  if new.parent_letter_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.parent_letter_id is distinct from old.parent_letter_id then
    raise exception 'invalid_input'; -- a letter's parent never changes
  end if;

  select * into v_parent from public.letters where id = new.parent_letter_id;
  if not found
     or v_parent.status <> 'delivered'
     or v_parent.recipient_id is distinct from new.sender_id then
    raise exception 'invalid_input';
  end if;

  if new.recipient_id is null then
    new.recipient_id := v_parent.sender_id;
  elsif new.recipient_id <> v_parent.sender_id then
    raise exception 'invalid_input';
  end if;

  return new;
end;
$$;

revoke all on function public.letters_check_reply() from public, anon, authenticated;

-- Named to sort before letters_set_thread (same timing fires in name order): the parent is checked
-- before the thread is inherited from it.
create trigger letters_check_reply
  before insert or update of recipient_id, parent_letter_id on public.letters
  for each row execute function public.letters_check_reply();

grant insert (parent_letter_id) on public.letters to authenticated;

-- ---------------------------------------------------------------------------------------------
-- list_thread(thread_id): the letters of one thread that the caller may see, oldest first
-- ---------------------------------------------------------------------------------------------
-- Visibility is exactly get_letter()'s, per letter: my own letters once sent (scheduled, delivered,
-- undeliverable; not drafts; not deleted for me) and letters delivered to me (not deleted for me).
-- read_at goes through masked_read_at() (my sent letters: only if receipts allow; letters to me:
-- my own read state). `is_mine` is true for letters I sent (including a letter to myself). The
-- other person's public profile fields are null for a deleted account; no email anywhere.
-- Returns at most 200 letters. Error codes: not_authenticated, invalid_input, not_found (no letter
-- of that thread is visible to the caller - the same code whether the thread exists or not).
create function public.list_thread(p_thread_id uuid)
returns table (
  id uuid,
  thread_id uuid,
  parent_letter_id uuid,
  subject text,
  preview text,
  body_dir public.text_dir,
  status public.letter_status,
  scheduled_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  sort_at timestamptz,
  is_mine boolean,
  other_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_key text
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
  if p_thread_id is null then
    raise exception 'invalid_input';
  end if;

  return query
  select
    t.id, t.thread_id, t.parent_letter_id, t.subject,
    left(btrim(regexp_replace(t.body, '\s+', ' ', 'g')), 200),
    t.body_dir, t.status, t.scheduled_at, t.delivered_at,
    public.masked_read_at(v_uid, t.sender_id, t.recipient_id, t.status, t.read_at),
    t.sort_at,
    t.sender_id = v_uid,
    t.other_id,
    case when p.deleted_at is null then p.username end,
    case when p.deleted_at is null then p.display_name end,
    case when p.deleted_at is null then p.avatar_key end
  from (
    select l.*,
      coalesce(l.delivered_at, l.scheduled_at, l.created_at) as sort_at,
      case when l.sender_id = v_uid then l.recipient_id else l.sender_id end as other_id
    from public.letters l
    where l.thread_id = p_thread_id
      and (
        (l.sender_id = v_uid and l.status <> 'draft' and l.sender_deleted_at is null)
        or (l.recipient_id = v_uid and l.status = 'delivered' and l.recipient_deleted_at is null)
      )
  ) t
  left join public.profiles p on p.id = t.other_id
  order by t.sort_at, t.id
  limit 200;

  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke all on function public.list_thread(uuid) from public, anon, authenticated;
grant execute on function public.list_thread(uuid) to authenticated;
