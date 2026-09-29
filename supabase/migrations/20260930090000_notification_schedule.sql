-- Phase 7: run the `send-notifications` Edge Function every minute (DEC-050 (3), DEC-051).
-- Forward-only.
--
-- The function needs a service_role JWT, and that key must never be in git or in a migration. So
-- the job reads it, and the function's URL, from Supabase Vault at run time. Until the owner has
-- stored both secrets (dashboard -> Project Settings -> Vault, see DECISIONS.md DEC-051), every
-- run is a no-op: nothing is sent and nothing fails. It also skips the HTTP call when no
-- notification is due, so an idle project makes no requests.
--
--   send_notifications_url  https://<project-ref>.supabase.co/functions/v1/send-notifications
--   send_notifications_key  the project's service_role key (legacy JWT key)

-- Supabase's convention: pg_net's objects live in the `net` schema whatever schema is named here.
create extension if not exists pg_net with schema extensions;

-- invoke_send_notifications(): queues one POST to the Edge Function (pg_net sends it after the
-- transaction commits) and returns pg_net's request id, or null when it did nothing (secrets
-- missing, or no notification due). Server-only: never callable by clients. The key is read here
-- and handed to pg_net; it is never returned, stored elsewhere or logged by this function.
create function public.invoke_send_notifications()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'send_notifications_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'send_notifications_key';
  if v_url is null or v_key is null or v_url !~ '^https://' then
    return null;
  end if;
  if not exists (
    select 1 from public.notification_outbox
    where status = 'pending' and next_attempt_at <= now()
      and (locked_until is null or locked_until <= now())
  ) then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.invoke_send_notifications() from public, anon, authenticated;

-- cron.schedule() with a name upserts, so re-applying cannot duplicate the job. Like the delivery
-- job it runs as the migration role, which owns the function.
select cron.schedule('send-notifications', '* * * * *', 'select public.invoke_send_notifications();');
