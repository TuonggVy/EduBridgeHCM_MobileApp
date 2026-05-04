export type AiChatDetailItem = {
  label: string;
  value: string;
};

export type AiChatResponse = {
  summary: string;
  details?: AiChatDetailItem[];
  /** Một URL (chuỗi) hoặc danh sách URL — n8n có thể trả `source` dạng mảng */
  source?: string | null;
  sources?: string[];
};

export type AiChatUserMessage = {
  id: string;
  role: 'user';
  text: string;
  createdAt: string;
};

export type AiChatAssistantMessage = {
  id: string;
  role: 'assistant';
  summary: string;
  details: AiChatDetailItem[];
  source: string | null;
  /** Khi BE trả nhiều URL trong `source` */
  sources?: string[];
  createdAt: string;
};

export type AiChatErrorMessage = {
  id: string;
  role: 'error';
  text: string;
  createdAt: string;
};

export type AiChatStoredMessage = AiChatUserMessage | AiChatAssistantMessage | AiChatErrorMessage;
