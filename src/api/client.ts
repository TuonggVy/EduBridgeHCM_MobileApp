import { Platform } from 'react-native';
import { getAccessToken, getRefreshToken, setAccessToken } from '../services/TokenStorage';

export const API_BASE =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? Platform.OS === 'android'
      ? 'http://10.0.2.2:8080'
      : 'http://localhost:8080'
    : 'https://your-production-api.com';

const MOBILE_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'X-Device-Type': 'mobile',
};

type ApiOptions = Omit<RequestInit, 'body'> & { body?: object };

export class ApiError extends Error {
  status: number;
  url: string;
  data: unknown;

  constructor(message: string, status: number, url: string, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.data = data;
  }
}

/**
 * Gọi POST /auth/refresh để lấy accessToken mới. Trả về true nếu thành công.
 */
async function refreshAuthToken(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  const url = `${API_BASE}/api/v1/auth/refresh`;
  const res = await fetch(url, {
    method: 'POST',
    headers: MOBILE_HEADERS,
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return false;
  const newAccess = typeof (data as { body?: unknown }).body === 'string' ? (data as { body: string }).body : null;
  if (newAccess) await setAccessToken(newAccess);
  return !!newAccess;
}

async function doRequest<T>(
  path: string,
  options: ApiOptions,
  retryAfterRefresh: boolean
): Promise<T> {
  const { body, headers = {}, ...rest } = options;
  const token = await getAccessToken();
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...MOBILE_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as HeadersInit),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const rawText = await res.text();
  const data = rawText
    ? (() => {
        try {
          return JSON.parse(rawText) as unknown;
        } catch (parseError) {
          console.error('[API] Không parse được JSON response:', parseError);
          return {};
        }
      })()
    : {};

  if (res.status === 401 && retryAfterRefresh) {
    const refreshed = await refreshAuthToken();
    if (refreshed) return doRequest<T>(path, options, false);
  }

  if (!res.ok) {
    const msg = (data as { message?: string }).message || 'Request failed';
    console.error('[API] Request thất bại:', { url, status: res.status, statusText: res.statusText, data });
    throw new ApiError(msg, res.status, url, data);
  }
  return data as T;
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  return doRequest<T>(path, options, true);
}
