'use client';

import type { UserProfile } from '@finance/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  authApi,
  setRefreshHandler,
  setTokenGetter,
  setUnauthorizedCallback,
} from '@/shared/lib/api';
import { makeQueryClient } from '@/shared/lib/query/client';
import { useAuthStore } from '@/shared/stores/auth-store';

/**
 * Owns the session and the React Query cache together, because the two must be
 * torn down as one unit.
 *
 * What this fixes:
 *  - the access token never touches `localStorage`; on load we trade the
 *    HttpOnly refresh cookie for a fresh one exactly once;
 *  - `status` starts as `unknown`, so guards can wait instead of flashing
 *    protected content or firing requests before the session is known;
 *  - on logout / hard 401 / user switch we `cancelQueries` then `clear()` the
 *    cache, so the next user cannot see a frame of the previous user's data
 *    (the old code kept a module-singleton client with user-agnostic keys).
 */

interface SessionContextValue {
  status: 'unknown' | 'authenticated' | 'anonymous';
  user: UserProfile | null;
  sessionKey: string;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (email: string, password: string, name?: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Double-submit CSRF value, readable by JS by design; the session cookie is not. */
function readCsrfCookie(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [queryClient, setQueryClient] = useState<QueryClient>(() => makeQueryClient());
  const router = useRouter();
  const bootstrapped = useRef(false);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const sessionKey = useAuthStore((s) => s.sessionKey);

  /** Drops every cached byte belonging to the outgoing session. */
  const resetCache = useCallback(
    async (client: QueryClient) => {
      await client.cancelQueries();
      client.clear();
    },
    [],
  );

  const applySession = useCallback(
    async (accessToken: string, profile: UserProfile) => {
      const previous = useAuthStore.getState().user?.id;
      if (previous && previous !== profile.id) {
        // Different human at the same browser: burn the cache and the client.
        await resetCache(queryClient);
        setQueryClient(makeQueryClient());
      }
      useAuthStore.getState().setSession(accessToken, profile);
    },
    [queryClient, resetCache],
  );

  const clearSession = useCallback(async () => {
    await resetCache(queryClient);
    setQueryClient(makeQueryClient());
    useAuthStore.getState().setAnonymous();
  }, [queryClient, resetCache]);

  // --- wire the API client to the store, once ------------------------------
  useEffect(() => {
    setTokenGetter(() => useAuthStore.getState().accessToken);

    setRefreshHandler(async () => {
      if (refreshInFlight.current) return refreshInFlight.current;
      refreshInFlight.current = (async () => {
        try {
          const session = await authApi.refresh(readCsrfCookie());
          await applySession(session.accessToken, session.user);
          return session.accessToken;
        } catch {
          return null;
        } finally {
          refreshInFlight.current = null;
        }
      })();
      return refreshInFlight.current;
    });

    setUnauthorizedCallback(async () => {
      await clearSession();
      router.replace('/login');
    });
  }, [applySession, clearSession, router]);

  // --- one silent refresh on first load ------------------------------------
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    let cancelled = false;
    (async () => {
      try {
        const session = await authApi.refresh(readCsrfCookie());
        if (!cancelled) await applySession(session.accessToken, session.user);
      } catch (error) {
        // A 401 here just means "no valid cookie" — the normal anonymous path.
        if (!cancelled && !(error instanceof ApiError && error.statusCode === 401)) {
          console.warn('Falha ao restaurar a sessão:', error);
        }
        if (!cancelled) useAuthStore.getState().setAnonymous();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.login({ email, password });
      await applySession(session.accessToken, session.user);
      return session.user;
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const session = await authApi.register({ email, password, name });
      await applySession(session.accessToken, session.user);
      return session.user;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The local session must go away even if the server call fails.
    }
    await clearSession();
    router.replace('/login');
  }, [clearSession, router]);

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, sessionKey, login, register, logout }),
    [status, user, sessionKey, login, register, logout],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
    </QueryClientProvider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>.');
  return ctx;
}

/** The cache-namespacing key every query must start with. */
export function useSessionKey(): string {
  return useSession().sessionKey;
}
