-- Phase 9: list the people I blocked, so they can be unblocked (DEC-013). Forward-only, read-only.
-- The blocks_select_own policy already shows my blocks rows, but the blocked person's profile is
-- not readable under the profiles policies (no connection: blocking removed it), so the names come
-- from this SECURITY DEFINER function. Only blocks *I* made are listed - never who blocked me
-- (the blocked person is never told, DEC-013). A deleted account's name fields are null.
-- Error codes: not_authenticated.
create function public.list_blocked_users()
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_key text,
  blocked_at timestamptz
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

  return query
  select
    b.blocked_id,
    case when p.deleted_at is null then p.username end,
    case when p.deleted_at is null then p.display_name end,
    case when p.deleted_at is null then p.avatar_key end,
    b.created_at
  from public.blocks b
  left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = v_uid
  order by b.created_at desc, b.blocked_id;
end;
$$;

revoke all on function public.list_blocked_users() from public, anon, authenticated;
grant execute on function public.list_blocked_users() to authenticated;
