-- Release hardening (DEC-045 (6) deferred item): bounded growth for tables that only accumulate.
-- Forward-only. One daily pg_cron job calls purge_housekeeping(), which deletes:
--   - api_rate_limits buckets older than 2 days (the longest window any caller uses is 1 day, so
--     no live limit is affected);
--   - cron.job_run_details older than 7 days (deliver-due-letters adds one row a minute);
--   - finished notification_outbox rows (sent or failed) older than 30 days. Pending rows are never
--     touched, so nothing still to be sent is lost.
-- Letters, profiles and reports are never purged here.

create function public.purge_housekeeping()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.api_rate_limits where window_start < now() - interval '2 days';
  delete from public.notification_outbox
    where status in ('sent', 'failed') and created_at < now() - interval '30 days';
  delete from cron.job_run_details where end_time < now() - interval '7 days';
end;
$$;

revoke all on function public.purge_housekeeping() from public, anon, authenticated;

-- Runs as the scheduling role (postgres, the function's owner), like deliver-due-letters.
-- cron.schedule() with a name upserts, so re-applying cannot duplicate the job.
select cron.schedule('purge-housekeeping', '17 3 * * *', 'select public.purge_housekeeping();');
