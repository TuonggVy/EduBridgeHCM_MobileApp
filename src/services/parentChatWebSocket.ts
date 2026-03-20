import SockJS from 'sockjs-client';
import { Client, type IMessage } from '@stomp/stompjs';
import { API_BASE } from '../api/client';

let stompClient: Client | null = null;

export type PrivateMessageBody = unknown;

export const connectWebSocket = (
  username: string,
  onMessage: (body: PrivateMessageBody) => void,
  onConnectionStateChange?: (connected: boolean) => void
) => {
  // Prevent duplicated connections
  if (stompClient?.active) return;

  const socket = new SockJS(`${API_BASE}/ws`);

  stompClient = new Client({
    webSocketFactory: () => socket as any,
    reconnectDelay: 5000,

    onConnect: () => {
      onConnectionStateChange?.(true);

      // Server uses convertAndSendToUser(receiver, "/private", ...) → subscribe to user destination
      stompClient?.subscribe('/user/queue/private', (msg: IMessage) => {
        try {
          const body = JSON.parse(msg.body);
          onMessage(body);
        } catch {
          // Fallback: forward raw string
          onMessage(msg.body);
        }
      });
    },

    onStompError: (frame) => {
      console.error('[WebSocket] STOMP error', frame.headers, frame.body);
      onConnectionStateChange?.(false);
    },

    onWebSocketClose: () => {
      onConnectionStateChange?.(false);
    },
  });

  // `username` is included in BE signature; depending on backend auth, it may be used server-side.
  // If your backend expects it via headers, extend connectHeaders here.
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

