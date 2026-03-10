import { apiRequest } from './client';
import type { LoginResponse } from '../types/auth';

/**
 * Gọi API signin(email) của backend.
 * BE nhận credential (JWT) từ Google, dùng jwtDecode lấy email → signin(email).
 * Ở app: gửi email từ Google JWT (đã decode) lên API.
 */
export async function signin(email: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: { email },
  });
}
