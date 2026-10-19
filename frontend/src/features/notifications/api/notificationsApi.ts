import { apiClient } from '../../shared/api';
import type { Notification } from '../../shared/types';

export function getMyNotifications(): Promise<Notification[]> {
  return apiClient.get<Notification[]>('/notifications/me');
}

export function markNotificationAsRead(
  notificationId: string,
): Promise<Notification> {
  return apiClient.patch<Notification>(`/notifications/${notificationId}/read`);
}
