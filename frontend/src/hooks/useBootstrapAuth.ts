import { useEffect } from 'react';
import { fetchMe } from '@/api/auth';
import { refreshAccessToken } from '@/api/client';
import { useAuthStore } from '@/store/authStore';

/** Refresh cookie → access token → `/auth/me`. Xatoda store tozalanadi (`anonymous`). */
export async function restoreSession(): Promise<void> {
  try {
    const accessToken = await refreshAccessToken();
    const user = await fetchMe();
    useAuthStore.getState().setSession({ user, accessToken });
  } catch {
    useAuthStore.getState().clear();
  }
}

/**
 * D-23: sahifa yangilanganda sessiya refresh cookie orqali tiklanadi.
 * Muvaffaqiyat → `authenticated`, aks holda → `anonymous`.
 */
export function useBootstrapAuth(): void {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status !== 'unknown') return;
    void restoreSession();
  }, [status]);
}
