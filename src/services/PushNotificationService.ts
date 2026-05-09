import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { registerDeviceToken, removeDeviceToken } from '../api/notifications';

function devicePlatform(): 'IOS' | 'ANDROID' {
  return Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
}

async function ensureAndroidPostNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function requestNotificationPermission(): Promise<boolean> {
  const status = await messaging().requestPermission();
  const ok =
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL;
  return ok;
}

export async function syncFcmTokenWithBackend(userEmail: string): Promise<void> {
  const androidOk = await ensureAndroidPostNotifications();
  if (!androidOk) {
    if (__DEV__) {
      console.log('[FCM] Android: quyền hiển thị thông báo bị từ chối');
    }
    return;
  }

  const allowed = await requestNotificationPermission();
  if (!allowed) {
    if (__DEV__) {
      console.log('[FCM] Người dùng từ chối quyền thông báo');
    }
    return;
  }

  if (!messaging().isDeviceRegisteredForRemoteMessages) {
    try {
      await messaging().registerDeviceForRemoteMessages();
    } catch (e) {
      if (__DEV__) {
        console.warn('[FCM] Không thể register device cho remote messages:', e);
      }
      return;
    }
  }

  if (!messaging().isDeviceRegisteredForRemoteMessages) {
    if (__DEV__) {
      console.warn('[FCM] Device chưa đăng ký remote messages, bỏ qua sync token');
    }
    return;
  }

  const token = await messaging().getToken();
  if (!token) return;

  await registerDeviceToken(token, devicePlatform());

  if (__DEV__) {
    console.log('[FCM] Đã đăng ký token với backend', userEmail);
  }
}

/** Gọi trước khi xóa session (còn Bearer token). */
export async function unregisterFcmTokenFromBackend(): Promise<void> {
  try {
    const token = await messaging().getToken();
    if (token) {
      await removeDeviceToken(token);
    }
  } catch {
    // Bỏ qua: logout vẫn tiếp tục
  }
}

function showForegroundAlert(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
  const title =
    remoteMessage.notification?.title ||
    (remoteMessage.data?.title as string | undefined) ||
    'Thông báo mới';
  const body =
    remoteMessage.notification?.body ||
    (remoteMessage.data?.body as string | undefined) ||
    '';
  Alert.alert(title, body || undefined);
}

export function attachForegroundMessageListener(): () => void {
  const unsub = messaging().onMessage(async remoteMessage => {
    showForegroundAlert(remoteMessage);
    if (__DEV__) {
      console.log(
        '[FCM] Foreground message:',
        remoteMessage?.messageId,
        remoteMessage?.data
      );
    }
  });
  return unsub;
}

export function attachTokenRefreshListener(
  getUserEmail: () => string | null
): () => void {
  return messaging().onTokenRefresh(async () => {
    const email = getUserEmail();
    if (!email) return;
    try {
      await syncFcmTokenWithBackend(email);
    } catch (e) {
      if (__DEV__) {
        console.warn('[FCM] onTokenRefresh sync thất bại:', e);
      }
    }
  });
}
