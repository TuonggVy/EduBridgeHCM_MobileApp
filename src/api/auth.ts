import { apiRequest } from './client';
import type { LoginResponse, RegisterRequest, RegisterResponse } from '../types/auth';

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
