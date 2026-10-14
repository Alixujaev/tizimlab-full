import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { notify } from '@/ui';
import { isAxiosError } from 'axios';
import { toApiError } from '@/api/client';
import i18n from '@/i18n';
import type { ApiError } from '@/types';

/**
 * 403 / FORBIDDEN holatida ma'lumotli xabar: qaysi resurs va amal ekanini aniqlab ko'rsatadi,
 * masalan "Namunalar ro'yxatini ko'rish uchun ruxsat yo'q" (uz/ru/en).
 */
export function resolveForbiddenMessage(error: unknown, apiError?: ApiError | null): string {
  let resource: string | undefined;
  let action: string | undefined;

  // 1. Backend error details ob'ektidan aniqlash ({ resource, action })
  if (apiError?.details && typeof apiError.details === 'object') {
    const details = apiError.details as Record<string, unknown>;
    if (typeof details.resource === 'string') resource = details.resource;
    if (typeof details.action === 'string') action = details.action;
  }

  // 2. Agar details bo'lmasa, Axios so'rov URL va metodidan aniqlash
  if ((!resource || !action) && isAxiosError(error) && error.config) {
    const url = error.config.url ?? '';
    const method = (error.config.method ?? 'get').toLowerCase();

    if (url.includes('/samples')) {
      if (url.includes('/assign')) {
        resource = 'samples';
        action = 'assign';
      } else if (method === 'post') {
        resource = 'samples';
        action = 'create';
      } else {
        resource = 'samples';
        action = 'view';
      }
    } else if (url.includes('/admin/users')) {
      if (method === 'get') {
        resource = 'users';
        action = 'view';
      } else {
        resource = 'users';
        action = 'manage';
      }
    } else if (url.includes('/registry')) {
      resource = 'registry';
      action = 'view';
    } else if (url.includes('/reagents')) {
      if (method === 'get') {
        resource = 'reagents';
        action = 'view';
      } else {
        resource = 'reagents';
        action = 'write';
      }
    } else if (url.includes('/substances')) {
      if (method === 'get') {
        resource = 'substances';
        action = 'view';
      } else {
        resource = 'substances';
        action = 'write';
      }
    } else if (url.includes('/protocols')) {
      if (url.includes('/finalize')) {
        resource = 'protocols';
        action = 'finalize';
      } else if (url.includes('/approve')) {
        resource = 'protocols';
        action = 'approve';
      } else {
        resource = 'protocols';
        action = 'upload';
      }
    } else if (url.includes('/temperature')) {
      resource = 'temperature';
      action = 'view';
    }
  }

  if (resource && action) {
    const actionKey = action.charAt(0).toUpperCase() + action.slice(1);
    const specificKey = `errors.forbidden.${resource}${actionKey}`;
    if (i18n.exists(specificKey)) return i18n.t(specificKey);
    const snakeKey = `errors.forbidden.${resource}_${action}`;
    if (i18n.exists(snakeKey)) return i18n.t(snakeKey);
  }

  return i18n.t('errors.forbidden.default');
}

/**
 * Xato xabari: 403 da ma'lumotli resurs/amal xabari,
 * avval `errors.codes.<CODE>` tarjimasi (joriy tilda), bo'lmasa server xabari (D-22),
 * u ham bo'lmasa umumiy xabar.
 */
export function errorMessage(error: unknown): string {
  const apiError = toApiError(error);
  const status = isAxiosError(error) ? error.response?.status : undefined;

  if (status === 403 || apiError?.code === 'FORBIDDEN') {
    return resolveForbiddenMessage(error, apiError);
  }

  if (!apiError) return i18n.t('errors.generic');
  const key = `errors.codes.${apiError.code}`;
  return i18n.exists(key) ? i18n.t(key) : apiError.message;
}

// 4xx — mijoz xatosi, qayta urinish foydasiz (401 ni axios interceptor hal qiladi)
const isClientError = (error: unknown) =>
  isAxiosError(error) && !!error.response && error.response.status < 500;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    // Sahifa yuklanishida avtomatik so'rovlar toast chiqarmasin, faqat foydalanuvchi bosgan amal xatosi chiqsin
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.showToast) {
          notify.error(errorMessage(error));
        }
      },
    }),
    // `meta.silentError` — xatoni komponentning o'zi ko'rsatadi (masalan, login formasi)
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.silentError) return;
        notify.error(errorMessage(error));
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
