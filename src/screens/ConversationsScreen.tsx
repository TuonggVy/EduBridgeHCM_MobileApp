import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';

const Ionicons = require('@expo/vector-icons').Ionicons;

import { fetchParentConversations } from '../api/parentChat';
import type { ParentConversationsItem } from '../types/chat';

type ConversationsScreenProps = {
  parentEmail: string;
  onBack: () => void;
  onOpenChat: (conversation: ParentConversationsItem) => void;
  /** false khi nhúng trong bottom tab — header/back do màn shell hiển thị */
  showNavigationHeader?: boolean;
};

function asString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function normalizeConversations(raw: unknown): ParentConversationsItem[] {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : (raw as any)?.items ?? (raw as any)?.body?.items ?? [];

  return (arr ?? []).map((it: any) => {
    // Giống web Header.jsx normalizeConversation + resolveConversationEmails
    const conversationId =
      asString(it?.conversationId) ??
      asString(it?.id) ??
      asString(it?.conversation?.id) ??
      '';

    const counsellorEmail =
      asString(it?.counsellorEmail) ??
      asString(it?.otherUser) ??
      asString(it?.schoolEmail) ??
      asString(it?.participantCounsellorEmail) ??
      asString(it?.participantEmail) ??
      '';

    // Người được hiển thị ở tiêu đề chat nên là Counsoller (không ưu tiên student/child).
    const studentName = asString(it?.studentName) ?? null;

    const counsellorName =
      asString(it?.counsellorName) ??
      asString(it?.schoolName) ??
      asString(it?.name) ??
      asString(it?.participantName) ??
      asString(it?.title) ??
      asString(it?.otherUser) ??
      null;

    const participantParentEmail =
      asString(it?.parentEmail) ?? asString(it?.participantParentEmail) ?? null;

    const unreadCount =
      typeof it?.unreadCount === 'number'
        ? it.unreadCount
        : typeof it?.unreadCount === 'string'
          ? Number(it.unreadCount)
          : typeof it?.unreadMessages === 'number'
            ? it.unreadMessages
            : typeof it?.unreadMessages === 'string'
              ? Number(it.unreadMessages)
              : undefined;

    let lastMessageContent: string | null = null;
    let lastMessageAt: string | null = null;
    if (it?.lastMessage == null) {
      lastMessageContent = asString(it?.latestMessage);
    } else if (typeof it.lastMessage === 'string') {
      lastMessageContent = it.lastMessage;
    } else {
      lastMessageContent =
        asString(it?.lastMessage?.content) ??
        asString(it?.lastMessage?.message) ??
        asString(it?.lastMessage?.text) ??
        null;
      lastMessageAt =
        asString(it?.lastMessage?.createdAt) ??
        asString(it?.lastMessage?.timestamp) ??
        asString(it?.lastMessage?.updatedAt) ??
        asString(it?.lastMessageTime) ??
        asString(it?.time) ??
        null;
    }
    if (!lastMessageAt) {
      lastMessageAt =
        asString(it?.updatedAt) ?? asString(it?.lastMessageTime) ?? asString(it?.time) ?? null;
    }

    const studentProfileIdRaw = it?.studentId ?? it?.studentProfileId;
    const studentProfileId =
      typeof studentProfileIdRaw === 'number'
        ? studentProfileIdRaw
        : typeof studentProfileIdRaw === 'string'
          ? studentProfileIdRaw
          : undefined;

    const campusIdRaw = it?.campusId;
    const campusId =
      typeof campusIdRaw === 'number'
        ? campusIdRaw
        : typeof campusIdRaw === 'string'
          ? campusIdRaw
          : undefined;

    const schoolIdRaw = it?.schoolId;
    const schoolId =
      typeof schoolIdRaw === 'number'
        ? schoolIdRaw
        : typeof schoolIdRaw === 'string'
          ? schoolIdRaw
          : undefined;

    return {
      conversationId,
      studentProfileId,
      campusId,
      schoolId,
      schoolName: asString(it?.schoolName) ?? null,
      schoolLogoUrl: asString(it?.schoolLogoUrl) ?? null,
      status: asString(it?.status) ?? null,
      counsellorEmail,
      counsellorName,
      studentName,
      participantParentEmail,
      counsellorAvatarUrl: asString(it?.counsellorAvatarUrl) ?? asString(it?.avatarUrl) ?? null,
      unreadCount: typeof unreadCount === 'number' && !Number.isNaN(unreadCount) ? unreadCount : undefined,
      lastMessageContent,
      lastMessageAt,
    };
  });
}

/** Tránh hai dòng cùng cuộc (API/refresh) — giữ bản có `lastMessageAt` mới hơn. */
function dedupeConversations(items: ParentConversationsItem[]): ParentConversationsItem[] {
  const map = new Map<string, ParentConversationsItem>();
  for (const it of items) {
    const key = `${it.conversationId}|${String(it.studentProfileId ?? '')}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, it);
      continue;
    }
    const tPrev = prev.lastMessageAt ? +new Date(prev.lastMessageAt) : 0;
    const tCur = it.lastMessageAt ? +new Date(it.lastMessageAt) : 0;
    map.set(key, tCur >= tPrev ? it : prev);
  }
  return Array.from(map.values());
}

export default function ConversationsScreen({
  parentEmail,
  onBack,
  onOpenChat,
  showNavigationHeader = true,
}: ConversationsScreenProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ParentConversationsItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchParentConversations();
      setItems(dedupeConversations(normalizeConversations(res)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không tải được danh sách cuộc trò chuyện';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void parentEmail; // reserved if BE needs it
    void load();
  }, [parentEmail, load]);

  return (
    <View style={[styles.screen, isDark && styles.screenDark]}>
      {showNavigationHeader ? (
        <View style={[styles.header, isDark && styles.headerDark]}>
          <View style={styles.headerInner}>
            <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
              <Ionicons
                name="chevron-back"
                size={24}
                color={isDark ? '#E5E7EB' : '#0f172a'}
              />
            </Pressable>
            <Text style={[styles.title, isDark && styles.titleDark]}>Tin nhắn</Text>
            <View style={styles.headerRight} />
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items.filter(
            (it) =>
              !!it.conversationId &&
              !!it.counsellorEmail &&
              it.campusId != null &&
              String(it.campusId).trim() !== '' &&
              it.studentProfileId != null &&
              String(it.studentProfileId).trim() !== ''
          )}
          keyExtractor={(it) => it.conversationId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const unread = item.unreadCount ?? 0;
            return (
              <Pressable
                onPress={() => onOpenChat(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed, isDark && styles.rowDark]}
              >
                <View style={styles.avatar}>
                  <Ionicons name="person" size={18} color={isDark ? '#CBD5E1' : '#1976d2'} />
                </View>
                <View style={styles.rowMain}>
                  <View style={styles.rowTop}>
                    <Text numberOfLines={1} style={[styles.rowTitle, isDark && styles.rowTitleDark]}>
                      {item.counsellorName ?? item.counsellorEmail ?? 'Tư vấn'}
                    </Text>
                    {unread > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={[styles.rowSub, isDark && styles.rowSubDark]}>
                    {item.lastMessageContent ?? 'Chưa có tin nhắn'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#334155' : '#94a3b8'} />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={44} color={isDark ? '#475569' : '#94a3b8'} />
              <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>
                Start your conversation with a counsellor
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  screenDark: { backgroundColor: '#0F172A' },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerDark: {
    backgroundColor: '#0F172A',
    borderBottomColor: 'rgba(148,163,184,0.2)',
  },
  headerInner: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#0f172a', fontSize: 18, fontWeight: '800', flex: 1, marginLeft: 8 },
  titleDark: { color: '#E5E7EB' },
  headerRight: { width: 36 },

  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  rowPressed: { opacity: 0.9 },
  rowDark: { backgroundColor: '#111827' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  rowTitleDark: { color: '#E5E7EB' },
  rowSub: { marginTop: 4, fontSize: 13, color: '#64748b' },
  rowSubDark: { color: '#94a3b8' },

  badge: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1976d2',
    borderRadius: 9999,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  errorText: { color: '#dc2626', fontWeight: '700', textAlign: 'center' },
  errorTextDark: { color: '#F87171' },
  retryBtn: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#1976d2', borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '800' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#64748b', textAlign: 'center' },
  emptyTitleDark: { color: '#94a3b8' },
});

