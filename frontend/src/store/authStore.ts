import { create } from 'zustand';
import type { User } from '@/types';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  user: User | null;
  /** D-23: access token faqat xotirada — localStorage'ga yozilmaydi. */
  accessToken: string | null;
  status: AuthStatus;
  setSession: (session: { user: User; accessToken: string }) => void;
  setUser: (user: User) => void;
  setAccessToken: (accessToken: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  status: 'unknown',
  setSession: ({ user, accessToken }) => set({ user, accessToken, status: 'authenticated' }),
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clear: () => set({ user: null, accessToken: null, status: 'anonymous' }),
}));
