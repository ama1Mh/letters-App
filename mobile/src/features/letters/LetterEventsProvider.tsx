import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getLettersRepository, type LetterEvent } from '@/data/letters/lettersRepository';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Why listeners are told to refresh:
 * - `event`: one or more letter events arrived (merged if they came in a burst);
 * - `subscribed`: the channel (re)joined, e.g. after a reconnect; events may have been missed;
 * - `foreground`: the app came back to the foreground; the socket may have been asleep.
 * Listeners refetch through the normal RLS-checked reads in every case, so a refresh is always
 * safe to repeat: a duplicate or reordered event can at worst cause one extra reload.
 */
export type LetterRefreshReason = 'event' | 'subscribed' | 'foreground';
export type LetterEventsListener = (reason: LetterRefreshReason, events: LetterEvent[]) => void;

/** Events arriving within this window are delivered to listeners as one refresh. */
export const LETTER_EVENTS_COALESCE_MS = 300;
/** How many recent Realtime message ids are remembered to drop duplicates. */
const SEEN_MESSAGE_IDS = 100;

interface LetterEventsContextValue {
  addListener: (listener: LetterEventsListener) => () => void;
}

const LetterEventsContext = createContext<LetterEventsContextValue | null>(null);

/**
 * Joins the private Realtime topic `letters:<my id>` while signed in and onboarded (DEC-045 (3),
 * DEC-048 M7) and fans refresh signals out to the screens that registered via useLetterEvents().
 */
export function LetterEventsProvider({ children }: { children: ReactNode }) {
  const { status, profile } = useAuth();
  const userId = status === 'ready' ? (profile?.id ?? null) : null;

  const listeners = useRef(new Set<LetterEventsListener>());
  const seen = useRef<string[]>([]);
  const pending = useRef<LetterEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((reason: LetterRefreshReason, events: LetterEvent[]) => {
    for (const listener of [...listeners.current]) listener(reason, events);
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    const unsubscribe = getLettersRepository().subscribeToLetterEvents(userId, {
      onEvent(event) {
        if (event.messageId) {
          if (seen.current.includes(event.messageId)) return;
          seen.current = [...seen.current.slice(-(SEEN_MESSAGE_IDS - 1)), event.messageId];
        }
        pending.current.push(event);
        if (timer.current) return;
        timer.current = setTimeout(() => {
          timer.current = null;
          const events = pending.current;
          pending.current = [];
          notify('event', events);
        }, LETTER_EVENTS_COALESCE_MS);
      },
      onSubscribed() {
        notify('subscribed', []);
      },
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = [];
      seen.current = [];
    };
  }, [userId, notify]);

  useEffect(() => {
    if (!userId) return undefined;
    let previous: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (previous !== 'active' && next === 'active') notify('foreground', []);
      previous = next;
    });
    return () => subscription.remove();
  }, [userId, notify]);

  const value = useMemo<LetterEventsContextValue>(
    () => ({
      addListener(listener) {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    [],
  );

  return <LetterEventsContext.Provider value={value}>{children}</LetterEventsContext.Provider>;
}

/** Calls `listener` on every refresh signal while the calling component is mounted. */
export function useLetterEvents(listener: LetterEventsListener): void {
  const context = useContext(LetterEventsContext);
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => {
    if (!context) return undefined;
    return context.addListener((reason, events) => latest.current(reason, events));
  }, [context]);
}
