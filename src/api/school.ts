import { apiRequest } from './client';
import type {
  NearbyCampusSearchItem,
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

function pickNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizeNearbyCampusSearchItem(item: Record<string, unknown>): NearbyCampusSearchItem | null {
  const id = pickNumber(item.id);
  const distance = pickNumber(item.distance);
  const latitude = pickNumber(item.latitude);
  const longitude = pickNumber(item.longitude);
  if (id == null || distance == null || latitude == null || longitude == null) return null;
  const emails = Array.isArray(item.consultantEmails)
    ? item.consultantEmails.filter((e): e is string => typeof e === 'string')
    : [];
  return {
    id,
    distance,
    latitude,
    longitude,
    name: pickString(item.name) ?? 'Cơ sở',
    address: pickString(item.address),
    city: pickString(item.city),
    district: pickString(item.district),
    ward: pickString(item.ward),
    imageJson: pickString(item.imageJson),
    policyDetail: pickString(item.policyDetail),
    consultantEmails: emails,
    boardingType: pickString(item.boardingType),
    phoneNumber: pickString(item.phoneNumber),
    facility: pickString(item.facility),
    status: pickString(item.status),
  };
}

/**
 * GET /api/v1/school/campus/search/nearby?lat=&lng=&radius=
 * Trả về campus trong bán kính; client có thể lọc theo `id` campus của một trường (vd. trong SchoolDetailModal).
 */
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
        .map((row) =>
          row && typeof row === 'object' ? normalizeNearbyCampusSearchItem(row as Record<string, unknown>) : null
        )
        .filter((row): row is NearbyCampusSearchItem => row != null)
    : [];
  return { message: response.message, body };
}
