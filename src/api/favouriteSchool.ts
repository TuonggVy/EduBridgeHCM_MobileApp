import { apiRequest } from './client';
import type {
  FavouriteSchoolListResponse,
  FavouriteSchoolMutationResponse,
} from '../types/school';

const BASE = '/api/v1/parent/favourite/school';

export async function fetchFavouriteSchoolsPage(
  page: number,
  pageSize: number
): Promise<FavouriteSchoolListResponse> {
  const q = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return apiRequest<FavouriteSchoolListResponse>(`${BASE}?${q.toString()}`, {
    method: 'GET',
  });
}

export async function addFavouriteSchool(schoolId: number): Promise<FavouriteSchoolMutationResponse> {
  return apiRequest<FavouriteSchoolMutationResponse>(BASE, {
    method: 'POST',
    body: { schoolId },
  });
}

export async function removeFavouriteSchool(favouriteId: number): Promise<FavouriteSchoolMutationResponse> {
  return apiRequest<FavouriteSchoolMutationResponse>(`${BASE}/${favouriteId}`, {
    method: 'DELETE',
  });
}

/** schoolId → favouriteRecordId (dùng cho DELETE). */
export async function fetchFavouriteSchoolIdMap(): Promise<Record<number, number>> {
  const map: Record<number, number> = {};
  let page = 0;
  const pageSize = 50;
  for (;;) {
    const res = await fetchFavouriteSchoolsPage(page, pageSize);
    const body = res.body;
    if (!body?.items?.length) break;
    for (const item of body.items) {
      map[item.schoolId] = item.id;
    }
    if (!body.hasNext) break;
    page += 1;
  }
  return map;
}
