import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';

import { getDiscoveryRepository } from '@/data/discovery/discoveryRepository';
import type { Correspondent } from '@/data/letters/lettersRepository';

/**
 * The composer names a draft's recipient (owner request 2026-10-04, replacing DEC-043 (3)'s generic
 * "Recipient selected"). Drafts store only `recipient_id`, and the profiles RLS policies hide an
 * `everyone`-mode recipient I am not connected to, so the picker remembers the card it showed (the
 * public username, display name and avatar the search already returned) on this device. A draft
 * without a remembered card (made on another device) falls back to `profiles`, which works for
 * connections; anything else keeps the generic label. Cleared on sign-out and account deletion.
 */
const KEY = 'compose.recipientCards';
/** Only recent picks matter; old cards are dropped first. */
const MAX_CARDS = 50;

type Cards = Record<string, Omit<Correspondent, 'id'>>;

function readCards(): Cards {
  try {
    const raw = Storage.getItemSync(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed !== null && typeof parsed === 'object' ? (parsed as Cards) : {};
  } catch {
    return {};
  }
}

export function rememberRecipient(card: Correspondent): void {
  try {
    const { id, ...rest } = card;
    const cards = readCards();
    delete cards[id]; // re-inserted last, so the newest pick survives trimming
    cards[id] = rest;
    const ids = Object.keys(cards);
    for (const old of ids.slice(0, Math.max(0, ids.length - MAX_CARDS))) delete cards[old];
    Storage.setItemSync(KEY, JSON.stringify(cards));
  } catch {
    // A label only; the draft itself is saved regardless.
  }
}

export function recallRecipient(id: string): Correspondent | null {
  const card = readCards()[id];
  return card ? { id, ...card } : null;
}

export function forgetRecipients(): void {
  try {
    Storage.removeItemSync(KEY);
  } catch {
    // Nothing stored.
  }
}

/** The card for `recipientId`: remembered, else looked up (and then remembered), else null. */
export function useRecipientCard(recipientId: string | null): Correspondent | null {
  const [fetched, setFetched] = useState<Correspondent | null>(null);
  const remembered = recipientId ? recallRecipient(recipientId) : null;

  useEffect(() => {
    if (!recipientId || recallRecipient(recipientId)) return;
    let cancelled = false;
    void getDiscoveryRepository()
      .getProfileCard(recipientId)
      .then((card) => {
        if (cancelled || !card) return;
        rememberRecipient(card);
        setFetched(card);
      });
    return () => {
      cancelled = true;
    };
  }, [recipientId]);

  return remembered ?? (fetched?.id === recipientId ? fetched : null);
}
