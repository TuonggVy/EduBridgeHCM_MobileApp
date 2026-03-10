import { Platform } from 'react-native';

const API_BASE =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? Platform.OS === 'android'
      ? 'http://10.0.2.2:8080'
      : 'http://localhost:8080'
    : 'https://your-production-api.com';

type ApiOptions = Omit<RequestInit, 'body'> & { body?: object };

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { body, headers = {}, ...rest } = options;
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(headers as HeadersInit),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    console.error('[API] Lỗi mạng / không gửi được request:', { url, error: networkError });
    throw networkError;
  }
  const data = await res.json().catch((parseError) => {
    console.error('[API] Không parse được JSON response:', parseError);
    return {};
  });
  if (!res.ok) {
    const msg = (data as { message?: string }).message || 'Request failed';
    console.error('[API] Request thất bại:', { url, status: res.status, statusText: res.statusText, data });
    throw new Error(msg);
  }
  return data as T;
}
