type NotificationRouteHandler = (route: string | null) => void;
type NotificationInboxChangedHandler = () => void;

const listeners = new Set<NotificationRouteHandler>();
const inboxChangedListeners = new Set<NotificationInboxChangedHandler>();

export function emitNotificationRoute(route: string | null): void {
  listeners.forEach((listener) => {
    listener(route);
  });
}

export function subscribeNotificationRoute(
  listener: NotificationRouteHandler
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitNotificationInboxChanged(): void {
  inboxChangedListeners.forEach((listener) => {
    listener();
  });
}

export function subscribeNotificationInboxChanged(
  listener: NotificationInboxChangedHandler
): () => void {
  inboxChangedListeners.add(listener);
  return () => {
    inboxChangedListeners.delete(listener);
  };
}
