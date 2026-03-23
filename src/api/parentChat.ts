import { apiRequest } from './client';
import type {
  ParentConversationsResponse,
  ParentMessagesHistoryResponse,
  ParentMessagesReadResponse,
} from '../types/chat';

/**
 * Khớp OpenAPI:
 * - GET  /api/v1/parent/conversations?cursorId=
 * - GET  /api/v1/parent/messages/history/{parentEmail}/{counsellorEmail}?cursorId=
 * - PUT  /api/v1/parent/messages/read/{conversationId}/{username}
 */

export async function fetchParentConversations(
  cursorId?: string | number | null
): Promise<ParentConversationsResponse> {
  const query =
    cursorId === undefined || cursorId === null || cursorId === ''
      ? ''
      : `?cursorId=${encodeURIComponent(String(cursorId))}`;
  return apiRequest<ParentConversationsResponse>(`/api/v1/parent/conversations${query}`, {
    method: 'GET',
  });
}

export async function fetchParentMessagesHistory(
  parentEmail: string,
  counsellorEmail: string,
  cursorId?: string | number | null
): Promise<ParentMessagesHistoryResponse> {
  const query =
    cursorId === undefined || cursorId === null || cursorId === ''
      ? ''
      : `?cursorId=${encodeURIComponent(String(cursorId))}`;
  return apiRequest<ParentMessagesHistoryResponse>(
    `/api/v1/parent/messages/history/${encodeURIComponent(parentEmail)}/${encodeURIComponent(counsellorEmail)}${query}`,
    { method: 'GET' }
  );
}

export async function markConversationMessagesRead(
  conversationId: string | number,
  username: string
): Promise<ParentMessagesReadResponse> {
  return apiRequest<ParentMessagesReadResponse>(
    `/api/v1/parent/messages/read/${encodeURIComponent(String(conversationId))}/${encodeURIComponent(username)}`,
    { method: 'PUT' }
  );
}

