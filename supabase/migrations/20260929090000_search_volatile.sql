-- Phase 6 M8 fix (found on the device against the linked project, 2026-09-29): search_users() and
-- find_user_by_email() were declared STABLE, but both call check_rate_limit(), which INSERTs into
-- api_rate_limits. PostgREST runs STABLE/IMMUTABLE functions in a read-only transaction, so every
-- search through the API failed with "cannot execute INSERT in a read-only transaction" (25006).
-- pgTAP did not catch it: tests call the functions inside an ordinary writable transaction.
--
-- Forward-only and non-destructive: only the volatility changes. Bodies, SECURITY DEFINER, the empty
-- search_path, grants and every rule (rate limits, discoverability, neutral email result) are
-- unchanged. tests/database/function_volatility.test.sql guards the whole public schema.
alter function public.search_users(text) volatile;
alter function public.find_user_by_email(text) volatile;
