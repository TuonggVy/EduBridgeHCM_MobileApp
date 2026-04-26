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
const USER_READ_EVENT_QUEUES = ['/user/queue/conversation-read'] as const;

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
  campusId?: string | number | null;
  studentProfileId?: string | number | null;
  clientMessageId?: string;
};

function normalizeCampusId(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0;
  const s = String(value).trim();
  if (!s || s === 'null' || s === 'undefined' || s === 'NaN') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * Body cho /app/private-message — khớp DTO server và WebSocketService web (kèm alias content/sentAt).
 * Principal STOMP thường là email: dùng email trong senderName / receiverName.
 */
export function buildPrivateChatPayload({
  conversationId,
  message,
  senderName,
  receiverName,
  campusId,
  studentProfileId,
  clientMessageId,
}: BuildPrivateChatPayloadParams) {
  const text = message ?? '';
  const ts = toLocalDateTimeIso();
  const recv = String(receiverName ?? '').trim();
  const send = String(senderName ?? '').trim();
  const cid = normalizeCampusId(campusId);
  const broadcastToCampus = recv === '' && cid > 0;

  let convOut: string | number = conversationId;
  if (convOut != null && String(convOut).trim() !== '') {
    const n = Number(convOut);
    convOut = Number.isFinite(n) ? Math.trunc(n) : convOut;
  }

  const out: Record<string, unknown> = {
    senderName: send,
    receiverName: recv,
    campusId: cid,
    message: text,
    conversationId: convOut,
    timestamp: ts,
    content: text,
    sentAt: ts,
    ...(clientMessageId ? { clientMessageId } : {}),
  };
  if (broadcastToCampus) out.broadcastToCampus = true;
  if (studentProfileId != null && String(studentProfileId).trim() !== '') {
    const sp = Number(studentProfileId);
    out.studentProfileId = Number.isFinite(sp) ? Math.trunc(sp) : String(studentProfileId).trim();
  }
  return out;
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

      for (const destination of [...USER_QUEUE_DESTINATIONS, ...USER_READ_EVENT_QUEUES]) {
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
  if (!stompClient?.connected) return false;

  const payload =
    message && typeof message === 'object' && !Array.isArray(message)
      ? {
          ...(message as Record<string, unknown>),
          campusId: normalizeCampusId((message as Record<string, unknown>).campusId),
        }
      : message;

  stompClient.publish({
    destination: '/app/private-message',
    body: JSON.stringify(payload),
  });

  return true;
};

