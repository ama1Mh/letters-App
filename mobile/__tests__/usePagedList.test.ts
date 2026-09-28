import { act, renderHook } from '@testing-library/react-native';

import { LetterActionError, type ListCursor, type Page } from '@/data/letters/lettersRepository';
import { usePagedList } from '@/features/letters/usePagedList';

interface Row {
  id: string;
}

const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id }));
const cursorAt = (id: string): ListCursor => ({ at: `t-${id}`, id });

/** A loader whose calls resolve only when the test says so, in any order. */
function controlledLoader() {
  const calls: {
    cursor: ListCursor | null;
    resolve: (page: Page<Row>) => void;
    reject: (e: unknown) => void;
  }[] = [];
  const load = jest.fn(
    (cursor: ListCursor | null) =>
      new Promise<Page<Row>>((resolve, reject) => {
        calls.push({ cursor, resolve, reject });
      }),
  );
  return { load, calls };
}

describe('usePagedList', () => {
  it('loads the first page, then appends the next one using the cursor', async () => {
    const { load, calls } = controlledLoader();
    const { result } = await renderHook(() => usePagedList(load));
    expect(result.current.loading).toBe(true);

    await act(async () => {
      const done = result.current.reload();
      calls[0].resolve({ items: rows('a', 'b'), nextCursor: cursorAt('b') });
      await done;
    });
    expect(calls[0].cursor).toBeNull();
    expect(result.current.items.map((r) => r.id)).toEqual(['a', 'b']);
    expect(result.current.loading).toBe(false);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      const done = result.current.loadMore();
      // A row repeated across pages (e.g. a new letter shifted the list) is not shown twice.
      calls[1].resolve({ items: rows('b', 'c'), nextCursor: null });
      await done;
    });
    expect(calls[1].cursor).toEqual(cursorAt('b'));
    expect(result.current.items.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.hasMore).toBe(false);

    // Nothing more: loadMore does not call the loader again.
    await act(async () => {
      await result.current.loadMore();
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reports a failed load as a translated code and clears it on the next success', async () => {
    const { load, calls } = controlledLoader();
    const { result } = await renderHook(() => usePagedList(load));

    await act(async () => {
      const done = result.current.reload();
      calls[0].reject(new LetterActionError('rate_limited'));
      await done;
    });
    expect(result.current.error).toBe('rate_limited');
    expect(result.current.loading).toBe(false);

    await act(async () => {
      const done = result.current.reload();
      calls[1].reject(new TypeError('Network request failed'));
      await done;
    });
    expect(result.current.error).toBe('unknown');

    await act(async () => {
      const done = result.current.reload();
      calls[2].resolve({ items: rows('a'), nextCursor: null });
      await done;
    });
    expect(result.current.error).toBeNull();
    expect(result.current.items).toEqual(rows('a'));
  });

  it('ignores a slower, superseded reload so it cannot overwrite a newer one', async () => {
    const { load, calls } = controlledLoader();
    const { result } = await renderHook(() => usePagedList(load));

    await act(async () => {
      const first = result.current.reload();
      const second = result.current.reload();
      calls[1].resolve({ items: rows('new'), nextCursor: null });
      await second;
      calls[0].resolve({ items: rows('old'), nextCursor: cursorAt('old') });
      await first;
    });
    expect(result.current.items).toEqual(rows('new'));
    expect(result.current.hasMore).toBe(false);
  });

  it('shows the pull-to-refresh spinner only for a pull reload', async () => {
    const { load, calls } = controlledLoader();
    const { result } = await renderHook(() => usePagedList(load));

    let done: Promise<void> = Promise.resolve();
    await act(async () => {
      done = result.current.reload({ pull: true });
    });
    expect(result.current.refreshing).toBe(true);
    await act(async () => {
      calls[0].resolve({ items: [], nextCursor: null });
      await done;
    });
    expect(result.current.refreshing).toBe(false);
  });

  it('removes one item locally without reloading', async () => {
    const { load, calls } = controlledLoader();
    const { result } = await renderHook(() => usePagedList(load));
    await act(async () => {
      const done = result.current.reload();
      calls[0].resolve({ items: rows('a', 'b', 'c'), nextCursor: null });
      await done;
    });

    await act(async () => {
      result.current.removeItem('b');
    });
    expect(result.current.items).toEqual(rows('a', 'c'));
    expect(load).toHaveBeenCalledTimes(1);
  });
});
