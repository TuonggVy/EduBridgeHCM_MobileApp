import { apiRequest } from './client';
import type {
  ProfileGetBody,
  ProfileGetResponse,
  ProfilePostRequest,
  ProfilePostResponse,
} from '../types/auth';

/** Hồ sơ coi là đã hoàn thiện khi có tên và SĐT. */
export function isProfileComplete(body: ProfileGetBody | null): boolean {
  if (!body?.parent) return false;
  const p = body.parent;
  return !!(p.name?.trim() && p.phone?.trim());
}

const PROFILE_PATH = '/api/v1/account/profile';

/**
 * GET profile của tài khoản đăng nhập (Parent).
 */
export async function getProfile(): Promise<ProfileGetResponse> {
  return apiRequest<ProfileGetResponse>(PROFILE_PATH, { method: 'GET' });
}

/**
 * PUT cập nhật / tạo hồ sơ (parentData, counsellorData, campusData).
 * Parent chỉ cần gửi parentData.
 */
export async function updateProfile(
  payload: ProfilePostRequest
): Promise<ProfilePostResponse> {
  return apiRequest<ProfilePostResponse>(PROFILE_PATH, {
    method: 'PUT',
    body: payload,
  });
}
