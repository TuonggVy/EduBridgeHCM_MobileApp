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
  /** GET /parent/conversations — `studentId`, dùng cho path /messages/history/.../{studentProfileId} */
  studentProfileId?: number | string;
  /** GET /parent/messages/history/{parentEmail}/{campusId}/{studentProfileId} */
  campusId?: number | string;
  schoolId?: number | string;
  schoolName?: string | null;
  schoolLogoUrl?: string | null;
  /** Email tư vấn viên (BE: `otherUser`) — dùng cho WebSocket receiverName */
  counsellorEmail: string;
  counsellorName?: string | null;
  studentName?: string | null;
  counsellorAvatarUrl?: string | null;
  /** parentEmail / participantParentEmail từ BE — fallback khi cần khớp history API */
  participantParentEmail?: string | null;
  unreadCount?: number;
  lastMessageContent?: string | null;
  lastMessageAt?: string | null;
  /** BE: CONVERSATION_ACTIVE, … */
  status?: string | null;
};

/** REST envelope: PUT /api/v1/parent/messages/read/... */
export type ParentMessageReadItem = {
  id: number;
  senderName: string;
  receiverName: string;
  campusId?: number;
  message: string;
  conversationId: number;
  timestamp: string;
  status: string;
};

export type ParentMessagesReadResponse = {
  message: string;
  body: ParentMessageReadItem[];
};

export type ParentCreateConversationRequest = {
  parentEmail: string;
  campusId: number;
  studentProfileId: number;
};

export type ParentCreateConversationResponse = {
  message: string;
  body: number;
};

export type ParentMessagesHistoryTrait = {
  name: string;
  description: string;
};

export type ParentMessagesHistorySubjectResult = {
  score: number | null;
  subjectName: string;
};

export type ParentMessagesHistoryGradeBlock = {
  gradeLevel: string;
  subjectResults: ParentMessagesHistorySubjectResult[];
};

/** REST body: GET /api/v1/parent/messages/history/.../{studentProfileId} */
export type ParentMessagesHistoryBody = {
  nextCursorId: number | null;
  conversationId: number;
  campusId?: number;
  hasMore: boolean;
  messages?: unknown[];
  /** Một số bản BE dùng `items` thay cho `messages`. */
  items?: unknown[];
  favouriteJob?: string | null;
  traits?: ParentMessagesHistoryTrait[];
  gender?: string | null;
  academicProfileMetadata?: ParentMessagesHistoryGradeBlock[];
  childName?: string | null;
  personalityCode?: string | null;
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

