import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Image,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const Ionicons = require('@expo/vector-icons').Ionicons;
import type {
  ParentStudentProfile,
  PersonalityTypeDetail,
  PersonalityTypesGrouped,
} from '../types/studentProfile';
import { findPersonalityByCode, groupColorForPersonality } from '../utils/personalityTypes';
import { formatGradeLevel } from '../utils/gradeLevel';

/** Khớp HomeScreen — GRADIENT_COLORS + primary actions */
const PRIMARY = '#1976d2';
const GRADIENT_COLORS = ['#1976d2', '#42a5f5', '#64b5f6'] as const;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };
const sp = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24 } as const;
const radius = { md: 12, lg: 16, xl: 20, full: 9999 } as const;

type Props = {
  visible: boolean;
  student: ParentStudentProfile | null;
  personalityGrouped: PersonalityTypesGrouped | null;
  onClose: () => void;
  onEdit: (student: ParentStudentProfile) => void;
};

function genderLabel(g: string): string {
  const u = g?.toUpperCase();
  if (u === 'MALE') return 'Nam';
  if (u === 'FEMALE') return 'Nữ';
  if (u === 'OTHER') return 'Khác';
  return g || '—';
}

function scoreBarColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

function scoreBarWidth(score: number): `${number}%` {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  return `${pct}%`;
}

function PersonalityDetailModal({
  visible,
  detail,
  onClose,
}: {
  visible: boolean;
  detail: PersonalityTypeDetail | null;
  onClose: () => void;
}) {
  if (!detail) return null;
  const accent = groupColorForPersonality(detail.personalityTypeGroup);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={detailStyles.sheet}>
        <View style={detailStyles.sheetHeader}>
          <Pressable onPress={onClose} hitSlop={12} style={detailStyles.sheetClose}>
            <Ionicons name="close" size={26} color="#64748b" />
          </Pressable>
          <Text style={detailStyles.sheetTitle}>Chi tiết tính cách</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          style={detailStyles.sheetScroll}
          contentContainerStyle={detailStyles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[detailStyles.tag, { backgroundColor: `${accent}22` }]}>
            <Text style={[detailStyles.tagText, { color: accent }]}>{detail.personalityTypeGroup}</Text>
          </View>
          <Image source={{ uri: detail.image }} style={detailStyles.heroImage} resizeMode="contain" />
          <Text style={detailStyles.code}>{detail.code}</Text>
          <Text style={detailStyles.name}>{detail.name}</Text>
          <Text style={detailStyles.desc}>{detail.description}</Text>

          <Text style={detailStyles.sectionTitle}>Đặc điểm</Text>
          {detail.traits?.map((t, i) => (
            <View key={i} style={detailStyles.bulletBlock}>
              <Text style={detailStyles.bulletTitle}>{t.name}</Text>
              <Text style={detailStyles.bulletBody}>{t.description}</Text>
            </View>
          ))}

          <Text style={detailStyles.sectionTitle}>Điểm mạnh</Text>
          {detail.strengths?.filter(Boolean).map((s, i) => (
            <Text key={i} style={detailStyles.listItem}>
              • {s}
            </Text>
          ))}

          <Text style={detailStyles.sectionTitle}>Điểm cần lưu ý</Text>
          {detail.weaknesses?.filter(Boolean).map((s, i) => (
            <Text key={i} style={detailStyles.listItem}>
              • {s}
            </Text>
          ))}

          <Text style={detailStyles.sectionTitle}>Gợi ý nghề nghiệp</Text>
          {detail.recommendedCareers?.map((c, i) => (
            <View key={i} style={detailStyles.careerCard}>
              <Text style={detailStyles.careerName}>{c.name}</Text>
              <Text style={detailStyles.careerExplain}>{c.explainText}</Text>
            </View>
          ))}

          {detail.quote && (
            <View style={detailStyles.quoteBox}>
              <Text style={detailStyles.quoteContent}>“{detail.quote.content}”</Text>
              <Text style={detailStyles.quoteAuthor}>— {detail.quote.author}</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function StudentProfileScreen({
  visible,
  student,
  personalityGrouped,
  onClose,
  onEdit,
}: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const detail = useMemo(() => {
    if (!student?.personalityTypeCode) return null;
    return findPersonalityByCode(personalityGrouped, student.personalityTypeCode) ?? null;
  }, [student, personalityGrouped]);

  const subtitleGrade = formatGradeLevel(student?.academicInfos?.[0]?.gradeLevel);
  const subtitle = subtitleGrade
    ? `${genderLabel(student?.gender ?? '')} · ${subtitleGrade}`
    : genderLabel(student?.gender ?? '');

  if (!student) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <LinearGradient
          colors={[...GRADIENT_COLORS]}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={styles.header}
        >
          <Pressable onPress={onClose} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Ionicons name="happy-outline" size={44} color={PRIMARY} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.studentName} numberOfLines={2}>
                {student.studentName}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            </View>
            <Pressable
              onPress={() => onEdit(student)}
              style={({ pressed }) => [styles.editIcon, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="pencil" size={22} color="#fff" />
            </Pressable>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Personality */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>Tính cách (MBTI)</Text>
            {detail ? (
              <>
                <View style={styles.personalityRow}>
                  <Image source={{ uri: detail.image }} style={styles.personalityImage} resizeMode="contain" />
                  <View style={styles.personalityText}>
                    <View
                      style={[
                        styles.groupTag,
                        { backgroundColor: `${groupColorForPersonality(detail.personalityTypeGroup)}22` },
                      ]}
                    >
                      <Text
                        style={[styles.groupTagText, { color: groupColorForPersonality(detail.personalityTypeGroup) }]}
                      >
                        {detail.personalityTypeGroup}
                      </Text>
                    </View>
                    <Text style={styles.pCode}>{detail.code}</Text>
                    <Text style={styles.pName}>{detail.name}</Text>
                    <Text style={styles.pShort} numberOfLines={2}>
                      {detail.description}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setDetailOpen(true)}
                  style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.ctaBtnText}>Xem chi tiết</Text>
                  <Ionicons name="arrow-forward" size={18} color={PRIMARY} />
                </Pressable>
              </>
            ) : (
              <Text style={styles.muted}>Chưa chọn hoặc không tìm thấy mã {student.personalityTypeCode || '—'}.</Text>
            )}
          </View>

          {/* Future */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>Định hướng tương lai</Text>
            <View style={styles.jobChip}>
              <Ionicons name="rocket-outline" size={18} color={PRIMARY} />
              <Text style={styles.jobChipText}>{student.favouriteJob?.trim() || 'Chưa cập nhật'}</Text>
            </View>
          </View>

          {/* Academic */}
          <Text style={styles.academicTitle}>Tổng quan học tập</Text>
          {!student.academicInfos?.length ? (
            <View style={styles.card}>
              <Text style={styles.muted}>Chưa có dữ liệu điểm theo khối.</Text>
            </View>
          ) : (
            student.academicInfos.map((info, idx) => (
              <View key={`${info.gradeLevel}-${idx}`} style={styles.card}>
                <Text style={styles.gradeTitle}>{formatGradeLevel(info.gradeLevel)}</Text>
                {info.subjectResults?.map((sr, j) => (
                  <View key={`${sr.subjectName}-${j}`} style={styles.subjectRow}>
                    <View style={styles.subjectLabelRow}>
                      <Text style={styles.subjectName} numberOfLines={1}>
                        {sr.subjectName}
                      </Text>
                      <Text style={[styles.subjectScore, { color: scoreBarColor(sr.score) }]}>{sr.score}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: scoreBarWidth(sr.score), backgroundColor: scoreBarColor(sr.score) },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>

      <PersonalityDetailModal visible={detailOpen} detail={detail} onClose={() => setDetailOpen(false)} />
    </Modal>
  );
}

const { width: W } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 12,
    paddingBottom: sp.lg,
    paddingHorizontal: sp.md,
  },
  backBtn: {
    marginBottom: sp.sm,
    alignSelf: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: sp.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTextCol: {
    flex: 1,
  },
  studentName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  editIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: sp.md,
    paddingTop: sp.lg,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: sp.lg,
    marginBottom: sp.md,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: sp.sm,
  },
  personalityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  personalityImage: {
    width: Math.min(100, W * 0.22),
    height: 100,
    marginRight: sp.md,
  },
  personalityText: {
    flex: 1,
  },
  groupTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: 6,
  },
  groupTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pCode: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  pName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  pShort: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  ctaBtn: {
    marginTop: sp.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: '#e3f2fd',
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY,
  },
  muted: {
    fontSize: 14,
    color: '#94a3b8',
  },
  jobChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: '#e3f2fd',
  },
  jobChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0d47a1',
    maxWidth: W - 100,
  },
  academicTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: sp.sm,
    marginLeft: 2,
  },
  gradeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: sp.md,
  },
  subjectRow: {
    marginBottom: sp.md,
  },
  subjectLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  subjectName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginRight: sp.sm,
  },
  subjectScore: {
    fontSize: 14,
    fontWeight: '800',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
});

const detailStyles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.sm,
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sheetClose: {
    width: 40,
    alignItems: 'flex-start',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    padding: sp.lg,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginBottom: sp.md,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroImage: {
    width: '100%',
    height: 180,
    marginBottom: sp.md,
  },
  code: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    marginBottom: sp.sm,
  },
  desc: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: sp.lg,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: sp.md,
    marginBottom: sp.sm,
  },
  bulletBlock: {
    marginBottom: sp.md,
    padding: sp.md,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bulletTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY,
    marginBottom: 6,
  },
  bulletBody: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  listItem: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 6,
  },
  careerCard: {
    padding: sp.md,
    borderRadius: radius.lg,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bbdefb',
    marginBottom: sp.sm,
  },
  careerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1565c0',
    marginBottom: 4,
  },
  careerExplain: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  quoteBox: {
    marginTop: sp.lg,
    padding: sp.lg,
    borderRadius: radius.lg,
    backgroundColor: '#e3f2fd',
  },
  quoteContent: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#0d47a1',
    lineHeight: 22,
  },
  quoteAuthor: {
    marginTop: sp.sm,
    fontSize: 13,
    fontWeight: '600',
    color: '#1976d2',
  },
});
