import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
const Ionicons = require('@expo/vector-icons').Ionicons;

import {
  buildPrivateChatPayload,
  connectWebSocket,
  disconnect,
  sendMessage,
  type PrivateMessageBody,
} from '../services/parentChatWebSocket';
import {
  fetchParentMessagesHistory,
  markConversationMessagesRead,
} from '../api/parentChat';
import { ApiError } from '../api/client';
import type { ChatMessage } from '../types/chat';
import { fetchParentStudents } from '../api/parentStudent';
import type { ParentStudentProfile } from '../types/studentProfile';

/** Kích thước icon attach / gửi — dùng chung để đồng nhất */
const INPUT_BAR_ICON_SIZE = 22;

type ChatScreenProps = {
  conversationId: string;
  /** Path GET /parent/messages/history/{parentEmail}/{campusId}/{studentProfileId} */
  campusId: string | number;
  studentProfileId: string | number;
  parentEmail: string;
  counsellorEmail: string;
  counsellorName?: string | null;
  counsellorAvatarUrl?: string | null;
  studentName?: string | null;
  /** Preview từ GET conversations khi GET history trả về rỗng (vẫn thấy tin trên list). */
  initialLastMessageContent?: string | null;
  initialLastMessageAt?: string | null;
  onBack: () => void;
};

function asString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function emailsEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function sanitizeReceiverEmail(v: string): string {
  const raw = (v ?? '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  if (normalized === 'n/a' || normalized === 'na' || normalized === 'none' || normalized === 'null') {
    return '';
  }
  return normalized.includes('@') ? raw : '';
}

/** seen > sent > sending — tránh poll/history ghi đè Seen → Delivered liên tục */
function rankStatus(s: ChatMessage['status'] | undefined): number {
  if (s === 'seen') return 3;
  if (s === 'sent') return 2;
  if (s === 'sending') return 1;
  return 0;
}

function pickBetterStatus(
  a: ChatMessage['status'] | undefined,
  b: ChatMessage['status'] | undefined
): ChatMessage['status'] | undefined {
  if (rankStatus(a) >= rankStatus(b)) return a ?? b;
  return b ?? a;
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

/**
 * Tin gửi tạo bubble `tmp-*`; khi history/WS trả cùng nội dung với `id` từ server, merge theo id sẽ
 * giữ cả hai — gỡ bản tmp khi đã có bản “thật” (cùng người gửi, cùng nội dung, gần thời gian).
 */
const OPTIMISTIC_DEDUPE_WINDOW_MS = 3 * 60 * 1000;

function dropOptimisticDuplicatesOfServer(messages: ChatMessage[], myEmail: string): ChatMessage[] {
  const tmps = messages.filter(
    (m) => String(m.id).startsWith('tmp-') && emailsEqual(m.senderEmail, myEmail)
  );
  if (tmps.length === 0) return messages;

  const serverMine = messages.filter(
    (m) =>
      !String(m.id).startsWith('tmp-') && emailsEqual(m.senderEmail, myEmail)
  );

  const usedServer = new Set<string>();
  const dropTmpIds = new Set<string>();

  for (const tmp of [...tmps].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
  )) {
    const match = serverMine.find(
      (s) =>
        !usedServer.has(s.id) &&
        s.content.trim() === tmp.content.trim() &&
        Math.abs(+new Date(s.createdAt) - +new Date(tmp.createdAt)) <= OPTIMISTIC_DEDUPE_WINDOW_MS
    );
    if (match) {
      dropTmpIds.add(tmp.id);
      usedServer.add(match.id);
    }
  }

  return messages.filter((m) => !dropTmpIds.has(m.id));
}

/**
 * Gộp theo id; tin của `myEmail` giữ status “mạnh” nhất (seen không bị API MESSAGE_SENT lật về Delivered).
 */
function mergeUniqueMessages(a: ChatMessage[], b: ChatMessage[], myEmail?: string): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of a) map.set(m.id, { ...m });
  for (const m of b) {
    const ex = map.get(m.id);
    if (!ex) {
      map.set(m.id, { ...m });
      continue;
    }
    const mine = myEmail && emailsEqual(m.senderEmail, myEmail);
    const status = mine
      ? pickBetterStatus(ex.status, m.status)
      : (m.status ?? ex.status);
    map.set(m.id, { ...ex, ...m, status });
  }
  const merged = Array.from(map.values()).sort(
    (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()
  );
  return myEmail ? dropOptimisticDuplicatesOfServer(merged, myEmail) : merged;
}

const LIST_PREVIEW_MESSAGE_ID = '_list_preview_';

function nestedObjectEmail(v: unknown): string | null {
  if (!v || typeof v !== 'object') return null;
  return asString((v as Record<string, unknown>).email);
}

function textFromBody(body: any): string | null {
  const raw =
    body?.content ??
    body?.message ??
    body?.text ??
    body?.body ??
    body?.messageContent ??
    body?.chatMessage;
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return null;
}

function historyMessagesFromBody(body: Record<string, unknown>): unknown[] {
  if (Array.isArray(body.messages)) return body.messages;
  if (Array.isArray(body.items)) return body.items;
  return [];
}

/** BE: MESSAGE_READ, … → ChatMessage.status cho label Seen / Delivered */
function mapHistoryStatusToUi(raw: unknown): ChatMessage['status'] | undefined {
  if (raw == null || raw === '') return undefined;
  const u = String(raw).toUpperCase();
  if (u === 'MESSAGE_READ' || u === 'READ' || u === 'SEEN') return 'seen';
  if (u === 'MESSAGE_SENT' || u === 'SENT' || u === 'DELIVERED') return 'sent';
  if (u.includes('PENDING') || u.includes('SENDING')) return 'sending';
  return undefined;
}

function normalizeIncomingMessage(body: any, fallbackConversationId: string): ChatMessage | null {
  const content = textFromBody(body);
  if (content == null || content === '') return null;

  const senderFromSenderField =
    typeof body?.sender === 'string'
      ? asString(body.sender)
      : nestedObjectEmail(body?.sender);

  const senderEmail =
    asString(body?.senderEmail) ??
    senderFromSenderField ??
    asString(body?.senderName) ??
    asString(body?.username) ??
    asString(body?.from) ??
    asString(body?.createdBy) ??
    asString(body?.authorEmail) ??
    asString(body?.userEmail) ??
    '';
  // Vẫn hiển thị bubble (có thể lệch trái/phải) thay vì nuốt cả tin khi BE thiếu sender
  const resolvedSender = senderEmail || 'unknown';

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
    senderEmail: resolvedSender,
    content,
    createdAt,
    status: mapHistoryStatusToUi(body?.status),
    clientMessageId: asString(body?.clientMessageId) ?? undefined,
  };
}

export default function ChatScreen({
  conversationId,
  campusId,
  studentProfileId,
  parentEmail,
  counsellorEmail,
  counsellorName,
  counsellorAvatarUrl,
  studentName,
  initialLastMessageContent,
  initialLastMessageAt,
  onBack,
}: ChatScreenProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const listRef = useRef<FlatList<any> | null>(null);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeConversationId, setActiveConversationId] = useState(String(conversationId));
  const chatContextRef = useRef({
    parentEmail,
    counsellorEmail,
    conversationId: String(conversationId),
    studentProfileId,
    campusId,
  });

  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [loadingLatest, setLoadingLatest] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursorId, setCursorId] = useState<string>(''); // cursor for the "next older" page

  const [inputText, setInputText] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [studentProfileVisible, setStudentProfileVisible] = useState(false);
  const [studentProfileLoading, setStudentProfileLoading] = useState(false);
  const [studentProfileData, setStudentProfileData] = useState<ParentStudentProfile | null>(null);
  const [expandedGradeBlocks, setExpandedGradeBlocks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setActiveConversationId(String(conversationId));
  }, [conversationId]);

  useEffect(() => {
    chatContextRef.current = {
      parentEmail,
      counsellorEmail,
      conversationId: activeConversationId,
      studentProfileId,
      campusId,
    };
  }, [activeConversationId, parentEmail, counsellorEmail, studentProfileId, campusId]);

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
          const res = await markConversationMessagesRead(activeConversationId, parentEmail);
          const readIdSet = new Set(
            Array.isArray(res?.body) ? res.body.map((item) => String(item.id)) : []
          );
          if (readIdSet.size > 0) {
            setMessages((prev) =>
              prev.map((m) =>
                readIdSet.has(String(m.id)) ? { ...m, status: pickBetterStatus(m.status, 'seen') } : m
              )
            );
          }
        } catch (e) {
          // Silence; marking read is best-effort
          void reason;
        }
      }, 350);
    },
    [activeConversationId, parentEmail]
  );

  const loadLatest = useCallback(async () => {
    setLoadingLatest(true);
    setLoadingMore(false);
    setHasMore(true);
    setChatError(null);
    try {
      if (__DEV__) {
        console.log('[ChatScreen] fetch history latest', {
          parentEmail,
          campusId: String(campusId),
          studentProfileId: String(studentProfileId),
          conversationId: String(activeConversationId),
        });
      }
      const res = await fetchParentMessagesHistory(parentEmail, campusId, studentProfileId);
      const resBody = res.body as Record<string, unknown>;
      const resolvedConversationId =
        asString(resBody.conversationId)?.trim() || String(activeConversationId);
      const rawItems = historyMessagesFromBody(resBody);
      const nextCursor: string | undefined = asString(resBody.nextCursorId) ?? undefined;
      const pageHasMore: boolean =
        typeof resBody?.hasMore === 'boolean' ? resBody.hasMore : Boolean(resBody?.hasMore);

      const normalized = (rawItems ?? [])
        .map((it) => normalizeIncomingMessage(it, resolvedConversationId))
        .filter((m): m is ChatMessage => !!m)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      setActiveConversationId(resolvedConversationId);

      if (normalized.length > 0) {
        setMessages(normalized);
      } else if (initialLastMessageContent?.trim()) {
        setMessages([
          {
            id: LIST_PREVIEW_MESSAGE_ID,
            conversationId: resolvedConversationId,
            senderEmail: counsellorEmail || 'unknown',
            content: initialLastMessageContent.trim(),
            createdAt: toISO(initialLastMessageAt) ?? new Date().toISOString(),
          },
        ]);
      } else {
        setMessages([]);
      }
      setHasMore(pageHasMore);
      setCursorId(nextCursor ?? '');
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));

      handleMarkRead('open');
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setChatError('Bạn không có quyền xem lịch sử hội thoại này. Vui lòng liên hệ quản trị viên.');
      } else {
        setChatError(e instanceof Error ? e.message : 'Không tải được lịch sử tin nhắn');
      }
      setMessages([]);
    } finally {
      setLoadingLatest(false);
    }
  }, [
    activeConversationId,
    campusId,
    handleMarkRead,
    initialLastMessageAt,
    initialLastMessageContent,
    parentEmail,
    studentProfileId,
  ]);

  const loadMoreOlder = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    if (!cursorId) return;
    setLoadingMore(true);
    try {
      if (__DEV__) {
        console.log('[ChatScreen] fetch history older', {
          parentEmail,
          campusId: String(campusId),
          studentProfileId: String(studentProfileId),
          conversationId: String(activeConversationId),
          cursorId: String(cursorId),
        });
      }
      const res = await fetchParentMessagesHistory(parentEmail, campusId, studentProfileId, cursorId);
      const resBody = res.body as Record<string, unknown>;
      const resolvedConversationId =
        asString(resBody.conversationId)?.trim() || String(activeConversationId);
      const rawItems = historyMessagesFromBody(resBody);
      const nextCursor: string | undefined = asString(resBody.nextCursorId) ?? undefined;
      const pageHasMore: boolean =
        typeof resBody?.hasMore === 'boolean' ? resBody.hasMore : Boolean(resBody?.hasMore);

      const normalizedOlder = (rawItems ?? [])
        .map((it) => normalizeIncomingMessage(it, resolvedConversationId))
        .filter((m): m is ChatMessage => !!m)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      setActiveConversationId(resolvedConversationId);

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
        return dropOptimisticDuplicatesOfServer(deduped, parentEmail);
      });

      setHasMore(pageHasMore);
      setCursorId(nextCursor ?? '');
    } catch (e) {
      if (__DEV__) {
        console.log('[ChatScreen] fetch history older failed', {
          parentEmail,
          campusId: String(campusId),
          studentProfileId: String(studentProfileId),
          conversationId: String(activeConversationId),
          cursorId: String(cursorId),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    } finally {
      setLoadingMore(false);
    }
  }, [
    campusId,
    cursorId,
    activeConversationId,
    hasMore,
    loadingMore,
    parentEmail,
    studentProfileId,
  ]);

  // Connect WS + initial history
  useEffect(() => {
    const onMessage = (body: PrivateMessageBody) => {
      const raw = body as Record<string, unknown> | null;
      if (!raw || typeof raw !== 'object') return;
      const incomingCid = raw.conversationId ?? (raw.conversation as { id?: unknown } | undefined)?.id;
      if (incomingCid == null || incomingCid === '') return;
      if (String(incomingCid) !== String(activeConversationId)) return;

      const normalized = normalizeIncomingMessage(body as any, activeConversationId);
      if (!normalized) return;

      setMessages((prev) => {
        const base = prev.filter((m) => m.id !== LIST_PREVIEW_MESSAGE_ID);
        const isMine = emailsEqual(normalized.senderEmail, parentEmail);
        if (base.some((m) => m.id === normalized.id)) return prev;

        if (isMine && normalized.clientMessageId) {
          const idx = base.findIndex((m) => m.clientMessageId === normalized.clientMessageId);
          if (idx >= 0) {
            const next = base.slice();
            next[idx] = {
              ...next[idx],
              id: normalized.id,
              status: pickBetterStatus(next[idx].status, normalized.status) ?? normalized.status ?? 'sent',
              createdAt: normalized.createdAt,
            };
            return dropOptimisticDuplicatesOfServer(next, parentEmail);
          }
        }

        if (isMine) {
          let stripped = false;
          const withoutTmp = base.filter((m) => {
            if (!String(m.id).startsWith('tmp-')) return true;
            if (!normalized.content || m.content.trim() !== normalized.content.trim()) return true;
            if (stripped) return true;
            stripped = true;
            return false;
          });
          if (stripped) {
            return mergeUniqueMessages(withoutTmp, [normalized], parentEmail);
          }
        }

        return dropOptimisticDuplicatesOfServer(
          [
            ...base,
            {
              ...normalized,
              status: isMine ? pickBetterStatus(undefined, normalized.status) ?? 'sent' : undefined,
            },
          ],
          parentEmail
        );
      });

      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
      handleMarkRead('new-message');
    };

    connectWebSocket(parentEmail, onMessage, (c) => setConnected(c));
    void loadLatest();

    return () => {
      disconnect();
    };
  }, [campusId, activeConversationId, handleMarkRead, loadLatest, parentEmail, studentProfileId]);

  /** WS trễ / lỡ — đồng bộ REST định kỳ khi màn hình đang active (giống web ~3.5s). */
  useEffect(() => {
    const tick = async () => {
      if (AppState.currentState !== 'active') return;
      const { parentEmail: pe, conversationId: cid, studentProfileId: sid, campusId: cps } =
        chatContextRef.current;
      if (!pe?.trim() || !cid || sid == null || String(sid).trim() === '' || cps == null || String(cps).trim() === '')
        return;
      try {
        if (__DEV__) {
          console.log('[ChatScreen] poll history', {
            parentEmail: pe,
            campusId: String(cps),
            studentProfileId: String(sid),
            conversationId: String(cid),
          });
        }
        const res = await fetchParentMessagesHistory(pe, cps, sid);
        const resBody = res.body as Record<string, unknown>;
        const resolvedConversationId = asString(resBody.conversationId)?.trim() || cid;
        const rawItems = historyMessagesFromBody(resBody);
        const normalized = (rawItems ?? [])
          .map((it) => normalizeIncomingMessage(it, resolvedConversationId))
          .filter((m): m is ChatMessage => !!m)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        setActiveConversationId(resolvedConversationId);

        setMessages((prev) => {
          if (normalized.length === 0) return prev;
          const base = prev.filter((m) => m.id !== LIST_PREVIEW_MESSAGE_ID);
          return mergeUniqueMessages(base, normalized, pe);
        });
        setHasMore(typeof resBody.hasMore === 'boolean' ? resBody.hasMore : Boolean(resBody?.hasMore));
        setCursorId(asString(resBody.nextCursorId) ?? '');
      } catch (e) {
        if (__DEV__) {
          console.log('[ChatScreen] poll history failed', {
            parentEmail: pe,
            campusId: String(cps),
            studentProfileId: String(sid),
            conversationId: String(cid),
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    };
    const intervalId = setInterval(() => {
      void tick();
    }, 3500);
    return () => clearInterval(intervalId);
  }, []);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    if (!activeConversationId) return;
    const receiver = sanitizeReceiverEmail(counsellorEmail);

    const tmpId = `tmp-${Date.now()}`;
    const nowISO = new Date().toISOString();

    const optimistic: ChatMessage = {
      id: tmpId,
      conversationId: activeConversationId,
      senderEmail: parentEmail,
      content: text,
      createdAt: nowISO,
      status: 'sending',
      clientMessageId: tmpId,
    };

    setMessages((prev) => [...prev, optimistic]);
    setInputText('');
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tmpId ? { ...m, status: pickBetterStatus(m.status, 'sent') } : m
        )
      );
    }, 500);

    sendMessage(
      buildPrivateChatPayload({
        conversationId: activeConversationId,
        message: text,
        senderName: parentEmail.trim(),
        receiverName: receiver,
        campusId,
        studentProfileId,
        clientMessageId: tmpId,
      })
    );
  }, [activeConversationId, campusId, counsellorEmail, inputText, parentEmail, studentProfileId]);

  const openStudentProfile = useCallback(async () => {
    setStudentProfileVisible(true);
    setStudentProfileLoading(true);
    setExpandedGradeBlocks({});
    try {
      const studentId = String(studentProfileId);
      const res = await fetchParentStudents();
      const matched =
        res.body.find((s) => String(s.id) === studentId) ??
        res.body.find((s) => (studentName?.trim() ? s.studentName === studentName.trim() : false)) ??
        null;
      setStudentProfileData(matched);
    } catch {
      setStudentProfileData(null);
    } finally {
      setStudentProfileLoading(false);
    }
  }, [studentName, studentProfileId]);

  const renderMessageItem = useCallback(
    ({ item, index }: { item: ChatMessage & { _chronoIndex: number }; index: number }) => {
      const isMine = emailsEqual(item.senderEmail, parentEmail);

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
            {counsellorAvatarUrl ? (
              <Image source={{ uri: counsellorAvatarUrl }} style={styles.headerAvatarImage} resizeMode="cover" />
            ) : (
              <Ionicons name="person" size={18} color="#fff" />
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerName, isDark && styles.headerNameDark]}>
              {counsellorName ?? 'Tư vấn'}
            </Text>
            <Text style={[styles.headerStatus, isDark && styles.headerStatusDark]}>
              {studentName?.trim()
                ? `Hồ sơ: ${studentName.trim()}`
                : 'Hồ sơ học sinh'}
            </Text>
            <Text style={[styles.headerPresence, isDark && styles.headerStatusDark]}>
              {connected ? 'Online' : 'Last seen recently'}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => void openStudentProfile()} hitSlop={10} style={styles.headerMenuBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color={isDark ? '#E5E7EB' : '#334155'} />
        </Pressable>
      </View>

      {loadingLatest ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : chatError ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={36} color={isDark ? '#fbbf24' : '#b45309'} />
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>{chatError}</Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubble-ellipses-outline" size={56} color={isDark ? '#475569' : '#94a3b8'} />
          <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>
            Start your conversation with a counsellor
          </Text>
        </View>
      ) : (
        <View style={styles.listWrap}>
        <FlatList
          ref={(r) => {
            listRef.current = r;
          }}
          style={styles.listFlex}
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
        </View>
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
            <Pressable
              style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.92 }, isDark && styles.sendBtnDark]}
              onPress={handleSend}
            >
              <Ionicons name="paper-plane" size={INPUT_BAR_ICON_SIZE} color="#fff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={studentProfileVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStudentProfileVisible(false)}
      >
        <View style={styles.profileBackdrop}>
          <Pressable style={styles.profileBackdropDismiss} onPress={() => setStudentProfileVisible(false)} />
          <View style={[styles.profileCard, isDark && styles.profileCardDark]}>
            <View style={styles.profileHeader}>
              <Text style={[styles.profileTitle, isDark && styles.headerNameDark]}>Hồ sơ học sinh</Text>
              <Pressable onPress={() => setStudentProfileVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={isDark ? '#E5E7EB' : '#475569'} />
              </Pressable>
            </View>
            {studentProfileLoading ? (
              <View style={styles.profileLoadingWrap}>
                <ActivityIndicator size="small" color="#1976d2" />
              </View>
            ) : studentProfileData ? (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.profileContent}>
                <Text style={[styles.profileField, isDark && styles.rowSubDark]}>
                  Họ tên: {studentProfileData.studentName || 'Đang cập nhật'}
                </Text>
                <Text style={[styles.profileField, isDark && styles.rowSubDark]}>
                  Giới tính: {studentProfileData.gender || 'Đang cập nhật'}
                </Text>
                <Text style={[styles.profileField, isDark && styles.rowSubDark]}>
                  Nhóm tính cách: {studentProfileData.personalityTypeCode || 'Đang cập nhật'}
                </Text>
                <Text style={[styles.profileField, isDark && styles.rowSubDark]}>
                  Ngành yêu thích: {studentProfileData.favouriteJob || 'Đang cập nhật'}
                </Text>
                {studentProfileData.academicInfos.length > 0 ? (
                  <View style={styles.profileScoresWrap}>
                    <Text style={[styles.profileSubTitle, isDark && styles.headerNameDark]}>Điểm theo từng khối</Text>
                    {studentProfileData.academicInfos.map((block, idx) => {
                      const gradeKey = `${block.gradeLevel || 'Khoi'}-${idx}`;
                      const expanded = !!expandedGradeBlocks[gradeKey];
                      return (
                        <View key={gradeKey} style={[styles.gradeBlockCard, isDark && styles.gradeBlockCardDark]}>
                          <Pressable
                            onPress={() =>
                              setExpandedGradeBlocks((prev) => ({
                                ...prev,
                                [gradeKey]: !prev[gradeKey],
                              }))
                            }
                            style={styles.gradeBlockHeader}
                          >
                            <Text style={[styles.gradeBlockTitle, isDark && styles.headerNameDark]}>
                              {block.gradeLevel || `Khối ${idx + 1}`}
                            </Text>
                            <View style={styles.gradeBlockHeaderRight}>
                              <Text style={[styles.gradeBlockCount, isDark && styles.rowSubDark]}>
                                {block.subjectResults.length} môn
                              </Text>
                              <Ionicons
                                name={expanded ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color={isDark ? '#E5E7EB' : '#475569'}
                              />
                            </View>
                          </Pressable>
                          {expanded ? (
                            <View style={styles.gradeSubjectsWrap}>
                              {block.subjectResults.map((subject, sidx) => (
                                <View key={`${gradeKey}-${subject.subjectName}-${sidx}`} style={styles.gradeSubjectRow}>
                                  <Text style={[styles.gradeSubjectName, isDark && styles.rowSubDark]}>
                                    {subject.subjectName}
                                  </Text>
                                  <Text style={[styles.gradeSubjectScore, isDark && styles.headerNameDark]}>
                                    {subject.score}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                          {expanded && block.subjectResults.length === 0 ? (
                            <Text style={[styles.profileEmpty, isDark && styles.rowSubDark]}>
                              Chưa có dữ liệu điểm.
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </ScrollView>
            ) : (
              <Text style={[styles.profileEmpty, isDark && styles.rowSubDark]}>
                Không tải được hồ sơ học sinh. Vui lòng thử lại.
              </Text>
            )}
          </View>
        </View>
      </Modal>
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

  headerCenter: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1976d2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: { width: '100%', height: '100%' },
  headerText: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  headerNameDark: { color: '#E5E7EB' },
  headerStatus: { marginTop: 2, fontSize: 12, color: '#64748b' },
  headerPresence: { marginTop: 2, fontSize: 11, color: '#94a3b8' },
  headerStatusDark: { color: '#94a3b8' },
  headerMenuBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    marginTop: 10,
    paddingHorizontal: 20,
    textAlign: 'center',
    color: '#92400e',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  errorTextDark: { color: '#fbbf24' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#64748b', textAlign: 'center' },
  emptyTitleDark: { color: '#94a3b8' },

  listWrap: { flex: 1, minHeight: 0 },
  listFlex: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, flexGrow: 1 },

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

  loadingMore: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  loadingMoreText: { marginTop: 8, color: '#64748b', fontWeight: '700', fontSize: 12 },
  loadingMoreTextDark: { color: '#94a3b8' },
  loadingMoreSpacer: { height: 18 },
  profileBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  profileBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  profileCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '65%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  profileCardDark: {
    backgroundColor: '#0f172a',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  profileTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  profileLoadingWrap: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileContent: {
    maxHeight: 320,
  },
  profileField: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 8,
    lineHeight: 20,
  },
  profileEmpty: {
    fontSize: 13,
    color: '#64748b',
  },
  profileScoresWrap: {
    marginTop: 8,
    gap: 8,
  },
  profileSubTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  gradeBlockCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  gradeBlockCardDark: {
    backgroundColor: '#111827',
    borderColor: '#334155',
  },
  gradeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gradeBlockHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gradeBlockTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  gradeBlockCount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  gradeSubjectsWrap: {
    gap: 6,
  },
  gradeSubjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gradeSubjectName: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
  },
  gradeSubjectScore: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1976d2',
  },
});

