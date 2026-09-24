import { useCallback, useEffect, useState } from 'react';

import { getDraftsRepository } from '@/data/letters/draftsRepository';
import type { LocalDraft } from '@/data/local/draftsStore';

export interface UseDraftsResult {
  drafts: LocalDraft[];
  loading: boolean;
  /** Re-syncs (best effort) and re-reads the local list. Call again after any change made
   *  elsewhere (create, edit, delete): this hook does not subscribe to store changes itself. */
  refresh: () => Promise<void>;
}

export function useDrafts(): UseDraftsResult {
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const repo = getDraftsRepository();
    try {
      await repo.sync();
    } catch {
      // Offline, or the sync failed outright: fall through to whatever is stored locally.
    }
    setDrafts(await repo.list());
  }, []);

  useEffect(() => {
    // `loading` already starts true; refresh() is stable (useCallback with no deps), so this only
    // ever runs once. Wrapped in its own async IIFE, not called directly, the same as
    // AuthProvider.tsx's mount effect (react-hooks/set-state-in-effect).
    void (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  return { drafts, loading, refresh };
}
