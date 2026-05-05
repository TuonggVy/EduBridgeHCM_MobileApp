import messaging from '@react-native-firebase/messaging';
import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  attachForegroundMessageListener,
  attachTokenRefreshListener,
  syncFcmTokenWithBackend,
} from '../services/PushNotificationService';
import {
  emitNotificationInboxChanged,
  emitNotificationRoute,
} from '../services/NotificationNavigationBus';

function resolveRouteFromRemoteMessage(remoteMessage: any): string | null {
  const data = remoteMessage?.data;
  const routeCandidate =
    (typeof data?.route === 'string' && data.route) ||
    (typeof data?.redirectRoute === 'string' && data.redirectRoute) ||
    (typeof data?.deeplink === 'string' && data.deeplink) ||
    (typeof data?.deepLink === 'string' && data.deepLink) ||
    null;
  if (!routeCandidate) return null;
  const route = routeCandidate.trim();
  return route.length > 0 ? route : null;
}

/**
 * Gắn listener FCM và đồng bộ token sau khi đăng nhập. Đặt bên trong AuthProvider.
 */
export function PushNotificationRuntime() {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const unsubForeground = attachForegroundMessageListener();
    const unsubRealtime = messaging().onMessage(() => {
      emitNotificationInboxChanged();
    });
    const unsubTokenRefresh = attachTokenRefreshListener(
      () => userRef.current?.email ?? null
    );

    const unsubOpened = messaging().onNotificationOpenedApp(remoteMessage => {
      emitNotificationInboxChanged();
      emitNotificationRoute(resolveRouteFromRemoteMessage(remoteMessage));
      if (__DEV__) {
        console.log(
          '[FCM] Mở app từ notification (background):',
          remoteMessage?.messageId
        );
      }
    });

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          emitNotificationInboxChanged();
          emitNotificationRoute(resolveRouteFromRemoteMessage(remoteMessage));
        }
        if (remoteMessage && __DEV__) {
          console.log(
            '[FCM] Cold start từ notification:',
            remoteMessage.messageId
          );
        }
      })
      .catch(() => {});

    return () => {
      unsubForeground();
      unsubRealtime();
      unsubTokenRefresh();
      unsubOpened();
    };
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      try {
        await syncFcmTokenWithBackend(user.email);
      } catch (e) {
        if (__DEV__) {
          console.warn('[FCM] Đồng bộ token sau đăng nhập thất bại:', e);
        }
      }
    })();
  }, [user?.email]);

  return null;
}
