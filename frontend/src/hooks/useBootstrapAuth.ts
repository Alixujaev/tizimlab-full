import { useEffect } from 'react';
import { refreshAccessToken } from '@/api/client';
import { useAuthStore } from '@/store/authStore';

/**
 * D-23: sahifa yangilanganda sessiya refresh cookie orqali tiklanadi.
 * Muvaffaqiyat → `authenticated`, aks holda → `anonymous`.
 */
export function useBootstrapAuth(): void {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status !== 'unknown') return;
    refreshAccessToken().catch(() => useAuthStore.getState().clear());
  }, [status]);
}
