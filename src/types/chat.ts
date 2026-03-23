export type ChatMessageStatus = 'sending' | 'sent' | 'seen';

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderEmail: string;
  content: string;
  createdAt: string; // ISO string (or backend string)
  status?: ChatMessageStatus;
  clientMessageId?: string;
};

export type ParentConversationsItem = {
  conversationId: string;
  counsellorEmail: string;
  counsellorName?: string | null;
  counsellorAvatarUrl?: string | null;
  /** parentEmail / participantParentEmail từ BE — fallback khi cần khớp history API */
  participantParentEmail?: string | null;
  unreadCount?: number;
  lastMessageContent?: string | null;
  lastMessageAt?: string | null;
};

/** REST envelope: PUT /api/v1/parent/messages/read/... */
export type ParentMessagesReadResponse = {
  message: string;
  body: unknown[];
};

/** REST body: GET /api/v1/parent/messages/history/... */
export type ParentMessagesHistoryBody = {
  nextCursorId: number | null;
  conversationId: number;
  hasMore: boolean;
  messages?: unknown[];
  /** Một số bản BE dùng `items` thay cho `messages`. */
  items?: unknown[];
};

export type ParentMessagesHistoryResponse = {
  message: string;
  body: ParentMessagesHistoryBody;
};

/** REST body: GET /api/v1/parent/conversations */
export type ParentConversationsListBody = {
  nextCursorId: number | null;
  hasMore: boolean;
  items: unknown[];
};

export type ParentConversationsResponse = {
  message: string;
  body: ParentConversationsListBody;
};

