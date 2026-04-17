import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

const Ionicons = require('@expo/vector-icons').Ionicons;

import { postAiAssistantChat } from '../api/aiAssistantChat';
import type {
  AiChatAssistantMessage,
  AiChatErrorMessage,
  AiChatStoredMessage,
  AiChatUserMessage,
} from '../types/aiChat';

const COLORS = {
  bg: '#f0f7ff',
  white: '#ffffff',
  primary: '#1976d2',
  primarySoft: 'rgba(25,118,210,0.12)',
  text: '#0f172a',
  textMuted: '#64748b',
  border: 'rgba(148,163,184,0.35)',
  aiBubble: '#ffffff',
  aiBubbleBorder: 'rgba(148,163,184,0.25)',
  chipBg: '#ffffff',
  skeleton: '#e2e8f0',
  online: '#22c55e',
};

const PLACEHOLDER = 'Hỏi về trường học...';

const SUGGESTED_CHIPS = [
  'Cơ sở vật chất trường Nam Việt?',
  'Học phí bao nhiêu?',
  'Chương trình học là gì?',
];

function storageKey(sessionId: string): string {
  return `@edubridge_ai_assistant_v1:${sessionId.trim().toLowerCase()}`;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildCopyText(m: AiChatAssistantMessage): string {
  const lines: string[] = [m.summary.trim()];
  for (const row of m.details) {
    lines.push(`${row.label}: ${row.value}`);
  }
  if (m.source?.trim()) lines.push(m.source.trim());
  return lines.filter(Boolean).join('\n');
}

function FadeInBubble({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

function TypingDots() {
  const a1 = useRef(new Animated.Value(0.35)).current;
  const a2 = useRef(new Animated.Value(0.35)).current;
  const a3 = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 320, useNativeDriver: true }),
        ])
      );
    const l1 = mk(a1, 0);
    const l2 = mk(a2, 120);
    const l3 = mk(a3, 240);
    l1.start();
    l2.start();
    l3.start();
    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [a1, a2, a3]);
  return (
    <View style={styles.typingRow}>
      <Animated.View style={[styles.typingDot, { opacity: a1 }]} />
      <Animated.View style={[styles.typingDot, { opacity: a2 }]} />
      <Animated.View style={[styles.typingDot, { opacity: a3 }]} />
    </View>
  );
}

function AiSkeletonBubble() {
  return (
    <FadeInBubble>
      <View style={[styles.aiBubble, styles.skeletonBubble]}>
        <View style={[styles.skelLine, { width: '92%' }]} />
        <View style={[styles.skelLine, { width: '78%' }]} />
        <View style={[styles.skelLine, { width: '64%' }]} />
      </View>
    </FadeInBubble>
  );
}

export type AiAssistantChatScreenProps = {
  /** sessionId theo API — email phụ huynh */
  sessionId: string;
  onBack: () => void;
};

export default function AiAssistantChatScreen({ sessionId, onBack }: AiAssistantChatScreenProps) {
  const listRef = useRef<FlatList<AiChatStoredMessage> | null>(null);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<AiChatStoredMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [awaitingAssistant, setAwaitingAssistant] = useState(false);

  const trimmedSession = sessionId.trim();
  const canSend = trimmedSession.length > 0 && inputText.trim().length > 0 && !awaitingAssistant;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!trimmedSession) {
        setMessages([]);
        setHydrated(true);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(storageKey(trimmedSession));
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            setMessages(parsed as AiChatStoredMessage[]);
          }
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trimmedSession]);

  useEffect(() => {
    if (!hydrated || !trimmedSession) return;
    const t = setTimeout(() => {
      void AsyncStorage.setItem(storageKey(trimmedSession), JSON.stringify(messages));
    }, 120);
    return () => clearTimeout(t);
  }, [messages, hydrated, trimmedSession]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length, awaitingAssistant, scrollToEnd]);

  const sendPrompt = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || !trimmedSession || awaitingAssistant) return;

      const userMsg: AiChatUserMessage = {
        id: newId('u'),
        role: 'user',
        text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      setAwaitingAssistant(true);

      try {
        const res = await postAiAssistantChat({ chatInput: text, sessionId: trimmedSession });
        const assistant: AiChatAssistantMessage = {
          id: newId('a'),
          role: 'assistant',
          summary: res.summary?.trim() || 'Chưa có nội dung phản hồi.',
          details: Array.isArray(res.details) ? res.details : [],
          source: res.source?.trim() ? res.source.trim() : null,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistant]);
      } catch {
        const err: AiChatErrorMessage = {
          id: newId('e'),
          role: 'error',
          text: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, err]);
      } finally {
        setAwaitingAssistant(false);
      }
    },
    [awaitingAssistant, trimmedSession]
  );

  const handleSend = useCallback(() => {
    void sendPrompt(inputText);
  }, [inputText, sendPrompt]);

  const handleCopyAssistant = useCallback((m: AiChatAssistantMessage) => {
    const payload = buildCopyText(m);
    void (async () => {
      try {
        await Clipboard.setStringAsync(payload);
        Alert.alert('Đã sao chép', 'Nội dung phản hồi đã được lưu vào bộ nhớ tạm.');
      } catch {
        Alert.alert('Sao chép thất bại', 'Vui lòng thử lại.');
      }
    })();
  }, []);

  const handleOpenSource = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert('Không mở được liên kết', 'Vui lòng kiểm tra URL nguồn.');
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: AiChatStoredMessage }) => {
      if (item.role === 'user') {
        return (
          <FadeInBubble>
            <View style={styles.userRow}>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{item.text}</Text>
                <Text style={styles.userTime}>{formatTime(item.createdAt)}</Text>
              </View>
            </View>
          </FadeInBubble>
        );
      }

      if (item.role === 'error') {
        return (
          <FadeInBubble>
            <View style={styles.aiRow}>
              <View style={styles.aiAvatar}>
                <Ionicons name="alert-circle-outline" size={18} color={COLORS.primary} />
              </View>
              <View style={[styles.aiBubble, styles.errorBubble]}>
                <Text style={styles.errorText}>{item.text}</Text>
                <Text style={styles.aiTime}>{formatTime(item.createdAt)}</Text>
              </View>
            </View>
          </FadeInBubble>
        );
      }

      const assistant = item as AiChatAssistantMessage;
      return (
        <FadeInBubble>
          <Pressable
            onLongPress={() => handleCopyAssistant(assistant)}
            delayLongPress={380}
            style={styles.aiRow}
          >
            <View style={styles.aiAvatar}>
              <Ionicons name="school" size={18} color="#fff" />
            </View>
            <View style={styles.aiBubble}>
              <Text style={styles.aiSummary}>{assistant.summary}</Text>
              {assistant.details.length > 0 ? (
                <View style={styles.detailsWrap}>
                  {assistant.details.map((row, idx) => (
                    <View key={`${row.label}-${idx}`} style={styles.detailCard}>
                      <Text style={styles.detailLabel}>{row.label}</Text>
                      <Text style={styles.detailValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {assistant.source ? (
                <Pressable
                  onPress={() => handleOpenSource(assistant.source!)}
                  style={({ pressed }) => [styles.sourceBtn, pressed && { opacity: 0.9 }]}
                >
                  <Ionicons name="open-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.sourceBtnText}>Xem nguồn</Text>
                </Pressable>
              ) : null}
              <Text style={styles.aiHint}>Giữ để sao chép</Text>
              <Text style={styles.aiTime}>{formatTime(assistant.createdAt)}</Text>
            </View>
          </Pressable>
        </FadeInBubble>
      );
    },
    [handleCopyAssistant, handleOpenSource]
  );

  const listHeader = useMemo(() => {
    if (messages.length > 0 || !hydrated) return null;
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIllustration}>
          <Ionicons name="chatbubbles-outline" size={44} color={COLORS.primary} />
        </View>
        <Text style={styles.emptyTitle}>Xin chào! Tôi là trợ lý AI của bạn.</Text>
        <Text style={styles.emptySub}>Hãy hỏi tôi bất cứ điều gì về các trường học.</Text>
      </View>
    );
  }, [messages.length, hydrated]);

  const listFooter = useMemo(() => {
    if (!awaitingAssistant) return <View style={{ height: 8 }} />;
    return (
      <View style={styles.aiRow}>
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <AiSkeletonBubble />
          <View style={styles.typingWrap}>
            <TypingDots />
          </View>
        </View>
      </View>
    );
  }, [awaitingAssistant]);

  if (!trimmedSession) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header onBack={onBack} />
        <View style={styles.centerFill}>
          <Text style={styles.missingSession}>
            Thiếu email phụ huynh nên không thể bắt đầu phiên trò chuyện.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Header onBack={onBack} />

      {!hydrated ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={(r) => {
            listRef.current = r;
          }}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <>
              {listHeader}
              <View style={{ height: messages.length > 0 ? 10 : 0 }} />
            </>
          }
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
      >
        <View style={styles.inputSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {SUGGESTED_CHIPS.map((q) => (
              <Pressable
                key={q}
                onPress={() => void sendPrompt(q)}
                disabled={awaitingAssistant}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && { opacity: 0.92 },
                  awaitingAssistant && { opacity: 0.55 },
                ]}
              >
                <Text style={styles.chipText}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputBar}>
            <Pressable
              hitSlop={10}
              style={styles.inputSideBtn}
              onPress={() => {
                const next = SUGGESTED_CHIPS[Math.floor(Math.random() * SUGGESTED_CHIPS.length)];
                setInputText(next);
              }}
            >
              <Ionicons name="bulb-outline" size={22} color={COLORS.textMuted} />
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder={PLACEHOLDER}
              placeholderTextColor="#94a3b8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!awaitingAssistant}
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              style={({ pressed }) => [
                styles.sendBtn,
                (!canSend || pressed) && { opacity: canSend ? 0.9 : 0.45 },
              ]}
            >
              <Ionicons name="paper-plane" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.headerBack}>
        <Ionicons name="chevron-back" size={26} color={COLORS.text} />
      </Pressable>
      <View style={styles.headerCenter}>
        <View>
          <Text style={styles.headerTitle}>Trợ lý AI</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  missingSession: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  headerSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  headerAiIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.online,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    flexGrow: 1,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 18,
  },
  emptyIllustration: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.aiBubbleBorder,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  userRow: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  userBubbleText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  userTime: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'right',
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 12,
  },
  aiAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  aiBubble: {
    flex: 1,
    maxWidth: '86%',
    backgroundColor: COLORS.aiBubble,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.aiBubbleBorder,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  skeletonBubble: {
    maxWidth: '100%',
    marginBottom: 8,
  },
  skelLine: {
    height: 10,
    borderRadius: 6,
    backgroundColor: COLORS.skeleton,
    marginBottom: 8,
  },
  typingWrap: {
    marginTop: 4,
    marginLeft: 2,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.textMuted,
  },
  aiSummary: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '800',
    color: COLORS.text,
  },
  detailsWrap: {
    marginTop: 10,
    gap: 8,
  },
  detailCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.2,
  },
  detailValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  sourceBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
  },
  sourceBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  aiHint: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  aiTime: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  errorBubble: {
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: '#fff1f2',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b91c1c',
    lineHeight: 20,
  },
  inputSection: {
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    paddingTop: 8,
  },
  chipsScroll: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.chipBg,
    borderWidth: 1,
    borderColor: COLORS.aiBubbleBorder,
    marginRight: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    maxWidth: 260,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
  },
  inputSideBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    backgroundColor: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
