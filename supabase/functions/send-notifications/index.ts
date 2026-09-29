// send-notifications (Phase 7, PLAN §6.5, DEC-004): drains the notification outbox through the
// Expo Push Service.
//
// - Only service_role may run it (the pg_cron schedule, set up by the owner with a stored service
//   key). The platform verifies the JWT; this checks its role too, because the anon key is also a
//   valid JWT.
// - claim_notifications() leases due rows (concurrent runs never send one twice) and returns only
//   the recipient's locale and device tokens and the sender's public name - never subject or body.
// - The push text is localized here from the recipient's locale; the payload carries only the
//   letter id, so no letter content ever reaches Expo or the lock screen.
// - Every row is closed with complete_notification() (sent / retry with backoff / failed); tokens
//   Expo reports as DeviceNotRegistered are forgotten. A recipient with no device is closed as
//   sent-with-no-device (nothing to retry).
// Nothing about users or letters is logged.
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { pushText, type Locale } from './pushText.ts';

interface ClaimedRow {
  outbox_id: string;
  letter_id: string;
  type: 'letter_delivered';
  attempts: number;
  recipient_locale: Locale;
  sender_username: string | null;
  sender_display_name: string | null;
  push_tokens: string[];
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100; // Expo accepts up to 100 messages per request.

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The JWT's role claim (the signature is verified by the platform before this runs). */
function jwtRole(authorization: string | null): string | null {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.role === 'string' ? decoded.role : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { code: 'method_not_allowed' });
  if (jwtRole(req.headers.get('Authorization')) !== 'service_role') {
    return json(403, { code: 'forbidden' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { code: 'failed' });
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db.rpc('claim_notifications', { p_limit: 100 });
  if (error) return json(500, { code: 'claim_failed' });
  const rows = (data ?? []) as ClaimedRow[];

  // One message per (row, token); remember which row each message belongs to.
  const messages: { row: ClaimedRow; token: string }[] = [];
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.push_tokens.length === 0) {
      // No device: nothing to deliver and nothing to retry.
      await db.rpc('complete_notification', { p_outbox_id: row.outbox_id, p_ok: true });
      sent += 1;
      continue;
    }
    for (const token of row.push_tokens) messages.push({ row, token });
  }

  const outcome = new Map<string, { ok: boolean; ticket?: string; error?: string }>();
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    let tickets: ExpoTicket[] = [];
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          batch.map(({ row, token }) => ({
            to: token,
            ...pushText(row),
            data: { letter_id: row.letter_id },
            sound: 'default',
            channelId: 'letters',
          })),
        ),
      });
      const body = await response.json();
      tickets = Array.isArray(body?.data) ? body.data : [];
      if (!response.ok || tickets.length !== batch.length) throw new Error(`expo ${response.status}`);
    } catch (e) {
      for (const { row } of batch) {
        if (!outcome.get(row.outbox_id)?.ok) {
          outcome.set(row.outbox_id, { ok: false, error: e instanceof Error ? e.message : 'expo' });
        }
      }
      continue;
    }
    for (let j = 0; j < batch.length; j += 1) {
      const { row, token } = batch[j];
      const ticket = tickets[j];
      if (ticket?.status === 'ok') {
        outcome.set(row.outbox_id, { ok: true, ticket: ticket.id });
      } else {
        const code = ticket?.details?.error ?? ticket?.message ?? 'unknown';
        if (code === 'DeviceNotRegistered') {
          await db.rpc('forget_device_token', { p_push_token: token });
        }
        // Any token that succeeded wins; otherwise keep the (last) error for this row.
        if (!outcome.get(row.outbox_id)?.ok) outcome.set(row.outbox_id, { ok: false, error: code });
      }
    }
  }

  for (const [outboxId, result] of outcome) {
    await db.rpc('complete_notification', {
      p_outbox_id: outboxId,
      p_ok: result.ok,
      p_ticket_id: result.ticket ?? null,
      p_error: result.error ?? null,
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return json(200, { claimed: rows.length, sent, failed });
});
