export type AiChatDetailItem = {
  label: string;
  value: string;
};

export type AiChatResponse = {
  summary: string;
  details?: AiChatDetailItem[];
  source?: string | null;
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
  createdAt: string;
};

export type AiChatErrorMessage = {
  id: string;
  role: 'error';
  text: string;
  createdAt: string;
};

export type AiChatStoredMessage = AiChatUserMessage | AiChatAssistantMessage | AiChatErrorMessage;
