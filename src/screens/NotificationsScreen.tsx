import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  fetchNotifications,
  markNotificationAsRead,
} from '../api/notifications';
import { subscribeNotificationInboxChanged } from '../services/NotificationNavigationBus';

const MaterialIcons = require('@expo/vector-icons').MaterialIcons;

type NotificationItemUi = {
  recipientId: string;
  event: string;
  title: string;
  body: string;
  route: string | null;
  createdAt: string | null;
  isRead: boolean;
};

type NotificationMeta = {
  icon: string;
  chipBg: string;
  chipText: string;
};

type NotificationsScreenProps = {
  visible: boolean;
  onClose: () => void;
  onOpenRoute: (route: string | null) => void;
  onUnreadCountChanged?: () => void;
};

const EVENT_META: Record<string, NotificationMeta> = {
  CONSULTATION_CONFIRMED: { icon: 'event-available', chipBg: '#dcfce7', chipText: '#15803d' },
  CONSULTATION_CANCELLED: { icon: 'event-busy', chipBg: '#fee2e2', chipText: '#b91c1c' },
  CONSULTATION_COMPLETED: { icon: 'check-circle', chipBg: '#dbeafe', chipText: '#1d4ed8' },
  CONSULTATION_NO_SHOW: { icon: 'warning-amber', chipBg: '#ffedd5', chipText: '#c2410c' },
  SCHOOL_POST_PUBLISHED: { icon: 'article', chipBg: '#e0f2fe', chipText: '#0369a1' },
  ADMIN_POST_PUBLISHED: { icon: 'campaign', chipBg: '#f3e8ff', chipText: '#7e22ce' },
};

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function normalizeNotificationItem(raw: unknown): NotificationItemUi | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const data =
    src.data && typeof src.data === 'object'
      ? (src.data as Record<string, unknown>)
      : null;
  const recipientId =
    asString(src.recipientId) ??
    asString(src.id) ??
    asString(src.notificationRecipientId) ??
    '';
  if (!recipientId.trim()) return null;
  const event =
    asString(src.eventType) ??
    asString(src.event) ??
    asString(src.type) ??
    asString(data?.eventType) ??
    'UNKNOWN';
  const title = asString(src.title) ?? 'Thông báo mới';
  const body = asString(src.body) ?? asString(src.message) ?? '';
  const route =
    asString(src.route) ??
    asString(data?.route) ??
    asString(src.redirectRoute) ??
    asString(src.deeplink) ??
    asString(src.deepLink);
  const createdAt =
    asString(src.createdAt) ?? asString(src.createdDate) ?? asString(src.sentAt);
  const isRead = asBool(src.read) || asBool(src.isRead);
  return {
    recipientId,
    event,
    title,
    body,
    route: route?.trim() ? route.trim() : null,
    createdAt,
    isRead,
  };
}

function formatCreatedDate(isoDate: string | null): string {
  if (!isoDate) return 'Chưa có thời gian';
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return isoDate;
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function areItemsEqual(a: NotificationItemUi[], b: NotificationItemUi[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.recipientId !== right.recipientId ||
      left.event !== right.event ||
      left.title !== right.title ||
      left.body !== right.body ||
      left.route !== right.route ||
      left.createdAt !== right.createdAt ||
      left.isRead !== right.isRead
    ) {
      return false;
    }
  }
  return true;
}

export default function NotificationsScreen({
  visible,
  onClose,
  onOpenRoute,
  onUnreadCountChanged,
}: NotificationsScreenProps) {
  const [items, setItems] = useState<NotificationItemUi[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items]
  );

  const loadData = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const response = await fetchNotifications({ page: 0, pageSize: 20 });
      const rawItems = Array.isArray(response?.body?.items) ? response.body.items : [];
      const normalized = rawItems
        .map(normalizeNotificationItem)
        .filter((item): item is NotificationItemUi => item != null);
      setItems((prev) => (areItemsEqual(prev, normalized) ? prev : normalized));
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : 'Không thể tải thông báo');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void loadData('initial');
  }, [visible, loadData]);

  useEffect(() => {
    const unsubscribe = subscribeNotificationInboxChanged(() => {
      if (!visible) return;
      void loadData('silent');
      onUnreadCountChanged?.();
    });
    return unsubscribe;
  }, [loadData, onUnreadCountChanged, visible]);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    let inFlight = false;
    const tick = async () => {
      if (!mounted || inFlight) return;
      inFlight = true;
      try {
        await loadData('silent');
        onUnreadCountChanged?.();
      } finally {
        inFlight = false;
      }
    };
    const intervalId = setInterval(() => {
      void tick();
    }, 2000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [loadData, onUnreadCountChanged, visible]);

  const handleOpenItem = useCallback(
    async (item: NotificationItemUi) => {
      if (!item.isRead) {
        try {
          await markNotificationAsRead(item.recipientId);
          setItems((prev) =>
            prev.map((it) =>
              it.recipientId === item.recipientId ? { ...it, isRead: true } : it
            )
          );
          onUnreadCountChanged?.();
        } catch {
          // Nếu mark read thất bại vẫn cho phép điều hướng.
        }
      }
      onClose();
      onOpenRoute(item.route);
    },
    [onClose, onOpenRoute, onUnreadCountChanged]
  );

  const handleMarkAsRead = useCallback(
    async (item: NotificationItemUi) => {
      if (item.isRead) return;
      try {
        await markNotificationAsRead(item.recipientId);
        setItems((prev) =>
          prev.map((it) =>
            it.recipientId === item.recipientId ? { ...it, isRead: true } : it
          )
        );
        onUnreadCountChanged?.();
      } catch {
        // Không chặn trải nghiệm nếu request lỗi.
      }
    },
    [onUnreadCountChanged]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn} hitSlop={10}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Thông báo</Text>
          <Text style={styles.headerSubtitle}>{unreadCount} chưa đọc</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.recipientId}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadData('refresh')}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="small" color="#1976d2" />
              <Text style={styles.helperText}>Đang tải thông báo...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerWrap}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                style={styles.retryBtn}
                onPress={() => void loadData('initial')}
              >
                <Text style={styles.retryText}>Thử lại</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.centerWrap}>
              <MaterialIcons name="notifications-off" size={24} color="#94a3b8" />
              <Text style={styles.helperText}>Bạn chưa có thông báo nào</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const meta = EVENT_META[item.event] ?? {
            icon: 'notifications',
            chipBg: '#e2e8f0',
            chipText: '#334155',
          };
          return (
            <Pressable
              onPress={() => void handleOpenItem(item)}
              style={({ pressed }) => [
                styles.card,
                !item.isRead && styles.cardUnread,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: meta.chipBg }]}>
                <MaterialIcons name={meta.icon as any} size={20} color={meta.chipText} />
              </View>
              <View style={styles.contentWrap}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {!item.isRead ? <View style={styles.dot} /> : null}
                </View>
                <Text style={styles.body} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={styles.time}>{formatCreatedDate(item.createdAt)}</Text>
                {!item.isRead ? (
                  <Pressable
                    onPress={() => void handleMarkAsRead(item)}
                    style={({ pressed }) => [
                      styles.markReadBtn,
                      pressed && styles.markReadBtnPressed,
                    ]}
                  >
                    <Text style={styles.markReadBtnText}>Đánh dấu đã học</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  listContent: { padding: 16, gap: 10, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  cardUnread: {
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fbff',
  },
  cardPressed: { opacity: 0.9 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  body: { marginTop: 4, fontSize: 13, color: '#475569', lineHeight: 18 },
  time: { marginTop: 6, fontSize: 12, color: '#94a3b8' },
  dot: {
    marginTop: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  helperText: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: 2,
    borderRadius: 999,
    backgroundColor: '#1976d2',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  markReadBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markReadBtnPressed: {
    opacity: 0.85,
  },
  markReadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
});
