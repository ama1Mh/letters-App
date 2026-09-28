import { useCallback, useRef, useState } from 'react';

import type { ListCursor, Page } from '@/data/letters/lettersRepository';

import { letterErrorKey, type TranslatedLetterError } from './letterErrors';

export interface PagedList<T> {
  items: T[];
  /** True until the first page has loaded (or failed) once. */
  loading: boolean;
  /** True while a pull-to-refresh reload is running. */
  refreshing: boolean;
  /** True while a next page is loading. */
  loadingMore: boolean;
  /** The last load failure (first page or next page); cleared by the next successful load. */
  error: TranslatedLetterError | 'unknown' | null;
  hasMore: boolean;
  /** Reloads from the first page. `pull` shows the pull-to-refresh spinner. */
  reload: (options?: { pull?: boolean }) => Promise<void>;
  /** Appends the next page; a no-op while another load runs or when there is nothing more. */
  loadMore: () => Promise<void>;
  /** Drops one item locally (e.g. after unscheduling it), without a reload. */
  removeItem: (id: string) => void;
}

/**
 * Keyset-paged server list (DEC-048 (D4): plain hooks, no query cache). The caller decides when to
 * load: typically reload() on screen focus. Responses from a superseded reload (e.g. the user
 * switched Scheduled/Sent mid-request) are ignored, so a slow old page never overwrites a new one.
 */
export function usePagedList<T extends { id: string }>(
  loadPage: (cursor: ListCursor | null) => Promise<Page<T>>,
): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<TranslatedLetterError | 'unknown' | null>(null);
  const [cursor, setCursor] = useState<ListCursor | null>(null);

  // Bumped by every reload; a response only applies if its generation is still current.
  const generation = useRef(0);
  const busyMore = useRef(false);

  const reload = useCallback(
    async (options: { pull?: boolean } = {}) => {
      generation.current += 1;
      const mine = generation.current;
      if (options.pull) setRefreshing(true);
      try {
        const page = await loadPage(null);
        if (mine !== generation.current) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setError(null);
      } catch (e) {
        if (mine !== generation.current) return;
        setError(letterErrorKey(e));
      } finally {
        if (mine === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [loadPage],
  );

  const loadMore = useCallback(async () => {
    if (busyMore.current || cursor === null) return;
    busyMore.current = true;
    const mine = generation.current;
    setLoadingMore(true);
    try {
      const page = await loadPage(cursor);
      if (mine !== generation.current) return;
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setCursor(page.nextCursor);
      setError(null);
    } catch (e) {
      if (mine === generation.current) setError(letterErrorKey(e));
    } finally {
      busyMore.current = false;
      setLoadingMore(false);
    }
  }, [cursor, loadPage]);

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: cursor !== null,
    reload,
    loadMore,
    removeItem,
  };
}
