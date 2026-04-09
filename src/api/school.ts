import { apiRequest } from './client';
import type {
  NearbyCampus,
  NearbyCampusSearchResponse,
  SchoolDetail,
  SchoolDetailResponse,
  SchoolListResponse,
  SchoolSummary,
} from '../types/school';

function normalizeSchoolSummary(school: SchoolSummary): SchoolSummary {
  return {
    ...school,
    description: school.description ?? null,
    averageRating: school.averageRating ?? null,
    websiteUrl: school.websiteUrl ?? null,
    hotline: school.hotline ?? null,
    representativeName: school.representativeName ?? null,
    logoUrl: school.logoUrl ?? null,
    foundingDate: school.foundingDate ?? null,
    isFavourite: Boolean(school.isFavourite),
    totalCampus: Number.isFinite(school.totalCampus) ? school.totalCampus : 0,
  };
}

function normalizeSchoolDetail(school: SchoolDetail): SchoolDetail {
  const campusList = Array.isArray(school.campusList)
    ? school.campusList
    : Array.isArray(school.campustList)
      ? school.campustList
      : [];
  const curriculumList = Array.isArray(school.curriculumList)
    ? school.curriculumList.map((curriculum) => ({
        ...curriculum,
        programList: Array.isArray(curriculum.programList) ? curriculum.programList : [],
        subjectsJsonb: Array.isArray(curriculum.subjectsJsonb) ? curriculum.subjectsJsonb : [],
      }))
    : [];

  return {
    ...normalizeSchoolSummary(school),
    campusList,
    campustList: campusList,
    curriculumList,
  };
}

function pickNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizeNearbyCampus(item: Record<string, unknown>): NearbyCampus | null {
  const latitude = pickNumber(item.latitude);
  const longitude = pickNumber(item.longitude);
  if (latitude == null || longitude == null) return null;
  const schoolIdCandidate = item.schoolId ?? item.id;
  const schoolId =
    typeof schoolIdCandidate === 'number' && Number.isFinite(schoolIdCandidate)
      ? schoolIdCandidate
      : null;
  const name =
    pickString(item.name) ??
    pickString(item.campusName) ??
    pickString(item.schoolName) ??
    'Cơ sở trường';
  const schoolName = pickString(item.schoolName);
  return {
    id:
      typeof item.id === 'number' && Number.isFinite(item.id)
        ? item.id
        : Number(`${schoolId ?? 0}${Math.round(latitude * 1000)}${Math.round(longitude * 1000)}`),
    schoolId,
    schoolName,
    name,
    address: pickString(item.address),
    district: pickString(item.district),
    city: pickString(item.city),
    latitude,
    longitude,
    distance: pickNumber(item.distance),
    logoUrl: pickString(item.logoUrl),
    averageRating: pickNumber(item.averageRating),
  };
}

/**
 * GET /api/v1/school/public/list
 * BE không phân trang: trả về toàn bộ danh sách trong một response.
 * Filter / search / “lazy load” UI (slice theo batch) xử lý phía mobile.
 */
export async function fetchSchoolPublicList(): Promise<SchoolListResponse> {
  const response = await apiRequest<SchoolListResponse>('/api/v1/school/public/list', {
    method: 'GET',
  });
  return {
    ...response,
    body: Array.isArray(response.body) ? response.body.map(normalizeSchoolSummary) : [],
  };
}

export async function fetchSchoolPublicDetail(
  schoolId: number
): Promise<SchoolDetailResponse> {
  const response = await apiRequest<SchoolDetailResponse>(`/api/v1/school/${schoolId}/public/detail`, {
    method: 'GET',
  });
  return {
    ...response,
    body: response.body ? normalizeSchoolDetail(response.body) : response.body,
  };
}

export async function searchNearbyCampus(
  lat: number,
  lng: number,
  radius = 10
): Promise<NearbyCampusSearchResponse> {
  const query = `lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&radius=${encodeURIComponent(String(radius))}`;
  const response = await apiRequest<{ message: string; body: unknown }>(
    `/api/v1/school/campus/search/nearby?${query}`,
    { method: 'GET' }
  );
  const rawBody = response.body;
  const body = Array.isArray(rawBody)
    ? rawBody
        .map((item) =>
          item && typeof item === 'object' ? normalizeNearbyCampus(item as Record<string, unknown>) : null
        )
        .filter((item): item is NearbyCampus => item != null)
    : [];
  return { message: response.message, body };
}
