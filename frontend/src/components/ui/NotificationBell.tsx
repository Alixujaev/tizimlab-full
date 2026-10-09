import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  BELL_LIST_PARAMS,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsQuery,
  useUnreadCountQuery,
} from '@/hooks/useNotifications';
import { formatDate } from '@/lib/date';
import { notificationLink, notificationTitle } from '@/lib/notifications';
import type { NotificationDto } from '@/types';

/** Bell: o'qilmaganlar soni, oxirgi xabarnomalar, o'qildi belgisi (spec §9, D-59). */
export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCountQuery().data ?? 0;
  const list = useNotificationsQuery(BELL_LIST_PARAMS, open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = list.data?.data ?? [];

  const onItem = (n: NotificationDto) => {
    if (!n.isRead) markRead.mutate(n.id);
    const link = notificationLink(n);
    if (link) {
      setOpen(false);
      void navigate(link);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t('topbar.notifications')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0" />
        </svg>
        {unread > 0 && (
          <span
            data-testid="notification-badge"
            aria-label={t('notifications.unreadCount', { n: unread })}
            className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-rose-600 px-1 text-center text-xs leading-5 font-semibold text-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <span className="text-sm font-semibold text-slate-800">
              {t('topbar.notifications')}
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-xs text-blue-600 hover:underline disabled:opacity-60"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              {list.isLoading ? t('common.loading') : t('topbar.noNotifications')}
            </p>
          ) : (
            <ul
              aria-label={t('topbar.notifications')}
              className="max-h-96 divide-y divide-slate-100 overflow-y-auto"
            >
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItem(n)}
                    className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${n.isRead ? '' : 'bg-blue-50/60'}`}
                  >
                    <span className="flex items-start gap-2">
                      {!n.isRead && (
                        <span
                          aria-label={t('notifications.unread')}
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800">
                          {notificationTitle(t, n)}
                        </span>
                        <span className="block truncate text-xs text-slate-600">{n.message}</span>
                        <span className="block text-xs text-slate-400">
                          {formatDate(n.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
