import { apiRequest, API_BASE } from './client';
import { getAccessToken } from '../services/TokenStorage';
import type { LoginResponse, RegisterRequest, RegisterResponse } from '../types/auth';

const MOBILE_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'X-Device-Type': 'mobile',
};

/** Gọi API logout BE. Dùng fetch để tránh lỗi khi BE trả 403/body rỗng; luôn xóa token ở FE sau. */
export async function logout(): Promise<void> {
  const token = await getAccessToken();
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        ...MOBILE_HEADERS,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return;
    const text = await res.text();
    if (text) JSON.parse(text);
  } catch {
    // Bỏ qua: BE có thể trả 403/body rỗng; FE vẫn xóa token
  }
}

/**
 * Gọi API signin(email) của backend.
 */
export async function signin(email: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { email },
  });
}

/**
 * Gọi API đăng ký. Parent: role "PARENT", schoolRequest null.
 */
export async function register(
  payload: RegisterRequest
): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: payload,
  });
}
