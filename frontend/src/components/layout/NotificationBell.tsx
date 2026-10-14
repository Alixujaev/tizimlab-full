import { useId } from 'react';
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
import { Button, Dropdown, EmptyState, IconButton, Pressable, Skeleton } from '@/ui';

/** Bell: o'qilmaganlar soni, oxirgi xabarnomalar, o'qildi belgisi (spec §9, D-59). */
export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const countId = useId();
  const unread = useUnreadCountQuery().data ?? 0;
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  return (
    <Dropdown
      label={t('topbar.notifications')}
      className="w-80 max-w-viewport overflow-hidden"
      trigger={(props) => (
        <span className="relative inline-flex">
          <IconButton
            {...props}
            icon="bell"
            label={t('topbar.notifications')}
            aria-describedby={unread > 0 ? countId : undefined}
          />
          {unread > 0 && (
            <>
              <span id={countId} className="sr-only">
                {t('notifications.unreadCount', { n: unread })}
              </span>
              <span
                data-testid="notification-badge"
                aria-hidden="true"
                className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-semibold tabular-nums text-primary-fg ring-2 ring-surface"
              >
                {unread > 99 ? '99+' : unread}
              </span>
            </>
          )}
        </span>
      )}
    >
      {(close) => (
        <BellPanel
          unread={unread}
          markAllPending={markAll.isPending}
          onMarkAll={() => markAll.mutate()}
          onItem={(n) => {
            if (!n.isRead) markRead.mutate(n.id);
            const link = notificationLink(n);
            if (link) {
              close();
              void navigate(link);
            }
          }}
        />
      )}
    </Dropdown>
  );
}

interface BellPanelProps {
  unread: number;
  markAllPending: boolean;
  onMarkAll: () => void;
  onItem: (n: NotificationDto) => void;
}

/** Panel ochilgandagina ro'yxat so'raladi (panel mount bo'lganda `enabled`). */
function BellPanel({ unread, markAllPending, onMarkAll, onItem }: BellPanelProps) {
  const { t } = useTranslation();
  const list = useNotificationsQuery(BELL_LIST_PARAMS, true);
  const items = list.data?.data ?? [];
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="text-sm font-semibold text-fg">{t('topbar.notifications')}</span>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={onMarkAll} loading={markAllPending}>
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>
      {list.isLoading ? (
        <div role="status" className="flex flex-col gap-4 p-4">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton lines={2} />
          <Skeleton lines={2} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState size="sm" icon="bell" title={t('topbar.noNotifications')} />
      ) : (
        <ul
          aria-label={t('topbar.notifications')}
          className="max-h-96 divide-y divide-line overflow-y-auto"
        >
          {items.map((n) => (
            <li key={n.id}>
              <Pressable highlighted={!n.isRead} onClick={() => onItem(n)}>
                <span
                  aria-hidden="true"
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-primary'}`}
                />
                <span className="min-w-0 flex-1">
                  {!n.isRead && <span className="sr-only">{t('notifications.unread')}: </span>}
                  <span className="block text-sm font-medium text-fg">
                    {notificationTitle(t, n)}
                  </span>
                  <span className="block truncate text-xs text-fg-muted">{n.message}</span>
                  <span className="mt-0.5 block text-xs text-fg-subtle">
                    {formatDate(n.createdAt)}
                  </span>
                </span>
              </Pressable>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
