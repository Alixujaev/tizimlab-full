import { apiClient } from '@/api/client';
import type { ApiResponse, NotificationDto, NotificationListParams, Paginated } from '@/types';

export async function fetchNotifications(
  params?: NotificationListParams,
): Promise<Paginated<NotificationDto>> {
  const { data } = await apiClient.get<Paginated<NotificationDto>>('/notifications', {
    params: { ...params, unread: params?.unread ? 'true' : undefined },
  });
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<ApiResponse<{ count: number }>>(
    '/notifications/unread-count',
  );
  return data.data.count;
}

export async function markNotificationRead(id: string): Promise<NotificationDto> {
  const { data } = await apiClient.post<ApiResponse<NotificationDto>>(`/notifications/${id}/read`);
  return data.data;
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const { data } =
    await apiClient.post<ApiResponse<{ updated: number }>>('/notifications/read-all');
  return data.data;
}
