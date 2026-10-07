import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { toApiError } from '@/api/client';
import i18n from '@/i18n';

/** Server xato xabari (D-22) yoki umumiy tarjima qilingan xabar. */
export function errorMessage(error: unknown): string {
  return toApiError(error)?.message ?? i18n.t('errors.generic');
}

// 4xx — mijoz xatosi, qayta urinish foydasiz (401 ni axios interceptor hal qiladi)
const isClientError = (error: unknown) =>
  isAxiosError(error) && !!error.response && error.response.status < 500;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: (error) => toast.error(errorMessage(error)) }),
    mutationCache: new MutationCache({ onError: (error) => toast.error(errorMessage(error)) }),
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
