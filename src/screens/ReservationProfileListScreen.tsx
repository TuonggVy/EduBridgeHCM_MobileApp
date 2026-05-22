import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import { fetchReservationFormTemplate, type ReservationTemplate } from '../api/admissionReservation';
import { ApiError } from '../api/client';
import { fetchParentStudents } from '../api/parentStudent';
import ReservationProfileTemplateScreen from './ReservationProfileTemplateScreen';

const PRIMARY = '#1976d2';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type TemplateListItem = {
  template: ReservationTemplate;
};

function toNumberId(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function genderLabel(gender?: string | null): string {
  if (gender === 'MALE') return 'Nam';
  if (gender === 'FEMALE') return 'Nữ';
  if (gender === 'OTHER') return 'Khác';
  return 'Chưa cập nhật';
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReservationProfileListScreen({ visible, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<TemplateListItem[]>([]);
  const [defaultStudentProfileId, setDefaultStudentProfileId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailCreateMode, setDetailCreateMode] = useState(false);
  const [detailStudentProfileId, setDetailStudentProfileId] = useState<number | null>(null);

  const loadList = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const studentsRes = await fetchParentStudents();
      const students = Array.isArray(studentsRes.body) ? studentsRes.body : [];
      const firstId = toNumberId(students[0]?.id);
      setDefaultStudentProfileId(firstId);

      const loaded = await Promise.all(
        students.map(async (student) => {
          const studentProfileId = toNumberId(student.id);
          if (studentProfileId == null) return null;
          try {
            const res = await fetchReservationFormTemplate(studentProfileId);
            if (res.body) return { template: res.body };
          } catch (e: unknown) {
            if (e instanceof ApiError && e.status === 404) return null;
          }
          return null;
        })
      );

      const nextItems = loaded.filter((item): item is TemplateListItem => item != null);
      nextItems.sort(
        (a, b) =>
          new Date(b.template.updatedTime ?? 0).getTime() - new Date(a.template.updatedTime ?? 0).getTime()
      );
      setItems(nextItems);
    } catch {
      setItems([]);
      setDefaultStudentProfileId(null);
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void loadList('initial');
  }, [visible, loadList]);

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setRefreshing(false);
      setItems([]);
      setDefaultStudentProfileId(null);
      setDetailVisible(false);
      setDetailCreateMode(false);
      setDetailStudentProfileId(null);
    }
  }, [visible]);

  const openDetail = (createMode: boolean, studentProfileId?: number | null) => {
    setDetailCreateMode(createMode);
    // `null` = tạo hồ sơ cho học sinh khác (không gắn học sinh mặc định)
    setDetailStudentProfileId(
      studentProfileId === undefined ? defaultStudentProfileId : studentProfileId
    );
    setDetailVisible(true);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Hồ sơ giữ chỗ</Text>
          <Text style={styles.subtitle}>Mẫu hồ sơ dùng khi nộp đơn giữ chỗ</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadList('refresh')} />}
        >
          {items.length > 0 ? (
            items.map(({ template }) => {
              const docCount =
                template.profileMetaData?.filter((m) => (m.imageUrl?.length ?? 0) > 0).length ?? 0;
              const transcriptCount =
                template.transcriptImages?.filter((t) => Boolean(t.imageUrl)).length ?? 0;
              return (
                <Pressable
                  key={template.id ?? template.studentProfileId}
                  style={({ pressed }) => [styles.profileCard, pressed && { opacity: 0.92 }]}
                  onPress={() => openDetail(false, template.studentProfileId)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <MaterialIcons name="folder-shared" size={24} color={PRIMARY} />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {template.studentName || 'Hồ sơ học sinh'}
                      </Text>
                      <Text style={styles.cardSub} numberOfLines={2}>
                        {genderLabel(template.gender)}
                        {template.studentCode?.trim() ? ` · Mã HS: ${template.studentCode.trim()}` : ''}
                        {template.identityCard?.trim() ? ` · CCCD: ${template.identityCard.trim()}` : ''}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#94a3b8" />
                  </View>

                  <View style={[styles.statusPill, template.isApplied ? styles.statusApplied : styles.statusDraft]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        template.isApplied ? styles.statusAppliedText : styles.statusDraftText,
                      ]}
                    >
                      {template.isApplied ? 'Đã áp dụng' : 'Chưa áp dụng'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <MaterialIcons name="person-outline" size={16} color="#64748b" />
                    <Text style={styles.infoRowText} numberOfLines={1}>
                      Phụ huynh: {template.parentName?.trim() || '—'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <MaterialIcons name="description" size={16} color="#64748b" />
                    <Text style={styles.infoRowText}>
                      {docCount} tài liệu · {transcriptCount} ảnh học bạ
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <MaterialIcons name="schedule" size={16} color="#64748b" />
                    <Text style={styles.infoRowText}>Cập nhật: {formatDateTime(template.updatedTime)}</Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="folder-open" size={48} color="#93c5fd" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có hồ sơ giữ chỗ</Text>
              <Text style={styles.emptySub}>
                Tạo mẫu hồ sơ một lần để tái sử dụng khi nộp đơn giữ chỗ tại các trường.
              </Text>
              <Pressable
                style={styles.emptyCtaWrap}
                onPress={() => openDetail(true)}
                disabled={defaultStudentProfileId == null}
              >
                <LinearGradient
                  colors={
                    defaultStudentProfileId != null ? ['#1976d2', '#42a5f5'] : ['#94a3b8', '#94a3b8']
                  }
                  style={styles.emptyCta}
                >
                  <MaterialIcons name="add" size={20} color="#fff" />
                  <Text style={styles.emptyCtaText}>Tạo hồ sơ giữ chỗ</Text>
                </LinearGradient>
              </Pressable>
              {defaultStudentProfileId == null ? (
                <Text style={styles.emptyHint}>Thêm hồ sơ học sinh trong mục Tài khoản trước.</Text>
              ) : null}
            </View>
          )}

          {items.length > 0 && defaultStudentProfileId != null ? (
            <Pressable style={styles.addAnotherWrap} onPress={() => openDetail(true, null)}>
              <MaterialIcons name="add-circle-outline" size={20} color={PRIMARY} />
              <Text style={styles.addAnotherText}>Tạo hồ sơ cho học sinh khác</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setDetailVisible(false);
          setDetailCreateMode(false);
          setDetailStudentProfileId(null);
        }}
      >
        <ReservationProfileTemplateScreen
          visible={detailVisible}
          studentProfileId={detailStudentProfileId}
          startInEditMode={detailCreateMode}
          existingTemplateStudentProfileIds={
            detailCreateMode ? items.map(({ template }) => template.studentProfileId) : undefined
          }
          onClose={() => {
            setDetailVisible(false);
            setDetailCreateMode(false);
            setDetailStudentProfileId(null);
          }}
          onSaved={() => {
            void loadList('refresh');
          }}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f8fb' },
  header: {
    paddingTop: 62,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  headerCenter: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800', color: '#0f172a' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#64748b', lineHeight: 18 },
  centerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32, flexGrow: 1, gap: 12 },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  cardSub: { marginTop: 2, fontSize: 13, color: '#64748b' },
  statusPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusApplied: { backgroundColor: '#dcfce7' },
  statusDraft: { backgroundColor: '#fef3c7' },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  statusAppliedText: { color: '#15803d' },
  statusDraftText: { color: '#b45309' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoRowText: { flex: 1, fontSize: 13, color: '#475569' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyHint: { marginTop: 12, fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  emptyCtaWrap: { alignSelf: 'center', width: '72%', maxWidth: 220 },
  emptyCta: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyCtaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  addAnotherWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  addAnotherText: { fontSize: 14, fontWeight: '700', color: PRIMARY },
});
