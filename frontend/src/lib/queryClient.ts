import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { toApiError } from '@/api/client';
import i18n from '@/i18n';

/**
 * Xato xabari: avval `errors.codes.<CODE>` tarjimasi (joriy tilda), bo'lmasa server xabari (D-22),
 * u ham bo'lmasa umumiy xabar.
 */
export function errorMessage(error: unknown): string {
  const apiError = toApiError(error);
  if (!apiError) return i18n.t('errors.generic');
  const key = `errors.codes.${apiError.code}`;
  return i18n.exists(key) ? i18n.t(key) : apiError.message;
}

// 4xx — mijoz xatosi, qayta urinish foydasiz (401 ni axios interceptor hal qiladi)
const isClientError = (error: unknown) =>
  isAxiosError(error) && !!error.response && error.response.status < 500;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: (error) => toast.error(errorMessage(error)) }),
    // `meta.silentError` — xatoni komponentning o'zi ko'rsatadi (masalan, login formasi)
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.silentError) return;
        toast.error(errorMessage(error));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => !isClientError(error) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}
