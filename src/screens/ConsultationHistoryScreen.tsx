import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import { fetchParentOfflineConsultations } from '../api/parentConsultation';
import type { ParentOfflineConsultationItem } from '../types/consultation';
import {
  parentOfflineConsultationStatusVi,
  PARENT_OFFLINE_CONSULTATION_STATUS_FILTERS,
} from '../types/consultation';

const HISTORY_PAGE_SIZE = 10;

type ConsultationHistoryScreenProps = {
  visible: boolean;
  onClose: () => void;
};

function formatTimeHm(t: string): string {
  if (!t) return '—';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

function formatDateVn(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

function formatWeekdayDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(date);
  return `${weekday}, ${formatDateVn(value)}`;
}

function normalizeStatusForUi(status: string): 'pending' | 'confirmed' | 'cancelled' | 'other' {
  const s = status.trim().toLowerCase();
  if (s === 'pending') return 'pending';
  if (s === 'confirmed' || s === 'approved' || s === 'in-progress' || s === 'completed') return 'confirmed';
  if (s === 'cancelled' || s === 'rejected' || s === 'no-show') return 'cancelled';
  return 'other';
}

function statusCardUi(status: string): { icon: string; title: string; bg: string; text: string; border: string } {
  const n = normalizeStatusForUi(status);
  if (n === 'pending') {
    return {
      icon: 'hourglass-top',
      title: 'Chờ xác nhận',
      bg: '#fff7e6',
      text: '#b45309',
      border: '#fcd34d',
    };
  }
  if (n === 'confirmed') {
    return {
      icon: 'check-circle',
      title: 'Đã xác nhận',
      bg: '#ecfdf3',
      text: '#15803d',
      border: '#86efac',
    };
  }
  if (n === 'cancelled') {
    return {
      icon: 'cancel',
      title: 'Đã hủy',
      bg: '#fef2f2',
      text: '#b91c1c',
      border: '#fca5a5',
    };
  }
  return {
    icon: 'info',
    title: parentOfflineConsultationStatusVi(status),
    bg: '#eff6ff',
    text: '#1d4ed8',
    border: '#bfdbfe',
  };
}

function sortOfflineConsultationsNewestFirst(rows: ParentOfflineConsultationItem[]): ParentOfflineConsultationItem[] {
  return [...rows].sort((a, b) => {
    if (b.id !== a.id) return b.id - a.id;
    const byDate = b.appointmentDate.localeCompare(a.appointmentDate);
    if (byDate !== 0) return byDate;
    return b.appointmentTime.localeCompare(a.appointmentTime);
  });
}

export default function ConsultationHistoryScreen({ visible, onClose }: ConsultationHistoryScreenProps) {
  const [historyRows, setHistoryRows] = useState<ParentOfflineConsultationItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyHasNext, setHistoryHasNext] = useState(false);
  const [historyNextPage, setHistoryNextPage] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ParentOfflineConsultationItem | null>(null);
  const [questionExpanded, setQuestionExpanded] = useState(false);

  const reloadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetchParentOfflineConsultations({
        status: historyFilter,
        page: 0,
        pageSize: HISTORY_PAGE_SIZE,
      });
      const b = res.body;
      setHistoryRows(sortOfflineConsultationsNewestFirst(b.items));
      setHistoryHasNext(b.hasNext);
      setHistoryNextPage(b.hasNext ? b.currentPage + 1 : 0);
    } catch (error: unknown) {
      setHistoryRows([]);
      setHistoryHasNext(false);
      setHistoryNextPage(0);
      setHistoryError(error instanceof Error ? error.message : 'Không tải được lịch đã đặt.');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilter]);

  useEffect(() => {
    if (!visible) return;
    void reloadHistory();
  }, [visible, reloadHistory]);

  useEffect(() => {
    if (!visible) {
      setSelectedItem(null);
      setQuestionExpanded(false);
    }
  }, [visible]);

  const loadMoreHistory = useCallback(async () => {
    if (!historyHasNext || historyLoadingMore || historyLoading) return;
    setHistoryLoadingMore(true);
    try {
      const res = await fetchParentOfflineConsultations({
        status: historyFilter,
        page: historyNextPage,
        pageSize: HISTORY_PAGE_SIZE,
      });
      const b = res.body;
      setHistoryRows((prev) => sortOfflineConsultationsNewestFirst([...prev, ...b.items]));
      setHistoryHasNext(b.hasNext);
      setHistoryNextPage(b.hasNext ? b.currentPage + 1 : historyNextPage);
    } finally {
      setHistoryLoadingMore(false);
    }
  }, [historyFilter, historyHasNext, historyLoading, historyLoadingMore, historyNextPage]);

  const title = useMemo(() => 'Lịch đã đặt', []);
  const isDetail = selectedItem != null;

  const onPressOpenMap = useCallback(async (address: string | null) => {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    await Linking.openURL(url);
  }, []);

  const onPressCall = useCallback(async (phone: string) => {
    if (!phone) return;
    const tel = `tel:${phone}`;
    await Linking.openURL(tel);
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (isDetail) {
              setSelectedItem(null);
              setQuestionExpanded(false);
              return;
            }
            onClose();
          }}
          hitSlop={10}
          style={styles.headerBackBtn}
        >
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{isDetail ? 'Chi tiết lịch tư vấn' : title}</Text>
          <Text style={styles.headerSubtitle}>
            {isDetail ? 'Thông tin đầy đủ lịch tư vấn' : 'Danh sách lịch tư vấn của bạn'}
          </Text>
        </View>
      </View>

      {isDetail && selectedItem ? (
        <>
          <ScrollView style={styles.body} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View
              style={[
                styles.statusCard,
                {
                  backgroundColor: statusCardUi(selectedItem.status).bg,
                  borderColor: statusCardUi(selectedItem.status).border,
                },
              ]}
            >
              <View style={styles.statusRow}>
                <MaterialIcons name={statusCardUi(selectedItem.status).icon as any} size={22} color={statusCardUi(selectedItem.status).text} />
                <Text style={[styles.statusTitle, { color: statusCardUi(selectedItem.status).text }]}>
                  {statusCardUi(selectedItem.status).title}
                </Text>
              </View>
              <Text style={styles.statusSub}>{parentOfflineConsultationStatusVi(selectedItem.status)}</Text>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailCardTitleRow}>
                <MaterialIcons name="school" size={18} color="#1976d2" />
                <Text style={styles.detailCardTitle}>Thông tin trường</Text>
              </View>
              <Text style={styles.schoolName}>{selectedItem.schoolName ?? 'Trường đang cập nhật'}</Text>
              <Text style={styles.detailLine}>Cơ sở: {selectedItem.campusName ?? '—'}</Text>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailCardTitleRow}>
                <MaterialIcons name="event" size={18} color="#1976d2" />
                <Text style={styles.detailCardTitle}>Thời gian tư vấn</Text>
              </View>
              <Text style={styles.detailLine}>Ngày: {formatWeekdayDate(selectedItem.appointmentDate)}</Text>
              <Text style={styles.detailLine}>Giờ: {formatTimeHm(selectedItem.appointmentTime)}</Text>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailCardTitleRow}>
                <MaterialIcons name="location-on" size={18} color="#1976d2" />
                <Text style={styles.detailCardTitle}>Địa điểm</Text>
              </View>
              <Text style={styles.detailLine}>{selectedItem.address ?? 'Chưa có địa chỉ'}</Text>
              <Pressable style={styles.outlineBtn} onPress={() => void onPressOpenMap(selectedItem.address)}>
                <Text style={styles.outlineBtnText}>Xem bản đồ</Text>
              </Pressable>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailCardTitleRow}>
                <MaterialIcons name="phone" size={18} color="#1976d2" />
                <Text style={styles.detailCardTitle}>Thông tin liên hệ</Text>
              </View>
              <Text style={styles.detailLine}>{selectedItem.phone || '—'}</Text>
              <Pressable style={styles.outlineBtn} onPress={() => void onPressCall(selectedItem.phone)}>
                <Text style={styles.outlineBtnText}>Gọi ngay</Text>
              </Pressable>
            </View>

            {selectedItem.question ? (
              <View style={styles.detailCard}>
                <View style={styles.detailCardTitleRow}>
                  <MaterialIcons name="help-outline" size={18} color="#1976d2" />
                  <Text style={styles.detailCardTitle}>Câu hỏi của phụ huynh</Text>
                </View>
                <Text numberOfLines={questionExpanded ? undefined : 3} style={styles.detailLine}>
                  {selectedItem.question}
                </Text>
                {selectedItem.question.length > 120 ? (
                  <Pressable onPress={() => setQuestionExpanded((v) => !v)}>
                    <Text style={styles.expandText}>{questionExpanded ? 'Thu gọn' : 'Xem thêm'}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {selectedItem.note ? (
              <View style={styles.detailCard}>
                <View style={styles.detailCardTitleRow}>
                  <MaterialIcons name="edit-note" size={18} color="#1976d2" />
                  <Text style={styles.detailCardTitle}>Ghi chú</Text>
                </View>
                <Text style={styles.detailLine}>{selectedItem.note}</Text>
              </View>
            ) : null}

            {normalizeStatusForUi(selectedItem.status) === 'cancelled' && selectedItem.cancelReason ? (
              <View style={styles.cancelReasonCard}>
                <Text style={styles.cancelReasonTitle}>Lý do hủy</Text>
                <Text style={styles.cancelReasonText}>{selectedItem.cancelReason}</Text>
              </View>
            ) : null}
          </ScrollView>

          {(normalizeStatusForUi(selectedItem.status) === 'pending' ||
            normalizeStatusForUi(selectedItem.status) === 'confirmed') && (
            <View style={styles.bottomActionBar}>
              {normalizeStatusForUi(selectedItem.status) === 'pending' ? (
                <Pressable style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Hủy lịch</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.contactBtn} onPress={() => void onPressCall(selectedItem.phone)}>
                  <Text style={styles.contactBtnText}>Liên hệ</Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      ) : (
        <View style={styles.body}>
        <View style={styles.cardSection}>
          <Text style={styles.historyFilterTitle}>Trạng thái</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {PARENT_OFFLINE_CONSULTATION_STATUS_FILTERS.map((f) => {
              const isActive =
                (f.param == null && historyFilter == null) || (f.param != null && historyFilter === f.param);
              return (
                <Pressable
                  key={f.param ?? 'all'}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setHistoryFilter(f.param)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {historyLoading ? (
          <View style={styles.historyLoadingBox}>
            <ActivityIndicator size="small" color="#1976d2" />
            <Text style={styles.historyLoadingText}>Đang tải...</Text>
          </View>
        ) : historyError ? (
          <View style={styles.stateBox}>
            <MaterialIcons name="error-outline" size={20} color="#dc2626" />
            <Text style={styles.stateText}>{historyError}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void reloadHistory()}>
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : historyRows.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="event-busy" size={28} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Chưa có lịch</Text>
            <Text style={styles.emptySub}>Khi bạn đặt lịch tư vấn, lịch sẽ hiển thị tại đây.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.historyListScroll}
            contentContainerStyle={styles.historyListContent}
            refreshControl={<RefreshControl refreshing={historyLoading} onRefresh={() => void reloadHistory()} />}
          >
            {historyRows.map((row) => (
              <Pressable key={row.id} style={styles.historyCard} onPress={() => setSelectedItem(row)}>
                <View style={styles.historyCardTop}>
                  <Text style={styles.historyDate}>
                    {formatWeekdayDate(row.appointmentDate)} · {formatTimeHm(row.appointmentTime)}
                  </Text>
                  <View style={styles.historyStatusPill}>
                    <Text style={styles.historyStatusPillText}>{parentOfflineConsultationStatusVi(row.status)}</Text>
                  </View>
                </View>
                {row.schoolName ? <Text style={styles.historySchool}>{row.schoolName}</Text> : null}
                {row.campusName ? <Text style={styles.historyCampus}>{row.campusName}</Text> : null}
                {row.address ? <Text style={styles.historyAddress}>{row.address}</Text> : null}
              </Pressable>
            ))}
            {historyHasNext ? (
              <Pressable
                style={[styles.loadMoreBtn, historyLoadingMore && styles.loadMoreBtnDisabled]}
                disabled={historyLoadingMore}
                onPress={() => void loadMoreHistory()}
              >
                {historyLoadingMore ? (
                  <ActivityIndicator size="small" color="#1976d2" />
                ) : (
                  <Text style={styles.loadMoreText}>Xem thêm</Text>
                )}
              </Pressable>
            ) : null}
          </ScrollView>
        )}
      </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerBackBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  body: { flex: 1, padding: 16, gap: 12 },
  cardSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  historyFilterTitle: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 },
  filterScroll: { gap: 8, paddingRight: 2 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: '#e3f2fd', borderColor: '#1976d2' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#1976d2' },
  historyLoadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  historyLoadingText: { fontSize: 14, color: '#64748b' },
  historyListScroll: { flex: 1 },
  historyListContent: { gap: 10, paddingBottom: 24 },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  historyCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historyDate: { fontSize: 14, fontWeight: '700', color: '#0f172a', flex: 1 },
  historyStatusPill: {
    backgroundColor: '#e3f2fd',
    borderColor: '#bbdefb',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  historyStatusPillText: { fontSize: 11, fontWeight: '700', color: '#1565c0' },
  historySchool: { fontSize: 13, fontWeight: '700', color: '#334155' },
  historyCampus: { fontSize: 13, color: '#334155' },
  historyAddress: { fontSize: 12, color: '#64748b' },
  detailContent: { gap: 12, paddingBottom: 120 },
  statusCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTitle: { fontSize: 16, fontWeight: '700' },
  statusSub: { fontSize: 13, color: '#334155' },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailCardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  detailLine: { fontSize: 14, color: '#334155', lineHeight: 20 },
  schoolName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  outlineBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#93c5fd',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  outlineBtnText: { color: '#1d4ed8', fontSize: 13, fontWeight: '700' },
  expandText: { color: '#1976d2', fontSize: 13, fontWeight: '600' },
  cancelReasonCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 14,
    gap: 4,
  },
  cancelReasonTitle: { fontSize: 14, fontWeight: '700', color: '#b91c1c' },
  cancelReasonText: { fontSize: 13, color: '#7f1d1d' },
  bottomActionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffffeb',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  cancelBtnText: { color: '#dc2626', fontSize: 15, fontWeight: '700' },
  contactBtn: {
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976d2',
  },
  contactBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  loadMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  loadMoreBtnDisabled: { opacity: 0.7 },
  loadMoreText: { fontSize: 14, fontWeight: '700', color: '#1976d2' },
  stateBox: {
    minHeight: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
  },
  stateText: { fontSize: 13, color: '#475569', textAlign: 'center' },
  retryBtn: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: '#1976d2' },
  emptyState: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155' },
  emptySub: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 12 },
});
