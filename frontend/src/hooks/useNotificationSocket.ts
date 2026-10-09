import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { refreshAccessToken } from '@/api/client';
import { connectSocket, disconnectSocket, NOTIFICATION_EVENT } from '@/lib/socket';
import { notificationTitle } from '@/lib/notifications';
import { useAuthStore } from '@/store/authStore';
import type { NotificationDto, Paginated } from '@/types';
import { dashboardKeys } from './useDashboard';
import { notificationsKeys } from './useNotifications';

/**
 * Socket.IO ulanishi va real vaqtli yangilash (R-FE-05, spec §9): `notification:new` React Query
 * keshiga yoziladi (sahifa yangilanmasdan) va toast ko'rsatiladi. Faqat kompaniya foydalanuvchilari uchun.
 */
export function useNotificationSocket(): void {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  // Til almashganda qayta ulanmaslik uchun tarjima funksiyasi ref orqali
  const tRef = useRef(t);
  tRef.current = t;
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasCompany = useAuthStore((s) => !!s.user?.companyId);
  const connected = !!accessToken && hasCompany;

  // Ulanish faqat sessiya boshida/oxirida o'zgaradi; token yangilanishi alohida effektda
  useEffect(() => {
    if (!connected) return;
    const socket = connectSocket(useAuthStore.getState().accessToken!);

    const onNotification = (n: NotificationDto) => {
      queryClient.setQueryData<number>(notificationsKeys.unreadCount(), (c) => (c ?? 0) + 1);
      // Birinchi sahifadagi ro'yxatlarga yangi yozuv boshiga qo'shiladi
      queryClient.setQueriesData<Paginated<NotificationDto>>(
        { queryKey: notificationsKeys.lists() },
        (old) =>
          old && (old.meta.page ?? 1) === 1
            ? {
                ...old,
                data: [n, ...old.data.filter((x) => x.id !== n.id)].slice(0, old.meta.limit),
                meta: { ...old.meta, total: old.meta.total + 1 },
              }
            : old,
      );
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      toast(notificationTitle(tRef.current, n), { description: n.message });
    };

    // Muddati o'tgan token bilan qayta ulanish rad etilsa — token yangilanib, bir marta qayta uriniladi
    const onConnectError = (err: Error) => {
      if (err.message !== 'UNAUTHORIZED' && err.message !== 'SESSION_EXPIRED') return;
      refreshAccessToken()
        .then((token) => {
          socket.auth = { token };
          socket.connect();
        })
        .catch(() => undefined);
    };

    socket.on(NOTIFICATION_EVENT, onNotification);
    socket.on('connect_error', onConnectError);
    return () => {
      socket.off(NOTIFICATION_EVENT, onNotification);
      socket.off('connect_error', onConnectError);
      disconnectSocket();
    };
  }, [connected, queryClient]);

  useEffect(() => {
    if (connected && accessToken) connectSocket(accessToken);
  }, [connected, accessToken]);
}
