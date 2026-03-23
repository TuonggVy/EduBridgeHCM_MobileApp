import SockJS from 'sockjs-client';
import { Client, type IMessage } from '@stomp/stompjs';
import { API_BASE } from '../api/client';
import { getAccessToken } from './TokenStorage';

let stompClient: Client | null = null;

export type PrivateMessageBody = unknown;

/** Spring convertAndSendToUser thường tới một trong các queue này — đồng bộ với web. */
const USER_QUEUE_DESTINATIONS = [
  '/user/queue/private',
  '/user/queue/private-messages',
  '/user/queue/messages',
] as const;

/** Local ISO-8601 date-time (no zone) cho Jackson LocalDateTime trên server — giống web. */
export function toLocalDateTimeIso(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${ms}`;
}

export type BuildPrivateChatPayloadParams = {
  conversationId: string | number;
  message: string;
  senderName: string;
  receiverName: string;
  clientMessageId?: string;
};

/**
 * Body cho /app/private-message — khớp DTO server và WebSocketService web (kèm alias content/sentAt).
 * Principal STOMP thường là email: dùng email trong senderName / receiverName.
 */
export function buildPrivateChatPayload({
  conversationId,
  message,
  senderName,
  receiverName,
  clientMessageId,
}: BuildPrivateChatPayloadParams) {
  const text = message ?? '';
  const ts = toLocalDateTimeIso();
  return {
    senderName: senderName ?? '',
    receiverName: receiverName ?? '',
    message: text,
    conversationId,
    timestamp: ts,
    content: text,
    sentAt: ts,
    ...(clientMessageId ? { clientMessageId } : {}),
  };
}

function parseFrameBody(raw: string): PrivateMessageBody {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return raw;
  }
}

export const connectWebSocket = (
  username: string,
  onMessage: (body: PrivateMessageBody) => void,
  onConnectionStateChange?: (connected: boolean) => void
) => {
  if (stompClient?.active) return;

  stompClient = new Client({
    webSocketFactory: () => new SockJS(`${API_BASE}/ws`) as any,
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,

    beforeConnect: async (client) => {
      const token = await getAccessToken();
      client.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    },

    onConnect: () => {
      onConnectionStateChange?.(true);

      for (const destination of USER_QUEUE_DESTINATIONS) {
        stompClient?.subscribe(destination, (msg: IMessage) => {
          onMessage(parseFrameBody(typeof msg.body === 'string' ? msg.body : ''));
        });
      }
    },

    onStompError: (frame) => {
      console.error('[WebSocket] STOMP error', frame.headers, frame.body);
      onConnectionStateChange?.(false);
    },

    onWebSocketClose: () => {
      onConnectionStateChange?.(false);
    },
  });

  void username;
  stompClient.activate();
};

export const disconnect = () => {
  if (stompClient) {
    stompClient.deactivate();
  }
  stompClient = null;
};

export const sendMessage = (message: unknown) => {
  if (!stompClient?.active) return false;

  stompClient.publish({
    destination: '/app/private-message',
    body: JSON.stringify(message),
  });

  return true;
};

