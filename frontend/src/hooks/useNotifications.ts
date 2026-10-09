import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications';
import type { NotificationListParams } from '@/types';

export const notificationsKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationsKeys.all, 'list'] as const,
  list: (params?: NotificationListParams) => [...notificationsKeys.lists(), params] as const,
  unreadCount: () => [...notificationsKeys.all, 'unread-count'] as const,
};

/** Bell ochilganda ko'rsatiladigan oxirgi xabarnomalar soni. */
export const BELL_LIST_PARAMS: NotificationListParams = { page: 1, limit: 10 };

export function useNotificationsQuery(params: NotificationListParams, enabled = true) {
  return useQuery({
    queryKey: notificationsKeys.list(params),
    queryFn: () => fetchNotifications(params),
    enabled,
  });
}

export function useUnreadCountQuery() {
  return useQuery({ queryKey: notificationsKeys.unreadCount(), queryFn: fetchUnreadCount });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsKeys.all }),
  });
}
