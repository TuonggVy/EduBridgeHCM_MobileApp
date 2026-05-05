import { apiRequest } from './client';

export type DevicePlatform = 'IOS' | 'ANDROID';
export type NotificationsListEnvelope = {
  body?: {
    items?: unknown[];
    currentPage?: number;
    pageSize?: number;
    totalItems?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
  };
};

export type NotificationsUnreadCountEnvelope = {
  body?: {
    unreadCount?: number;
  };
};

export async function registerDeviceToken(
  token: string,
  platform: DevicePlatform
): Promise<void> {
  await apiRequest('/api/v1/notifications/device-tokens', {
    method: 'POST',
    body: { token, platform },
  });
}

export async function removeDeviceToken(token: string): Promise<void> {
  await apiRequest('/api/v1/notifications/device-tokens/remove', {
    method: 'POST',
    body: { token },
  });
}

export async function fetchNotifications(params?: {
  page?: number;
  pageSize?: number;
}): Promise<NotificationsListEnvelope> {
  const page = params?.page ?? 0;
  const pageSize = params?.pageSize ?? 20;
  return apiRequest(
    `/api/v1/notifications?page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`,
    { method: 'GET' }
  );
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const res = await apiRequest<NotificationsUnreadCountEnvelope>(
    '/api/v1/notifications/unread-count',
    { method: 'GET' }
  );
  const value = res?.body?.unreadCount;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export async function markNotificationAsRead(recipientId: number | string): Promise<void> {
  await apiRequest(`/api/v1/notifications/${encodeURIComponent(String(recipientId))}/read`, {
    method: 'PUT',
  });
}
