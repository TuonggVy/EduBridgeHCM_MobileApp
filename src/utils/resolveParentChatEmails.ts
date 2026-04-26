import type { ParentConversationsItem } from '../types/chat';

/**
 * Khớp logic web Header.jsx `resolveConversationEmails` — dùng đúng cặp email cho
 * WebSocket (receiverName) và PUT read. Lịch sử tin nhắn REST dùng
 * GET /parent/messages/history/{parentEmail}/{campusId}/{studentProfileId}.
 */
export function resolveParentChatEmails(
  conversation: ParentConversationsItem,
  loggedInUserEmail: string
): { parentEmail: string; counsellorEmail: string } {
  const parentEmail =
    (loggedInUserEmail && loggedInUserEmail.trim()) ||
    (conversation.participantParentEmail && conversation.participantParentEmail.trim()) ||
    '';
  const counsellorEmail = (conversation.counsellorEmail && conversation.counsellorEmail.trim()) || '';
  return { parentEmail, counsellorEmail };
}
