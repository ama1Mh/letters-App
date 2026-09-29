// Localized push text (pure: no Deno or network imports, so the app's Jest suite tests it too,
// mobile/__tests__/push-text.test.ts). The Arabic lines are drafts listed in docs/ARABIC_REVIEW.md.

export type Locale = 'en' | 'ar';

export interface PushSender {
  recipient_locale: Locale;
  sender_username: string | null;
  sender_display_name: string | null;
}

// Unicode isolates: a display name in either script, and an always-LTR @username, cannot reorder
// the surrounding sentence (the Arabic line is RTL; a Latin name there would otherwise pull the
// parentheses around).
const FSI = '⁨'; // first strong isolate: the name keeps its own direction
const LRI = '⁦'; // left-to-right isolate: @username (CLAUDE.md)
const PDI = '⁩';

/** The name is the sender's public name; `@username` keeps look-alikes apart (display names are
 *  not unique). A deleted sender (no username) gets a neutral line. */
export function pushText(row: PushSender): { title: string; body: string } {
  const name = row.sender_username
    ? `${FSI}${row.sender_display_name ?? row.sender_username}${PDI} (${LRI}@${row.sender_username}${PDI})`
    : null;
  if (row.recipient_locale === 'ar') {
    return {
      title: 'رسالة جديدة',
      body: name ? `لديك رسالة جديدة من ${name}` : 'لديك رسالة جديدة',
    };
  }
  return {
    title: 'New letter',
    body: name ? `You have a new letter from ${name}` : 'You have a new letter',
  };
}
