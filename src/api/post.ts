import { apiRequest } from './client';
import type { PostListResponse, SchoolPost } from '../types/post';

function normalizeSchoolPost(item: SchoolPost): SchoolPost {
  return {
    ...item,
    imageJson:
      item.imageJson && Array.isArray(item.imageJson.imageItemList)
        ? {
            imageItemList: item.imageJson.imageItemList
              .filter((image) => typeof image?.url === 'string')
              .sort((a, b) => a.position - b.position),
          }
        : null,
    thumbnail: item.thumbnail ?? null,
    author: item.author ?? null,
    categoryPost: item.categoryPost ?? 'ANNOUNCEMENT',
    totalPosition:
      typeof item.totalPosition === 'number' && Number.isFinite(item.totalPosition)
        ? item.totalPosition
        : null,
    publishedDate: item.publishedDate ?? null,
    content: item.content ?? null,
    hashTag: Array.isArray(item.hashTag)
      ? item.hashTag.filter((tag): tag is string => typeof tag === 'string')
      : [],
    typeFile: item.typeFile ?? null,
    status: item.status ?? null,
  };
}

/**
 * GET /api/v1/post/list
 */
export async function fetchPostList(): Promise<PostListResponse> {
  const response = await apiRequest<PostListResponse>('/api/v1/post/list', {
    method: 'GET',
  });
  return {
    ...response,
    body: Array.isArray(response.body) ? response.body.map(normalizeSchoolPost) : [],
  };
}
