import { apiRequest } from './client';

export async function fetchParentConversations(): Promise<unknown> {
  return apiRequest<unknown>('/api/v1/parent/conversations', { method: 'GET' });
}

export async function fetchParentMessagesHistory(
  parentEmail: string,
  counsellorEmail: string,
  cursorId?: string | number | null
): Promise<unknown> {
  const query =
    cursorId === undefined || cursorId === null || cursorId === ''
      ? ''
      : `?cursorId=${encodeURIComponent(String(cursorId))}`;
  return apiRequest<unknown>(
    `/api/v1/parent/messages/history/${encodeURIComponent(parentEmail)}/${encodeURIComponent(counsellorEmail)}${query}`,
    { method: 'GET' }
  );
}

export async function markConversationMessagesRead(
  conversationId: string,
  username: string
): Promise<unknown> {
  return apiRequest<unknown>(
    `/api/v1/parent/messages/read/${encodeURIComponent(conversationId)}/${encodeURIComponent(username)}`,
    { method: 'PUT' }
  );
}

