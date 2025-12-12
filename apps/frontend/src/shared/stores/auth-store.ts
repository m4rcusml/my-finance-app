import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type User = {
  id?: string;
  email: string;
  name?: string | null;
};

type AuthState = {
  accessToken: string | null;
  user: User | null;
  setAuth: (token: string, user?: User | null) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: (token, user) => set({ accessToken: token, user: user ?? null }),
      clearAuth: () => set({ accessToken: null, user: null }),
    }),
    {
      name: "finance-auth",
    }
  )
);
