/**
 * Auth/profile state for the whole app. Wraps the `AuthRepository` (Supabase by default, a fake in
 * tests) and exposes a single `status` the router gate (`app/index.tsx`) branches on:
 *   loading         - session not checked yet; render nothing.
 *   signedOut        - no session; show (auth)/sign-in.
 *   needsOnboarding - session but `complete_onboarding()` never ran; show (auth)/onboarding.
 *   ready            - onboarded; show the (tabs) shell.
 *
 * Screens that change auth state themselves (sign in/up, complete onboarding) call `refresh()`
 * afterwards rather than relying on `subscribe`'s timing, so the transition is deterministic;
 * `subscribe` still exists to pick up changes from elsewhere (token refresh, sign-out).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  getAuthRepository,
  type AuthRepository,
  type AuthSession,
  type OwnProfile,
} from '@/data/supabase/auth';

export type AuthStatus = 'loading' | 'signedOut' | 'needsOnboarding' | 'ready';

export interface AuthContextValue {
  status: AuthStatus;
  profile: OwnProfile | null;
  repository: AuthRepository;
  /** Re-reads the session and profile from scratch. Call after an action that changes them. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  /** Tests inject a fake; the app never passes this, so it always gets the real repository. */
  repository?: AuthRepository;
}

export function AuthProvider({ children, repository }: AuthProviderProps) {
  const repo = repository ?? getAuthRepository();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);

  const applySession = useCallback(
    async (session: AuthSession | null) => {
      sessionRef.current = session;
      if (!session) {
        setProfile(null);
        setStatus('signedOut');
        return;
      }
      const p = await repo.getOwnProfile(session.userId);
      setProfile(p);
      setStatus(p?.onboardedAt ? 'ready' : 'needsOnboarding');
    },
    [repo],
  );

  const refresh = useCallback(async () => {
    await applySession(await repo.getSession());
  }, [repo, applySession]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await repo.getSession();
      if (!cancelled) await applySession(session);
    })();
    const unsubscribe = repo.subscribe((session) => {
      void applySession(session);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [repo, applySession]);

  const signOut = useCallback(async () => {
    await repo.signOut();
  }, [repo]);

  return (
    <AuthContext.Provider value={{ status, profile, repository: repo, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within <AuthProvider>.');
  return ctx;
}
