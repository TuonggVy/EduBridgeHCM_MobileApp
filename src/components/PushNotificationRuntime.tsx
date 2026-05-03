import messaging from '@react-native-firebase/messaging';
import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  attachForegroundMessageListener,
  attachTokenRefreshListener,
  syncFcmTokenWithBackend,
} from '../services/PushNotificationService';

/**
 * Gắn listener FCM và đồng bộ token sau khi đăng nhập. Đặt bên trong AuthProvider.
 */
export function PushNotificationRuntime() {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const unsubForeground = attachForegroundMessageListener();
    const unsubTokenRefresh = attachTokenRefreshListener(
      () => userRef.current?.email ?? null
    );

    const unsubOpened = messaging().onNotificationOpenedApp(remoteMessage => {
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
