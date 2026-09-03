import type { UserProfile } from '@finance/contracts';
import { create } from 'zustand';

/**
 * Session state.
 *
 * The access token is held **in memory only** — deliberately not in
 * `localStorage`, where any injected script can read it and where it survives
 * long past its usefulness. Durable session state lives in the `refresh_token`
 * HttpOnly cookie that JavaScript cannot touch; on a page load the app calls
 * `POST /auth/refresh` once to trade that cookie for a fresh access token.
 *
 * `status` exists so route guards can distinguish "not logged in" from
 * "we have not asked yet", which is what removes the flash of protected
 * content and the burst of requests fired before the session is known.
 */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  status: SessionStatus;
  accessToken: string | null;
  user: UserProfile | null;
  /** Bumped on every login/logout; used to namespace the React Query cache. */
  sessionKey: string;

  setSession: (token: string, user: UserProfile) => void;
  setAnonymous: () => void;
  updateUser: (user: UserProfile) => void;
}

export const ANONYMOUS_SESSION_KEY = 'anonymous';

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  accessToken: null,
  user: null,
  sessionKey: ANONYMOUS_SESSION_KEY,

  setSession: (accessToken, user) => set({ status: 'authenticated', accessToken, user, sessionKey: user.id }),

  setAnonymous: () => set({ status: 'anonymous', accessToken: null, user: null, sessionKey: ANONYMOUS_SESSION_KEY }),

  updateUser: (user) => set((state) => (state.user ? { ...state, user } : state)),
}));

/** Non-reactive read, for the API client and other non-React callers. */
export const authSnapshot = () => useAuthStore.getState();
