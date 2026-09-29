// delete-account (Phase 9, PLAN §6.5): the signed-in user deletes their own account.
//
// 1. Identify the caller from their own JWT (the platform also verifies it: verify_jwt is on).
// 2. Run public.delete_my_account() AS THAT USER (their JWT, anon key): RLS and auth.uid() apply, so
//    it can only ever affect the caller. It removes drafts, never-delivered letters, invites,
//    connections, blocks and pending notifications, and anonymizes the profile; delivered letters
//    stay with their recipients as from a deleted account.
// 3. Soft-delete the auth user with the admin API: GoTrue keeps the auth.users row (so the profile,
//    and the delivered letters that reference it, are not cascaded away), obfuscates the email and
//    removes the identities, so the account can no longer sign in. The service role key is the one
//    Supabase injects into every hosted function; it never leaves this function.
//
// Responses carry codes only (the app translates them): 200 {ok:true}, 401 not_authenticated,
// 405 method_not_allowed, 500 failed. Nothing about the user is logged.
import { createClient } from 'jsr:@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { code: 'method_not_allowed' });

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json(401, { code: 'not_authenticated' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json(500, { code: 'failed' });

  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) return json(401, { code: 'not_authenticated' });

  const { error: rpcError } = await asUser.rpc('delete_my_account');
  if (rpcError) return json(500, { code: 'failed' });

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId, true);
  if (deleteError) return json(500, { code: 'failed' });

  return json(200, { ok: true });
});
