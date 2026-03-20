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
  unreadCount?: number;
  lastMessageContent?: string | null;
  lastMessageAt?: string | null;
};

