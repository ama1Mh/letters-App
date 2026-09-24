/**
 * Local offline draft storage (PLAN §4.3): `local_drafts(id, subject, body, design, recipient_id,
 * dirty, updated_at)`, synced to `letters` (status='draft') when online, last-write-wins by
 * `updatedAt`. The store is injected - the same pattern as encryptedStorage.ts's BlobStore/KeyStore
 * - so drafts logic is unit-tested without expo-sqlite; the real implementation is in
 * nativeDraftsStore.ts and is untested at this level (same as nativeStores.ts), verified instead on
 * a device.
 */
export interface LocalDraft {
  id: string;
  subject: string | null;
  body: string;
  /** Computed on save (mobile/src/domain/bodyDirection.ts), not re-derived here (DEC-014, PLAN
   *  §3.5): a letter's direction is independent of either side's UI language. */
  bodyDir: 'ltr' | 'rtl';
  /** Versioned design JSON (PLAN §3.4). Opaque here; validated once Phase 4's design-catalog.json
   *  and its zod schema exist. */
  design: unknown;
  recipientId: string | null;
  /** True until this draft's current state has been pushed to `letters`. */
  dirty: boolean;
  /** ISO 8601. The sync's last-write-wins comparison key. */
  updatedAt: string;
}

export interface LocalDraftsStore {
  list(): Promise<LocalDraft[]>;
  get(id: string): Promise<LocalDraft | null>;
  upsert(draft: LocalDraft): Promise<void>;
  remove(id: string): Promise<void>;
}
