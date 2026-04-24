import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

const Ionicons = require('@expo/vector-icons').Ionicons;

type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

type ShowToastInput = Omit<ToastItem, 'id'> & { id?: string };

type ToastContextValue = {
  showToast: (input: ShowToastInput) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string, actionLabel?: string, onAction?: () => void) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showActionToast: (message: string, actionLabel: string, onAction: () => void, title?: string) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 2800;
const ACTION_DURATION = 4500;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeUserFacingErrorMessage(message: string): string {
  const raw = (message ?? '').trim();
  if (!raw) return 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.';

  const lower = raw.toLowerCase();
  const looksTechnical =
    lower.includes('[api]') ||
    lower.includes('request failed') ||
    lower.includes('network request failed') ||
    lower.includes('http://') ||
    lower.includes('https://') ||
    raw.startsWith('{') ||
    raw.startsWith('[');

  if (looksTechnical) {
    return 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.';
  }

  if (raw.length > 180) {
    return 'Có lỗi xảy ra. Vui lòng thử lại sau.';
  }

  return raw;
}

function palette(
  type: ToastType,
  isDark: boolean
): { bg: string; icon: string; title: string; message: string; action: string; iconName: string } {
  if (!isDark) {
    if (type === 'success') return { bg: '#ECFDF5', icon: '#22C55E', title: '#14532D', message: '#166534', action: '#15803D', iconName: 'checkmark-circle' };
    if (type === 'error') return { bg: '#FEF2F2', icon: '#EF4444', title: '#7F1D1D', message: '#991B1B', action: '#B91C1C', iconName: 'alert-circle' };
    if (type === 'warning') return { bg: '#FFFBEB', icon: '#F59E0B', title: '#78350F', message: '#92400E', action: '#B45309', iconName: 'warning' };
    return { bg: '#EFF6FF', icon: '#3B82F6', title: '#1E3A8A', message: '#1D4ED8', action: '#1D4ED8', iconName: 'information-circle' };
  }
  if (type === 'success') return { bg: '#052E1D', icon: '#22C55E', title: '#86EFAC', message: '#D1FAE5', action: '#86EFAC', iconName: 'checkmark-circle' };
  if (type === 'error') return { bg: '#3A0B0B', icon: '#EF4444', title: '#FCA5A5', message: '#FECACA', action: '#FCA5A5', iconName: 'alert-circle' };
  if (type === 'warning') return { bg: '#3A2A04', icon: '#F59E0B', title: '#FCD34D', message: '#FDE68A', action: '#FCD34D', iconName: 'warning' };
  return { bg: '#0A2342', icon: '#3B82F6', title: '#93C5FD', message: '#DBEAFE', action: '#93C5FD', iconName: 'information-circle' };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const isDark = useColorScheme() === 'dark';

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const dismissingRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoTimer = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    if (dismissingRef.current || !current) return;
    dismissingRef.current = true;
    clearAutoTimer();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 30,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismissingRef.current = false;
      setCurrent(null);
    });
  }, [clearAutoTimer, current, opacity, translateY]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      setCurrent(next);
    }
  }, [current, queue]);

  useEffect(() => {
    if (!current) return;
    clearAutoTimer();
    opacity.setValue(0);
    translateY.setValue(24);
    iconScale.setValue(1);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    if (current.type === 'success') {
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.12, duration: 120, useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    }

    const duration = current.durationMs ?? (current.actionLabel ? ACTION_DURATION : DEFAULT_DURATION);
    autoTimerRef.current = setTimeout(() => {
      dismissToast();
    }, duration);

    return clearAutoTimer;
  }, [clearAutoTimer, current, dismissToast, iconScale, opacity, translateY]);

  useEffect(() => clearAutoTimer, [clearAutoTimer]);

  const showToast = useCallback((input: ShowToastInput) => {
    setQueue((prev) => [
      ...prev,
      {
        ...input,
        id: input.id ?? makeId(),
      },
    ]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      showSuccess: (message, title = 'Thành công') =>
        showToast({ type: 'success', title, message }),
      showError: (message, title = 'Có lỗi xảy ra', actionLabel, onAction) =>
        showToast({
          type: 'error',
          title,
          message: normalizeUserFacingErrorMessage(message),
          actionLabel,
          onAction,
        }),
      showWarning: (message, title = 'Cảnh báo') =>
        showToast({ type: 'warning', title, message }),
      showInfo: (message, title = 'Thông tin') =>
        showToast({ type: 'info', title, message }),
      showActionToast: (message, actionLabel, onAction, title = 'Thông tin') =>
        showToast({ type: 'info', title, message, actionLabel, onAction, durationMs: ACTION_DURATION }),
      dismissToast,
    }),
    [dismissToast, showToast]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) translateY.setValue(Math.min(40, g.dy / 2));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 24 || g.vy > 0.8) {
            dismissToast();
            return;
          }
          Animated.timing(translateY, {
            toValue: 0,
            duration: 120,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dismissToast, translateY]
  );

  const active = current;
  const colors = active ? palette(active.type, isDark) : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {active && colors && (
        <View pointerEvents="box-none" style={styles.portal}>
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.toast,
              {
                backgroundColor: colors.bg,
                opacity,
                transform: [{ translateY }],
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
              },
            ]}
          >
            <Animated.View style={{ transform: [{ scale: iconScale }] }}>
              <Ionicons name={colors.iconName} size={22} color={colors.icon} />
            </Animated.View>
            <View style={styles.content}>
              <Text style={[styles.title, { color: colors.title }]} numberOfLines={1}>
                {active.title}
              </Text>
              <Text style={[styles.message, { color: colors.message }]} numberOfLines={2}>
                {active.message}
              </Text>
            </View>
            {active.actionLabel ? (
              <Pressable
                onPress={() => {
                  active.onAction?.();
                  dismissToast();
                }}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              >
                <Text style={[styles.actionText, { color: colors.action }]}>{active.actionLabel}</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast phải được dùng bên trong ToastProvider');
  return ctx;
}

export const TOAST_EXAMPLES = {
  success: { title: 'Thành công', message: 'Đã thêm học sinh thành công' },
  error: { title: 'Có lỗi xảy ra', message: 'Không lưu được học sinh', actionLabel: 'Thử lại' },
  warning: { title: 'Cảnh báo', message: 'Một số trường chưa được điền' },
  info: { title: 'Thông tin', message: 'Bạn có thể thêm nhiều con' },
  action: { title: 'Thông tin', message: 'Đã xóa học sinh', actionLabel: 'Hoàn tác' },
};

const styles = StyleSheet.create({
  portal: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 96 : 84,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 30,
  },
  toast: {
    width: '90%',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  content: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 1,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  actionBtnPressed: {
    opacity: 0.65,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

