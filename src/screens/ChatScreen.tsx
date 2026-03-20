import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
const Ionicons = require('@expo/vector-icons').Ionicons;

import { connectWebSocket, disconnect, sendMessage, type PrivateMessageBody } from '../services/parentChatWebSocket';
import {
  fetchParentMessagesHistory,
  markConversationMessagesRead,
} from '../api/parentChat';
import type { ChatMessage } from '../types/chat';

/** Kích thước icon attach / gửi — dùng chung để đồng nhất */
const INPUT_BAR_ICON_SIZE = 22;

type ChatScreenProps = {
  conversationId: string;
  parentEmail: string;
  counsellorEmail: string;
  counsellorName?: string | null;
  counsellorAvatarUrl?: string | null;
  onBack: () => void;
};

function asString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function toISO(v: unknown): string {
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDayLabel(date: Date): string {
  const today = new Date();
  const dKey = dayKey(date);
  const tKey = dayKey(today);

  if (dKey === tKey) return 'Today';

  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (dayKey(y) === dKey) return 'Yesterday';

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

function normalizeIncomingMessage(body: any, fallbackConversationId: string): ChatMessage | null {
  const content = asString(
    body?.content ??
      body?.message ??
      body?.text ??
      body?.body ??
      body?.messageContent ??
      body?.chatMessage
  );
  if (!content || typeof content !== 'string') return null;

  const senderEmail =
    asString(body?.senderEmail) ??
    asString(body?.sender) ??
    asString(body?.username) ??
    asString(body?.from) ??
    '';
  if (!senderEmail) return null;

  const conversationId =
    asString(body?.conversationId) ??
    asString(body?.conversationID) ??
    asString(body?.conversation_id) ??
    fallbackConversationId;

  const id =
    asString(body?.id) ??
    asString(body?.messageId) ??
    asString(body?.uuid) ??
    (asString(body?.clientMessageId) ? `srv-${asString(body.clientMessageId)}` : `m-${Date.now()}-${Math.random()}`);

  const createdAt = toISO(
    body?.createdAt ??
      body?.timestamp ??
      body?.time ??
      body?.sentAt ??
      body?.date ??
      new Date().toISOString()
  );

  return {
    id,
    conversationId,
    senderEmail,
    content,
    createdAt,
    status: body?.status as any,
    clientMessageId: asString(body?.clientMessageId) ?? undefined,
  };
}

export default function ChatScreen({
  conversationId,
  parentEmail,
  counsellorEmail,
  counsellorName,
  onBack,
}: ChatScreenProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const listRef = useRef<FlatList<any> | null>(null);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [loadingLatest, setLoadingLatest] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursorId, setCursorId] = useState<string>(''); // cursor for the "next older" page

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingDotIndex, setTypingDotIndex] = useState(0);

  const displayMessages = useMemo(() => {
    // For inverted FlatList: we want newest at bottom, so reverse data.
    return messages
      .map((m, chronoIndex) => ({ ...m, _chronoIndex: chronoIndex }))
      .slice()
      .reverse();
  }, [messages]);

  const handleMarkRead = useCallback(
    async (reason: 'open' | 'focus' | 'scroll' | 'new-message') => {
      // Avoid spamming PUT read endpoint
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
      markReadTimerRef.current = setTimeout(async () => {
        try {
          await markConversationMessagesRead(conversationId, parentEmail);
          setMessages((prev) =>
            prev.map((m) => (m.senderEmail === parentEmail ? { ...m, status: 'seen' } : m))
          );
        } catch (e) {
          // Silence; marking read is best-effort
          void reason;
        }
      }, 350);
    },
    [conversationId, parentEmail]
  );

  const loadLatest = useCallback(async () => {
    setLoadingLatest(true);
    setLoadingMore(false);
    setHasMore(true);
    try {
      // BE: GET .../history/{parentEmail}/{counsellorEmail} returns `body.messages`
      const res = await fetchParentMessagesHistory(parentEmail, counsellorEmail);
      const resBody = (res as any)?.body ?? res;
      const rawItems: any[] = resBody?.messages ?? resBody?.items ?? [];
      const nextCursor: string | undefined =
        asString(resBody?.nextCursorId) ?? asString(resBody?.nextCursor) ?? undefined;
      const pageHasMore: boolean =
        typeof resBody?.hasMore === 'boolean' ? resBody.hasMore : Boolean(resBody?.hasMore);

      const normalized = (rawItems ?? [])
        .map((it) => normalizeIncomingMessage(it, conversationId))
        .filter((m): m is ChatMessage => !!m)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      setMessages(normalized);
      setHasMore(pageHasMore);
      setCursorId(nextCursor ?? '');
      // Auto-scroll to bottom after first render
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));

      handleMarkRead('open');
    } finally {
      setLoadingLatest(false);
    }
  }, [counsellorEmail, conversationId, handleMarkRead, parentEmail]);

  const loadMoreOlder = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    if (!cursorId) return;
    setLoadingMore(true);
    try {
      const res = await fetchParentMessagesHistory(parentEmail, counsellorEmail, cursorId);
      const resBody = (res as any)?.body ?? res;
      const rawItems: any[] = resBody?.messages ?? resBody?.items ?? [];
      const nextCursor: string | undefined =
        asString(resBody?.nextCursorId) ?? asString(resBody?.nextCursor) ?? undefined;
      const pageHasMore: boolean =
        typeof resBody?.hasMore === 'boolean' ? resBody.hasMore : Boolean(resBody?.hasMore);

      const normalizedOlder = (rawItems ?? [])
        .map((it) => normalizeIncomingMessage(it, conversationId))
        .filter((m): m is ChatMessage => !!m)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      setMessages((prev) => {
        const next = [...normalizedOlder, ...prev];
        // De-duplicate by id
        const seen = new Set<string>();
        const deduped: ChatMessage[] = [];
        for (const m of next) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          deduped.push(m);
        }
        return deduped;
      });

      setHasMore(pageHasMore);
      setCursorId(nextCursor ?? '');
    } finally {
      setLoadingMore(false);
    }
  }, [counsellorEmail, cursorId, conversationId, hasMore, loadingMore, parentEmail]);

  // Connect WS + initial history
  useEffect(() => {
    const onMessage = (body: PrivateMessageBody) => {
      const normalized = normalizeIncomingMessage(body as any, conversationId);
      if (!normalized) return;

      setMessages((prev) => {
        const isMine = normalized.senderEmail === parentEmail;
        const alreadyExists = prev.some((m) => m.id === normalized.id);

        if (alreadyExists) return prev;

        // Try to match optimistic message by clientMessageId
        if (isMine && normalized.clientMessageId) {
          const idx = prev.findIndex((m) => m.clientMessageId === normalized.clientMessageId);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = { ...next[idx], id: normalized.id, status: 'sent', createdAt: normalized.createdAt };
            return next;
          }
        }

        return [...prev, { ...normalized, status: isMine ? 'sent' : undefined }];
      });

      // Auto-scroll + mark read when user is at bottom (we always scroll to bottom on new msg)
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
      handleMarkRead('new-message');
    };

    connectWebSocket(parentEmail, onMessage, (c) => setConnected(c));
    void loadLatest();

    return () => {
      disconnect();
    };
  }, [counsellorEmail, conversationId, handleMarkRead, loadLatest, parentEmail]);

  // Typing indicator (local)
  useEffect(() => {
    if (!inputText.trim()) {
      setIsTyping(false);
      return;
    }
    setIsTyping(true);
    const t = setTimeout(() => setIsTyping(false), 1200);
    return () => clearTimeout(t);
  }, [inputText]);

  useEffect(() => {
    if (!isTyping) return;
    const id = setInterval(() => {
      setTypingDotIndex((v) => (v + 1) % 3);
    }, 300);
    return () => clearInterval(id);
  }, [isTyping]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    if (!counsellorEmail || !conversationId) return;

    const tmpId = `tmp-${Date.now()}`;
    const nowISO = new Date().toISOString();

    const optimistic: ChatMessage = {
      id: tmpId,
      conversationId,
      senderEmail: parentEmail,
      content: text,
      createdAt: nowISO,
      status: 'sending',
      clientMessageId: tmpId,
    };

    setMessages((prev) => [...prev, optimistic]);
    setInputText('');
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));

    // Mark as sent optimistically; exact state depends on backend echo
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === tmpId ? { ...m, status: 'sent' } : m))
      );
    }, 500);

    sendMessage({
      conversationId,
      receiver: counsellorEmail,
      sender: parentEmail,
      content: text,
      clientMessageId: tmpId,
    });
  }, [counsellorEmail, conversationId, inputText, parentEmail]);

  const renderMessageItem = useCallback(
    ({ item, index }: { item: ChatMessage & { _chronoIndex: number }; index: number }) => {
      const isMine = item.senderEmail === parentEmail;

      const above = displayMessages[index + 1] as (ChatMessage & { _chronoIndex: number }) | undefined;
      const showDateSeparator = (() => {
        if (!above) return true; // very top
        const curD = new Date(item.createdAt);
        const aboveD = new Date(above.createdAt);
        return dayKey(curD) !== dayKey(aboveD);
      })();

      const created = new Date(item.createdAt);

      return (
        <View>
          {showDateSeparator ? (
            <View style={styles.dateSep}>
              <Text style={[styles.dateSepText, isDark && styles.dateSepTextDark]}>{formatDayLabel(created)}</Text>
            </View>
          ) : null}

          <View style={[styles.row, isMine ? styles.rowRight : styles.rowLeft]}>
            <View
              style={[
                styles.bubbleBase,
                isMine
                  ? styles.bubbleMine
                  : isDark
                    ? styles.bubbleCounsellorDark
                    : styles.bubbleCounsellor,
                isDark && styles.bubbleDark,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  isMine
                    ? styles.bubbleTextMine
                    : isDark
                      ? styles.bubbleTextCounsellorDark
                      : styles.bubbleTextCounsellor,
                ]}
              >
                {item.content}
              </Text>
              <View style={styles.metaRow}>
                <Text style={[styles.metaTime, isDark && styles.metaTimeDark]}>{formatTime(created)}</Text>
                {isMine && item.status ? (
                  <Text style={[styles.metaStatus, isDark && styles.metaTimeDark]}>
                    {item.status === 'seen' ? 'Seen' : item.status === 'sent' ? 'Delivered' : 'Sending'}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      );
    },
    [displayMessages, isDark, parentEmail]
  );

  return (
    <SafeAreaView style={[styles.screen, isDark && styles.screenDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#E5E7EB' : '#0f172a'} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Ionicons name="person" size={18} color="#fff" />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerName, isDark && styles.headerNameDark]}>
              {counsellorName ?? 'Tư vấn'}
            </Text>
            <Text style={[styles.headerStatus, isDark && styles.headerStatusDark]}>
              {connected ? 'Online' : 'Last seen recently'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable hitSlop={10} style={styles.iconBtn} onPress={() => {}}>
            <Ionicons name="call-outline" size={18} color={isDark ? '#E5E7EB' : '#334155'} />
          </Pressable>
          <Pressable hitSlop={10} style={styles.iconBtn} onPress={() => {}}>
            <Ionicons name="videocam-outline" size={18} color={isDark ? '#E5E7EB' : '#334155'} />
          </Pressable>
        </View>
      </View>

      {loadingLatest ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubble-ellipses-outline" size={56} color={isDark ? '#475569' : '#94a3b8'} />
          <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>
            Start your conversation with a counsellor
          </Text>
        </View>
      ) : (
        <FlatList
          ref={(r) => {
            listRef.current = r;
          }}
          data={displayMessages}
          keyExtractor={(it) => it.id}
          renderItem={renderMessageItem}
          inverted
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.1}
          onEndReached={() => {
            void loadMoreOlder();
          }}
          ListFooterComponent={
            hasMore ? (
              loadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={isDark ? '#90caf9' : '#1976d2'} />
                  <Text style={[styles.loadingMoreText, isDark && styles.loadingMoreTextDark]}>
                    Loading more...
                  </Text>
                </View>
              ) : (
                <View style={styles.loadingMoreSpacer} />
              )
            ) : (
              <View style={styles.loadingMoreSpacer} />
            )
          }
          onScroll={(e) => {
            // With inverted list: bottom of chat is near offset=0
            const y = e.nativeEvent.contentOffset.y;
            if (y <= 8) handleMarkRead('scroll');
          }}
          scrollEventThrottle={250}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.inputWrap, isDark && styles.inputWrapDark]}
      >
        <View style={[styles.inputRow, isDark && styles.inputRowDark]}>
          <Pressable style={styles.leftIcon} hitSlop={10} onPress={() => {}}>
            <Ionicons
              name="attach-outline"
              size={INPUT_BAR_ICON_SIZE}
              color={isDark ? '#E5E7EB' : '#334155'}
            />
          </Pressable>

          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            placeholder="Type a message..."
            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
            value={inputText}
            onChangeText={(t) => setInputText(t)}
            onFocus={() => handleMarkRead('focus')}
            multiline
          />

          <View style={styles.rightIcons}>
            {isTyping ? (
              <View style={styles.typingWrap}>
                {[0, 1, 2].map((i) => {
                  const active = i === typingDotIndex;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: isDark ? '#90caf9' : '#1976d2',
                          opacity: active ? 1 : 0.35,
                          transform: [{ translateY: active ? -3 : 0 }],
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.92 }, isDark && styles.sendBtnDark]}
              onPress={handleSend}
            >
              <Ionicons name="paper-plane" size={INPUT_BAR_ICON_SIZE} color="#fff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  screenDark: { backgroundColor: '#0F172A' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.25)',
    backgroundColor: '#fff',
  },
  headerDark: { backgroundColor: '#0B1220', borderBottomColor: 'rgba(148,163,184,0.18)' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1976d2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  headerNameDark: { color: '#E5E7EB' },
  headerStatus: { marginTop: 2, fontSize: 12, color: '#64748b' },
  headerStatusDark: { color: '#94a3b8' },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(25,118,210,0.08)', alignItems: 'center', justifyContent: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#64748b', textAlign: 'center' },
  emptyTitleDark: { color: '#94a3b8' },

  listContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },

  dateSep: { alignItems: 'center', marginVertical: 8 },
  dateSepText: { backgroundColor: 'rgba(148,163,184,0.18)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999, fontSize: 12, fontWeight: '700', color: '#475569' },
  dateSepTextDark: { backgroundColor: 'rgba(148,163,184,0.14)', color: '#90caf9' },

  row: { marginVertical: 6 },
  rowRight: { alignItems: 'flex-end' },
  rowLeft: { alignItems: 'flex-start' },

  bubbleBase: {
    maxWidth: '70%',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  bubbleMine: { backgroundColor: '#1976d2' },
  bubbleCounsellor: { backgroundColor: '#E5E7EB' },
  bubbleCounsellorDark: { backgroundColor: '#1F2937' },
  bubbleDark: { shadowOpacity: 0.12 },
  bubbleText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  bubbleTextMine: { color: '#fff' },
  bubbleTextCounsellor: { color: '#0f172a' },
  bubbleTextCounsellorDark: { color: '#E5E7EB' },

  metaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  metaTime: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  metaTimeDark: { color: 'rgba(255,255,255,0.75)' },
  metaStatus: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },

  inputWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.2)',
    backgroundColor: '#fff',
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
  },
  inputWrapDark: { backgroundColor: '#0B1220', borderTopColor: 'rgba(148,163,184,0.18)' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  inputRowDark: {},

  leftIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(25,118,210,0.08)' },

  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  inputDark: { backgroundColor: '#111827', color: '#E5E7EB' },

  rightIcons: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1976d2', alignItems: 'center', justifyContent: 'center' },
  sendBtnDark: { backgroundColor: '#1976d2' },

  typingWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 9999, opacity: 0.6 },

  loadingMore: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  loadingMoreText: { marginTop: 8, color: '#64748b', fontWeight: '700', fontSize: 12 },
  loadingMoreTextDark: { color: '#94a3b8' },
  loadingMoreSpacer: { height: 18 },
});

