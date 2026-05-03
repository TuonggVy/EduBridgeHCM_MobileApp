import { apiRequest } from './client';

export type DevicePlatform = 'IOS' | 'ANDROID';

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
