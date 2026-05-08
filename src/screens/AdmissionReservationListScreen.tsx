import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import {
  fetchAdmissionReservationForms,
  type ReservationFormItem,
  type ReservationFormStatus,
} from '../api/admissionReservation';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type FilterItem = {
  id: 'ALL' | ReservationFormStatus;
  label: string;
};

const FILTERS: FilterItem[] = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'RESERVATION_PENDING', label: 'Chờ xử lý' },
  { id: 'RESERVATION_APPROVAL', label: 'Đã xét duyệt' },
  { id: 'RESERVATION_REJECTED', label: 'Từ chối' },
  { id: 'RESERVATION_CANCELLED', label: 'Đã huỷ' },
];

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const datePart = date.toLocaleDateString('vi-VN');
  const timePart = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} • ${timePart}`;
}

function genderLabel(gender?: string | null): string {
  if (gender === 'MALE') return 'Nam';
  if (gender === 'FEMALE') return 'Nữ';
  if (gender === 'OTHER') return 'Khác';
  return 'Chưa rõ';
}

function statusUi(status: string) {
  switch (status) {
    case 'RESERVATION_PENDING':
      return {
        label: 'Chờ xử lý',
        icon: 'schedule',
        colors: ['#fff7ed', '#ffedd5'] as const,
        text: '#c2410c',
      };
    case 'RESERVATION_APPROVAL':
      return {
        label: 'Đã xét duyệt',
        icon: 'verified',
        colors: ['#eff6ff', '#dbeafe'] as const,
        text: '#1d4ed8',
      };
    case 'RESERVATION_APPROVED':
      return {
        label: 'Đã duyệt',
        icon: 'check-circle',
        colors: ['#ecfdf5', '#dcfce7'] as const,
        text: '#15803d',
      };
    case 'RESERVATION_REJECTED':
      return {
        label: 'Từ chối',
        icon: 'cancel',
        colors: ['#fff1f2', '#ffe4e6'] as const,
        text: '#be123c',
      };
    case 'RESERVATION_CANCELLED':
      return {
        label: 'Đã huỷ',
        icon: 'block',
        colors: ['#f8fafc', '#e2e8f0'] as const,
        text: '#475569',
      };
    default:
      return {
        label: status || 'Không rõ',
        icon: 'help-outline',
        colors: ['#f8fafc', '#e2e8f0'] as const,
        text: '#475569',
      };
  }
}

export default function AdmissionReservationListScreen({ visible, onClose }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterItem['id']>('ALL');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ReservationFormItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const loadData = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const res = await fetchAdmissionReservationForms(activeFilter);
      const normalized = Array.isArray(res.body) ? res.body : [];
      normalized.sort((a, b) => {
        const aTime = a.createdTime ? new Date(a.createdTime).getTime() : 0;
        const bTime = b.createdTime ? new Date(b.createdTime).getTime() : 0;
        return bTime - aTime;
      });
      setItems(normalized);
    } catch (e: unknown) {
      setItems([]);
      setError(e instanceof Error ? e.message : 'Không tải được danh sách đơn.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    if (!visible) return;
    void loadData('initial');
  }, [visible, activeFilter, loadData]);

  useEffect(() => {
    if (!visible) {
      setActiveFilter('ALL');
      setItems([]);
      setError(null);
      setPreviewImages([]);
      setPreviewIndex(0);
    }
  }, [visible]);

  const openPreview = (images: string[], index: number) => {
    if (images.length === 0) return;
    setPreviewImages(images);
    setPreviewIndex(index);
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.list}>
          {[1, 2, 3].map((k) => (
            <View key={k} style={styles.skeletonCard}>
              <View style={styles.skeletonLineLg} />
              <View style={styles.skeletonLineMd} />
              <View style={styles.skeletonThumbRow}>
                <View style={styles.skeletonThumb} />
                <View style={styles.skeletonThumb} />
                <View style={styles.skeletonThumb} />
              </View>
            </View>
          ))}
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerWrap}>
          <MaterialIcons name="error-outline" size={44} color="#ef4444" />
          <Text style={styles.emptyTitle}>{error}</Text>
          <Pressable onPress={() => void loadData('initial')} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </Pressable>
        </View>
      );
    }
    if (items.length === 0) {
      return (
        <View style={styles.centerWrap}>
          <View style={styles.emptyIconWrap}>
            <MaterialIcons name="description" size={46} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>Bạn chưa có đơn giữ chỗ nào</Text>
          <Text style={styles.emptySub}>Hồ sơ sau khi nộp sẽ hiển thị tại đây</Text>
        </View>
      );
    }
    return (
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData('refresh')} />}
      >
        {items.map((item) => {
          const status = statusUi(item.status);
          const reason = item.rejectReason || item.cancelReason;
          const metadata = Array.isArray(item.profileMetadata) ? item.profileMetadata : [];
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.schoolAvatar}>
                  <MaterialIcons name="school" size={20} color="#1976d2" />
                </View>
                <View style={styles.schoolBlock}>
                  <Text style={styles.schoolName}>
                    {item.schoolName || 'Trường học'}
                  </Text>
                  <Text style={styles.schoolSub} numberOfLines={1}>
                    {item.programName || 'Chương trình'}
                  </Text>
                  <View style={styles.campusPill}>
                    <Text style={styles.campusPillText}>{item.campusName || 'Đang cập nhật cơ sở'}</Text>
                  </View>
                </View>
                <LinearGradient colors={status.colors} style={styles.statusChip}>
                  <View style={styles.statusIconDot}>
                    <MaterialIcons name={status.icon} size={12} color={status.text} />
                  </View>
                  <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
                </LinearGradient>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>HỌC SINH</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {item.studentName || '—'} • {genderLabel(item.gender)}
                  </Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>PHỤ HUYNH</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {item.parentName || '—'}
                  </Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>ĐIỆN THOẠI</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {item.parentPhone || '—'}
                  </Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>NGÀY NỘP</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {formatDateTime(item.createdTime)}
                  </Text>
                </View>
              </View>

              <Text style={styles.uploadTitle}>Hồ sơ đã tải lên</Text>
              {metadata.map((m) => (
                <View key={`${item.id}-${m.key}`} style={styles.metaBlock}>
                  <Text style={styles.metaKey}>{m.key}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
                    {(m.imageUrl || []).map((url, idx) => (
                      <Pressable key={`${m.key}-${idx}`} onPress={() => openPreview(m.imageUrl || [], idx)} style={styles.thumbWrap}>
                        <Image source={{ uri: url }} style={styles.thumb} />
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ))}

              {reason ? (
                <View style={styles.reasonBox}>
                  <View style={styles.reasonHead}>
                    <View style={styles.reasonIconWrap}>
                      <MaterialIcons name="report-gmailerrorred" size={16} color="#ef4444" />
                    </View>
                    <Text style={styles.reasonTitle}>Lý do từ chối / huỷ</Text>
                  </View>
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ) : null}

              {item.verifiedBy ? (
                <View style={styles.verifyBox}>
                  <View style={styles.verifyHead}>
                    <MaterialIcons name="verified" size={16} color="#16a34a" />
                    <Text style={styles.verifyText}>Được xét duyệt bởi</Text>
                  </View>
                  <Text style={styles.verifyEmail}>{item.verifiedBy}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    );
  }, [error, items, loading, refreshing, loadData]);

  return (
    <LinearGradient colors={['#f8fafc', '#f1f5f9']} style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerShell}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn}>
            <MaterialIcons name="arrow-back-ios-new" size={18} color="#0f172a" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Đơn giữ chỗ</Text>
            <Text style={styles.subtitle}>Theo dõi hồ sơ tuyển sinh</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((tab) => {
          const active = tab.id === activeFilter;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveFilter(tab.id)}
              style={[styles.filterPill, active ? styles.filterPillActive : styles.filterPillInactive]}
            >
              {active ? (
                <LinearGradient colors={['#1976d2', '#42a5f5']} style={styles.filterPillGradient}>
                  <Text style={[styles.filterText, styles.filterTextActive]}>{tab.label}</Text>
                </LinearGradient>
              ) : (
                <Text style={[styles.filterText, styles.filterTextInactive]}>{tab.label}</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {content}

      <Modal visible={previewImages.length > 0} transparent animationType="fade" onRequestClose={() => setPreviewImages([])}>
        <View style={styles.previewBackdrop}>
          <View style={styles.previewHead}>
            <Pressable onPress={() => setPreviewImages([])} style={styles.previewCloseBtn}>
              <MaterialIcons name="close" size={18} color="#fff" />
            </Pressable>
            <Text style={styles.previewCounter}>
              {previewIndex + 1}/{previewImages.length}
            </Text>
          </View>
          {previewImages[previewIndex] ? (
            <Image source={{ uri: previewImages[previewIndex] }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewThumbRow}>
            {previewImages.map((img, idx) => (
              <Pressable key={`${img}-${idx}`} onPress={() => setPreviewIndex(idx)}>
                <Image source={{ uri: img }} style={[styles.previewThumb, idx === previewIndex && styles.previewThumbActive]} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerShell: {
    paddingTop: 56,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  header: {
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  filterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  filterPill: {
    borderRadius: 999,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  filterPillGradient: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {},
  filterPillInactive: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  filterTextInactive: { color: '#475569' },
  list: { paddingHorizontal: 16, paddingBottom: 28, gap: 14 },
  card: {
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  schoolAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolBlock: { flex: 1, gap: 4 },
  schoolName: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  schoolSub: { fontSize: 13, color: '#64748b' },
  campusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  campusPillText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIconDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffffffc8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  infoGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoBox: {
    width: '48%',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    padding: 10,
    minHeight: 62,
  },
  infoLabel: { fontSize: 10, color: '#64748b', fontWeight: '700' },
  infoValue: { marginTop: 4, fontSize: 12, color: '#0f172a', fontWeight: '700' },
  uploadTitle: { marginTop: 14, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  metaBlock: { marginTop: 10 },
  metaKey: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 8 },
  imageRow: { gap: 8 },
  thumbWrap: { borderRadius: 18, overflow: 'hidden' },
  thumb: {
    width: 102,
    height: 102,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
  },
  reasonBox: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#fff1f2',
  },
  reasonHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reasonIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonTitle: { fontSize: 12, fontWeight: '700', color: '#b91c1c' },
  reasonText: { marginTop: 6, fontSize: 12, color: '#991b1b', lineHeight: 18 },
  verifyBox: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#f0fdf4',
  },
  verifyHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifyText: { fontSize: 12, color: '#166534', fontWeight: '700' },
  verifyEmail: { marginTop: 4, fontSize: 12, color: '#15803d' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 10 },
  emptyIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#64748b', textAlign: 'center' },
  retryBtn: { marginTop: 6, backgroundColor: '#1976d2', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  skeletonCard: {
    borderRadius: 26,
    backgroundColor: '#fff',
    padding: 16,
    gap: 10,
    marginBottom: 12,
  },
  skeletonLineLg: { height: 18, width: '68%', borderRadius: 8, backgroundColor: '#e2e8f0' },
  skeletonLineMd: { height: 14, width: '52%', borderRadius: 7, backgroundColor: '#f1f5f9' },
  skeletonThumbRow: { flexDirection: 'row', gap: 8 },
  skeletonThumb: { width: 96, height: 96, borderRadius: 16, backgroundColor: '#f1f5f9' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.94)', paddingTop: 56, paddingBottom: 26 },
  previewHead: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  previewCounter: { color: '#fff', fontSize: 13, fontWeight: '700' },
  previewImage: { width: '100%', height: '72%', marginTop: 10 },
  previewThumbRow: { paddingHorizontal: 16, gap: 8 },
  previewThumb: { width: 56, height: 56, borderRadius: 10, opacity: 0.65 },
  previewThumbActive: { opacity: 1, borderWidth: 2, borderColor: '#60a5fa' },
});
