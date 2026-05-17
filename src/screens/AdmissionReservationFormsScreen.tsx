import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  confirmReservationEnrollment,
  fetchAdmissionReservationForms,
  type ReservationFormItem,
} from '../api/admissionReservation';
import {
  canConfirmReservationEnrollment,
  canSubmitReservationPayment,
  isReservationPaymentAgain,
  reservationStatusUi,
  type ReservationFormStatus,
} from '../utils/reservationStatus';
import AdmissionReservationListScreen from './AdmissionReservationListScreen';
import ReservationPaymentScreen from './ReservationPaymentScreen';

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
  { id: 'RESERVATION_PENDING', label: 'Chờ trường duyệt' },
  { id: 'RESERVATION_APPROVAL', label: 'Chờ thanh toán' },
  { id: 'RESERVATION_PAYMENT_PENDING', label: 'Chờ xác nhận TT' },
  { id: 'RESERVATION_REJECTED', label: 'Trường từ chối' },
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

function displayText(value?: string | null, fallback = '—'): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toUpperCase() === 'N/A') return fallback;
  return trimmed;
}

export default function AdmissionReservationFormsScreen({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<FilterItem['id']>('ALL');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ReservationFormItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReservationFormItem | null>(null);
  const [paymentItem, setPaymentItem] = useState<ReservationFormItem | null>(null);
  const [confirmItem, setConfirmItem] = useState<ReservationFormItem | null>(null);
  const [confirming, setConfirming] = useState(false);

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
      setDetailVisible(false);
      setSelectedItem(null);
      setPaymentItem(null);
      setConfirmItem(null);
      setConfirming(false);
    }
  }, [visible]);

  const handleConfirmEnrollment = async () => {
    if (!confirmItem || confirming) return;
    setConfirming(true);
    try {
      await confirmReservationEnrollment(confirmItem.id);
      setConfirmItem(null);
      void loadData('refresh');
      Alert.alert('Thành công', 'Đã xác nhận nhập học.');
    } catch (e: unknown) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không xác nhận được nhập học.');
    } finally {
      setConfirming(false);
    }
  };

  const openDetail = (item: ReservationFormItem) => {
    setSelectedItem(item);
    setDetailVisible(true);
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={[styles.list, { paddingBottom: insets.bottom + 16 }]}>
          {[1, 2, 3].map((k) => (
            <View key={k} style={styles.skeletonCard}>
              <View style={styles.skeletonLineLg} />
              <View style={styles.skeletonLineMd} />
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
        style={styles.listScroll}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData('refresh')} />}
      >
        {items.map((item) => {
          const status = reservationStatusUi(item.status);
          const docCount = (item.profileMetaData ?? []).filter((m) => (m.imageUrl?.length ?? 0) > 0).length;
          const transcriptCount = (item.transcriptImages ?? []).filter((t) => Boolean(t.imageUrl)).length;
          return (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.profileCard, pressed && { opacity: 0.92 }]}
              onPress={() => openDetail(item)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <MaterialIcons name="description" size={24} color="#1976d2" />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {displayText(item.schoolName, 'Trường học')}
                  </Text>
                  <Text style={styles.cardSub} numberOfLines={1}>
                    {displayText(item.studentName)} · {genderLabel(item.gender)}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#94a3b8" />
              </View>

              <LinearGradient colors={status.colors} style={styles.statusPill}>
                <MaterialIcons name={status.icon} size={14} color={status.text} />
                <Text style={[styles.statusPillText, { color: status.text }]}>{status.label}</Text>
              </LinearGradient>

              <View style={styles.infoRow}>
                <MaterialIcons name="folder-open" size={16} color="#64748b" />
                <Text style={styles.infoRowText}>
                  {docCount} tài liệu · {transcriptCount} ảnh học bạ
                </Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="schedule" size={16} color="#64748b" />
                <Text style={styles.infoRowText}>Nộp: {formatDateTime(item.createdTime)}</Text>
              </View>

              {canSubmitReservationPayment(item) ? (
                <Pressable
                  onPress={() => setPaymentItem(item)}
                  style={({ pressed }) => [styles.payBtnWrap, pressed && { opacity: 0.92 }]}
                >
                  <LinearGradient
                    colors={['#1976d2', '#42a5f5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.payBtn}
                  >
                    <MaterialIcons name="account-balance-wallet" size={18} color="#fff" />
                    <Text style={styles.payBtnText}>
                      {isReservationPaymentAgain(item.status) ? 'Nộp lại phí giữ chỗ' : 'Nộp phí giữ chỗ'}
                    </Text>
                    <MaterialIcons name="qr-code-2" size={18} color="#fff" />
                  </LinearGradient>
                </Pressable>
              ) : null}

              {canConfirmReservationEnrollment(item.status) ? (
                <Pressable
                  onPress={() => setConfirmItem(item)}
                  style={({ pressed }) => [
                    styles.payBtnWrap,
                    canSubmitReservationPayment(item) && { marginTop: 8 },
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  <LinearGradient
                    colors={['#15803d', '#22c55e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.payBtn}
                  >
                    <MaterialIcons name="how-to-reg" size={18} color="#fff" />
                    <Text style={styles.payBtnText}>Xác nhận nhập học</Text>
                  </LinearGradient>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }, [error, insets.bottom, items, loading, refreshing, loadData]);

  if (!visible) return null;

  return (
    <LinearGradient colors={['#f8fafc', '#f1f5f9']} style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.headerShell, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn}>
            <MaterialIcons name="arrow-back-ios-new" size={18} color="#0f172a" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Đơn giữ chỗ</Text>
            <Text style={styles.subtitle}>Danh sách hồ sơ đã nộp</Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
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

      <View style={styles.body}>{content}</View>

      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setDetailVisible(false);
          setSelectedItem(null);
        }}
      >
        <AdmissionReservationListScreen
          visible={detailVisible}
          item={selectedItem}
          onBack={() => {
            setDetailVisible(false);
            setSelectedItem(null);
          }}
          onPaymentSuccess={async (result) => {
            const formId = selectedItem?.id;
            if (formId != null && result?.paymentResubmitCount != null) {
              const count = result.paymentResubmitCount;
              setSelectedItem((prev) => (prev?.id === formId ? { ...prev, paymentResubmitCount: count } : prev));
              setItems((prev) =>
                prev.map((i) => (i.id === formId ? { ...i, paymentResubmitCount: count } : i))
              );
            }
            try {
              const res = await fetchAdmissionReservationForms(activeFilter);
              const normalized = Array.isArray(res.body) ? res.body : [];
              normalized.sort((a, b) => {
                const aTime = a.createdTime ? new Date(a.createdTime).getTime() : 0;
                const bTime = b.createdTime ? new Date(b.createdTime).getTime() : 0;
                return bTime - aTime;
              });
              setItems(normalized);
              setSelectedItem((prev) => {
                if (!prev) return prev;
                return normalized.find((i) => i.id === prev.id) ?? prev;
              });
            } catch {
              void loadData('refresh');
            }
          }}
        />
      </Modal>

      <ConfirmDialog
        visible={confirmItem != null}
        title="Xác nhận nhập học"
        message="Bạn có chắc muốn xác nhận nhập học?"
        cancelLabel="Huỷ"
        confirmLabel="Xác nhận"
        onCancel={() => setConfirmItem(null)}
        onConfirm={() => void handleConfirmEnrollment()}
      />

      <ReservationPaymentScreen
        visible={paymentItem != null}
        admissionFormId={paymentItem?.id ?? 0}
        formStatus={paymentItem?.status}
        campusProgramOfferingId={paymentItem?.campusProgramOfferingId}
        programName={paymentItem?.programName}
        paymentResubmitCount={paymentItem?.paymentResubmitCount}
        transferCode={paymentItem?.transferCode}
        schoolName={paymentItem?.schoolName}
        studentName={paymentItem?.studentName}
        onBack={() => setPaymentItem(null)}
        onSuccess={(result) => {
          const formId = paymentItem?.id;
          if (formId != null && result?.paymentResubmitCount != null) {
            const count = result.paymentResubmitCount;
            setItems((prev) =>
              prev.map((i) => (i.id === formId ? { ...i, paymentResubmitCount: count } : i))
            );
            setSelectedItem((prev) =>
              prev?.id === formId ? { ...prev, paymentResubmitCount: count } : prev
            );
          }
          setPaymentItem(null);
          void loadData('refresh');
        }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerShell: { paddingHorizontal: 14, paddingBottom: 6 },
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
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterRow: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 },
  body: { flex: 1 },
  listScroll: { flex: 1 },
  filterPill: { borderRadius: 999, height: 40, overflow: 'hidden' },
  filterPillGradient: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillInactive: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {},
  filterText: { fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  filterTextInactive: { color: '#475569' },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
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
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  cardSub: { marginTop: 2, fontSize: 13, color: '#64748b' },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoRowText: { flex: 1, fontSize: 13, color: '#475569' },
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
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 16,
    gap: 10,
    marginBottom: 12,
  },
  skeletonLineLg: { height: 18, width: '68%', borderRadius: 8, backgroundColor: '#e2e8f0' },
  skeletonLineMd: { height: 14, width: '52%', borderRadius: 7, backgroundColor: '#f1f5f9' },
  payBtnWrap: { marginTop: 4, borderRadius: 14, overflow: 'hidden' },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  payBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
