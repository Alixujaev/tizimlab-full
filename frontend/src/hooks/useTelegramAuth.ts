import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { webAppAuth } from '@/api/telegram';
import {
  canRoleAccessPath,
  getTelegramInitData,
  isTelegramWebApp,
  parseStartParam,
  telegramExpand,
  telegramReady,
} from '@/lib/telegram';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

export type TelegramAuthState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'unlinked'
  | 'expired'
  | 'network_error';

export interface UseTelegramAuthResult {
  state: TelegramAuthState;
  errorMessage: string | null;
  retry: () => void;
}

/**
 * Telegram WebApp avto-kirish hook'i (P14, D-166).
 * initData va tokenlar hech qachon logga yoki URL ga chiqarilmaydi.
 */
export function useTelegramAuth(): UseTelegramAuthResult {
  const [state, setState] = useState<TelegramAuthState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const authStatus = useAuthStore((s) => s.status);
  const navigate = useNavigate();

  const performAuth = useCallback(async () => {
    if (!isTelegramWebApp()) return;
    if (authStatus === 'authenticated') {
      setState('success');
      return;
    }

    telegramReady();
    telegramExpand();

    const initData = getTelegramInitData();
    if (!initData) {
      setState('unlinked');
      setErrorMessage("Telegram avtorizatsiya ma'lumotlari topilmadi");
      return;
    }

    setState('loading');
    setErrorMessage(null);

    try {
      const res = await webAppAuth(initData);
      const user = res.user as User;

      // D-23: Access token faqat xotirada
      useAuthStore.getState().setSession({
        user,
        accessToken: res.accessToken,
      });

      setState('success');

      // Deep link yo'naltirish (startParam)
      const target = parseStartParam();
      if (target && canRoleAccessPath(user.role, target.path)) {
        void navigate(target.path, { replace: true });
      }
    } catch (err: unknown) {
      const apiErr = err as {
        response?: { data?: { error?: { code?: string; message?: string } }; status?: number };
        message?: string;
      };

      const msg = apiErr.response?.data?.error?.message || apiErr.message || '';
      const status = apiErr.response?.status;

      if (!status) {
        // Tarmoq xatosi (offline yoki server ulanmadi)
        setState('network_error');
        setErrorMessage(msg);
      } else if (msg.includes('ulanmagan') || msg.includes('profilga')) {
        // Bog'lanmagan Telegram hisob
        setState('unlinked');
        setErrorMessage(msg);
      } else if (
        msg.includes('eskirgan') ||
        msg.includes("muddati o'tgan") ||
        msg.includes('replay') ||
        msg.includes('allaqachon')
      ) {
        // Eskirgan yoki qayta ishlatilgan initData
        setState('expired');
        setErrorMessage(msg);
      } else {
        // Umumiy avtorizatsiya xatosi
        setState('unlinked');
        setErrorMessage(msg);
      }
    }
  }, [authStatus, navigate]);

  useEffect(() => {
    if (!isTelegramWebApp()) return;
    if (state === 'idle') {
      void performAuth();
    }
  }, [performAuth, state]);

  return {
    state,
    errorMessage,
    retry: performAuth,
  };
}
