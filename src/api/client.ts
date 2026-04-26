import { Platform } from 'react-native';
import { getAccessToken, getRefreshToken, setAccessToken } from '../services/TokenStorage';

const DEFAULT_DEPLOY_BASE = 'https://edubridgehcm.onrender.com';

/**
 * Priority:
 * 1) EXPO_PUBLIC_API_BASE - explicit override
 * 2) Release build - EXPO_PUBLIC_API_SERVER or default deploy URL
 * 3) Dev + EXPO_PUBLIC_API_ENV=deploy - use deploy URL
 * 4) Dev local - EXPO_PUBLIC_API_LOCAL or platform defaults
 */
function resolveApiBase(): string {
  const explicit = process.env.EXPO_PUBLIC_API_BASE?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const server = process.env.EXPO_PUBLIC_API_SERVER?.trim().replace(/\/+$/, '') || DEFAULT_DEPLOY_BASE;
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (!isDev) return server;

  const mode = process.env.EXPO_PUBLIC_API_ENV?.trim().toLowerCase();
  if (mode === 'deploy') return server;

  const localOverride = process.env.EXPO_PUBLIC_API_LOCAL?.trim().replace(/\/+$/, '');
  if (localOverride) return localOverride;

  return Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
}

export const API_BASE = resolveApiBase();

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
          if (__DEV__) {
            console.log('[API] Không parse được JSON response:', parseError);
          }
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
    if (__DEV__) {
      console.log('[API] Request thất bại:', { url, status: res.status, statusText: res.statusText, data });
    }
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
