import { apiRequest } from './client';
import type { SchoolDetailResponse, SchoolListResponse } from '../types/school';

/**
 * GET /api/v1/school/public/list
 * BE không phân trang: trả về toàn bộ danh sách trong một response.
 * Filter / search / “lazy load” UI (slice theo batch) xử lý phía mobile.
 */
export async function fetchSchoolPublicList(): Promise<SchoolListResponse> {
  return apiRequest<SchoolListResponse>('/api/v1/school/public/list', {
    method: 'GET',
  });
}

export async function fetchSchoolPublicDetail(
  schoolId: number
): Promise<SchoolDetailResponse> {
  return apiRequest<SchoolDetailResponse>(`/api/v1/school/${schoolId}/public/detail`, {
    method: 'GET',
  });
}
