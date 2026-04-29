import { apiRequest } from './client';
import type { PostListResponse, SchoolPost } from '../types/post';

function pickString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function pickNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pickObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeSchoolPost(item: unknown): SchoolPost {
  const raw = pickObject(item);
  const imageJson = pickObject(raw?.imageJson);
  const content = pickObject(raw?.content);
  const author = pickObject(raw?.author);

  const imageItemList = Array.isArray(imageJson?.imageItemList)
    ? imageJson.imageItemList
        .map((imageItem) => {
          const imageObject = pickObject(imageItem);
          const url = pickString(imageObject?.url);
          const position = pickNumber(imageObject?.position) ?? 0;
          if (!url) return null;
          return { url, position };
        })
        .filter((image): image is { url: string; position: number } => image !== null)
        .sort((a, b) => a.position - b.position)
    : [];

  const contentDataList = Array.isArray(content?.contentDataList)
    ? content.contentDataList
        .map((dataItem) => {
          const dataObject = pickObject(dataItem);
          const text = pickString(dataObject?.text);
          const position = pickNumber(dataObject?.position) ?? 0;
          if (!text) return null;
          return { text, position };
        })
        .filter((data): data is { text: string; position: number } => data !== null)
        .sort((a, b) => a.position - b.position)
    : [];

  return {
    id: pickNumber(raw?.id) ?? 0,
    imageJson: imageItemList.length > 0 ? { imageItemList } : null,
    thumbnail: pickString(raw?.thumbnail),
    author: pickString(author?.name) ? { name: String(author?.name) } : null,
    categoryPost: pickString(raw?.categoryPost) ?? 'ANNOUNCEMENT',
    totalPosition: pickNumber(raw?.totalPosition),
    publishedDate: pickString(raw?.publishedDate),
    content:
      contentDataList.length > 0 || pickString(content?.shortDescription) || pickString(content?.type)
        ? {
            type: pickString(content?.type) ?? '',
            contentDataList,
            shortDescription: pickString(content?.shortDescription) ?? '',
          }
        : null,
    hashTag: Array.isArray(raw?.hashTag)
      ? raw.hashTag.filter((tag): tag is string => typeof tag === 'string')
      : [],
    typeFile: pickString(raw?.typeFile),
    status: pickString(raw?.status),
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
    message: pickString(response.message) ?? '',
    body: Array.isArray(response.body) ? response.body.map(normalizeSchoolPost) : [],
  };
}
