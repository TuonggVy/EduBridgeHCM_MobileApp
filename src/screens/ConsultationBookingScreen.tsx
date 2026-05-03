import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import {
  bookOfflineConsultation,
  fetchParentConsultationSlots,
  fetchParentOfflineConsultations,
} from '../api/parentConsultation';
import type { ParentConsultationSlot, ParentOfflineConsultationItem } from '../types/consultation';
import {
  isParentConsultationSlotSelectable,
  parentOfflineConsultationStatusVi,
  PARENT_OFFLINE_CONSULTATION_STATUS_FILTERS,
} from '../types/consultation';
import type { SchoolDetail } from '../types/school';
import { MessageDialog } from '../components/MessageDialog';

type BookingNotice = {
  title: string;
  message: string;
  variant: 'success' | 'error' | 'info';
};

export type ConsultationBookingScreenProps = {
  visible: boolean;
  school: SchoolDetail | null;
  onClose: () => void;
  /** Mở thẳng tab lịch đã đặt (ví dụ từ Tài khoản). */
  initialSegment?: 'book' | 'history';
};

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function getWeekStart(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function formatSlotTimeRange(startTime: string, endTime: string): string {
  return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}`;
}

function getWeekdayShortLabel(date: Date): string {
  const weekday = date.getDay();
  if (weekday === 0) return 'CN';
  return `T${weekday + 1}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHistoryTime(t: string): string {
  if (!t) return '—';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

const HISTORY_PAGE_SIZE = 10;

function BookingSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonLineLg} />
      <View style={styles.skeletonGrid}>
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCard} />
      </View>
    </View>
  );
}

export default function ConsultationBookingScreen({
  visible,
  school,
  onClose,
  initialSegment = 'book',
}: ConsultationBookingScreenProps) {
  const [segment, setSegment] = useState<'book' | 'history'>(initialSegment);
  const [consultFormVisible, setConsultFormVisible] = useState(false);
  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);
  const [consultWeekStart, setConsultWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(() => toIsoDate(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<ParentConsultationSlot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, ParentConsultationSlot[]>>({});
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingQuestion, setBookingQuestion] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  const [historyRows, setHistoryRows] = useState<ParentOfflineConsultationItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyHasNext, setHistoryHasNext] = useState(false);
  const [historyNextPage, setHistoryNextPage] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<string | null>(null);
  const [bookingNotice, setBookingNotice] = useState<BookingNotice | null>(null);

  const campusList = useMemo(() => school?.campusList ?? [], [school?.campusList]);
  const selectedCampus = useMemo(
    () => campusList.find((campus) => campus.id === selectedCampusId) ?? null,
    [campusList, selectedCampusId]
  );
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(consultWeekStart, i)), [consultWeekStart]);
  const weekDateKeys = useMemo(() => weekDates.map((date) => toIsoDate(date)), [weekDates]);
  const selectedDateSlots = useMemo(() => slotsByDate[selectedDate] ?? [], [slotsByDate, selectedDate]);
  const availableSlotsCount = useMemo(
    () => selectedDateSlots.filter((slot) => isParentConsultationSlotSelectable(slot)).length,
    [selectedDateSlots]
  );
  const today = useMemo(() => new Date(), []);

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
      setHistoryRows(b.items);
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
    if (!visible) {
      setBookingNotice(null);
      return;
    }
    setSegment(initialSegment);
    const firstCampusId = school?.campusList?.[0]?.id ?? null;
    setSelectedCampusId(firstCampusId);
    setConsultWeekStart(getWeekStart(new Date()));
    setSelectedDate(toIsoDate(new Date()));
    setSelectedSlot(null);
    setSlotsByDate({});
    setSlotsError(null);
    setConsultFormVisible(false);
  }, [visible, initialSegment, school?.id]);

  useEffect(() => {
    if (!visible || !selectedCampusId) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    void fetchParentConsultationSlots(selectedCampusId, toIsoDate(weekDates[0]), toIsoDate(weekDates[6]))
      .then((res) => {
        if (cancelled) return;
        const grouped: Record<string, ParentConsultationSlot[]> = {};
        for (const slot of res.body) {
          if (!grouped[slot.date]) grouped[slot.date] = [];
          grouped[slot.date].push(slot);
        }
        for (const key of Object.keys(grouped)) {
          grouped[key].sort((a, b) => a.startTime.localeCompare(b.startTime));
        }
        setSlotsByDate(grouped);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSlotsByDate({});
        setSlotsError(error instanceof Error ? error.message : 'Không tải được lịch tư vấn.');
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, selectedCampusId, weekDates]);

  useEffect(() => {
    if (!weekDateKeys.includes(selectedDate)) {
      setSelectedDate(weekDateKeys[0]);
      setSelectedSlot(null);
    }
  }, [selectedDate, weekDateKeys]);

  useEffect(() => {
    if (!visible || segment !== 'history') return;
    void reloadHistory();
  }, [visible, segment, historyFilter, reloadHistory]);

  const loadMoreHistory = async () => {
    if (!historyHasNext || historyLoadingMore || historyLoading) return;
    setHistoryLoadingMore(true);
    try {
      const res = await fetchParentOfflineConsultations({
        status: historyFilter,
        page: historyNextPage,
        pageSize: HISTORY_PAGE_SIZE,
      });
      const b = res.body;
      setHistoryRows((prev) => [...prev, ...b.items]);
      setHistoryHasNext(b.hasNext);
      setHistoryNextPage(b.hasNext ? b.currentPage + 1 : historyNextPage);
    } catch {
      // giữ danh sách hiện có
    } finally {
      setHistoryLoadingMore(false);
    }
  };

  const handleOpenForm = () => {
    if (!selectedSlot) {
      setBookingNotice({
        title: 'Chưa chọn khung giờ',
        message: 'Vui lòng chọn một slot tư vấn trước khi đặt lịch.',
        variant: 'info',
      });
      return;
    }
    setConsultFormVisible(true);
  };

  const handleSubmit = async () => {
    if (!selectedSlot || selectedCampusId == null) return;
    const phone = bookingPhone.trim();
    if (!phone) {
      setBookingNotice({
        title: 'Thiếu số điện thoại',
        message: 'Vui lòng nhập số điện thoại để đặt lịch tư vấn.',
        variant: 'info',
      });
      return;
    }
    setBookingSubmitting(true);
    try {
      await bookOfflineConsultation({
        phone,
        question: bookingQuestion.trim(),
        appointmentDate: selectedSlot.date,
        appointmentTime: selectedSlot.startTime,
        campusId: selectedCampusId,
      });
      setConsultFormVisible(false);
      setBookingPhone('');
      setBookingQuestion('');
      setBookingNotice({
        title: 'Đặt lịch thành công',
        message: 'Nhà trường sẽ liên hệ xác nhận lịch tư vấn với bạn.',
        variant: 'success',
      });
    } catch (error: unknown) {
      setBookingNotice({
        title: 'Không thể đặt lịch',
        message: error instanceof Error ? error.message : 'Vui lòng thử lại.',
        variant: 'error',
      });
    } finally {
      setBookingSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.headerBackBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Lịch tư vấn</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {segment === 'book'
              ? selectedCampus?.name ?? campusList[0]?.name ?? 'Cơ sở'
              : 'Lịch đã đặt của bạn'}
          </Text>
        </View>
      </View>

      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segmentChip, segment === 'book' && styles.segmentChipActive]}
          onPress={() => setSegment('book')}
        >
          <Text style={[styles.segmentChipText, segment === 'book' && styles.segmentChipTextActive]}>Đặt lịch</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentChip, segment === 'history' && styles.segmentChipActive]}
          onPress={() => setSegment('history')}
        >
          <Text style={[styles.segmentChipText, segment === 'history' && styles.segmentChipTextActive]}>Lịch đã đặt</Text>
        </Pressable>
      </View>

      {segment === 'book' && !school ? (
        <View style={styles.noSchoolWrap}>
          <MaterialIcons name="school" size={40} color="#94a3b8" />
          <Text style={styles.noSchoolTitle}>Chọn trường để đặt lịch</Text>
          <Text style={styles.noSchoolSub}>Vào chi tiết trường và chọn đặt lịch tư vấn tại cơ sở.</Text>
          <Text style={styles.noSchoolSub}>Hoặc xem lịch đã đặt ở tab &quot;Lịch đã đặt&quot;.</Text>
        </View>
      ) : segment === 'book' ? (
        <>
          <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.cardSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.campusScroll}>
                {campusList.map((campus) => (
                  <Pressable
                    key={`campus-${campus.id}`}
                    style={({ pressed }) => [
                      styles.campusChip,
                      selectedCampusId === campus.id && styles.campusChipSelected,
                      pressed && styles.pressScale,
                    ]}
                    onPress={() => {
                      setSelectedCampusId(campus.id);
                      setSelectedSlot(null);
                    }}
                  >
                    <MaterialIcons
                      name="location-on"
                      size={14}
                      color={selectedCampusId === campus.id ? '#fff' : '#64748b'}
                    />
                    <Text style={[styles.campusChipText, selectedCampusId === campus.id && styles.campusChipTextSelected]}>
                      {campus.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.cardSection}>
              <View style={styles.weekRow}>
                <Pressable
                  style={({ pressed }) => [styles.navBtn, pressed && styles.pressScale]}
                  onPress={() => setConsultWeekStart((prev) => addDays(prev, -7))}
                >
                  <MaterialIcons name="chevron-left" size={20} color="#1976d2" />
                </Pressable>
                <Text style={styles.weekLabel}>
                  {toIsoDate(weekDates[0])} - {toIsoDate(weekDates[6])}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.navBtn, pressed && styles.pressScale]}
                  onPress={() => setConsultWeekStart((prev) => addDays(prev, 7))}
                >
                  <MaterialIcons name="chevron-right" size={20} color="#1976d2" />
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                {weekDates.map((day) => {
                  const dayKey = toIsoDate(day);
                  const isSelected = selectedDate === dayKey;
                  const daySlots = slotsByDate[dayKey] ?? [];
                  const hasSelectable = daySlots.some((slot) => isParentConsultationSlotSelectable(slot));
                  const isToday = isSameDay(day, today);
                  return (
                    <Pressable
                      key={dayKey}
                      disabled={!hasSelectable}
                      style={({ pressed }) => [
                        styles.dateChip,
                        isSelected && styles.dateChipSelected,
                        isToday && !isSelected && styles.dateChipToday,
                        !hasSelectable && styles.dateChipDisabled,
                        pressed && hasSelectable && styles.pressScale,
                      ]}
                      onPress={() => {
                        setSelectedDate(dayKey);
                        setSelectedSlot(null);
                      }}
                    >
                      <Text style={[styles.dateWeekday, isSelected && styles.dateSelectedText]}>
                        {getWeekdayShortLabel(day)}
                      </Text>
                      <Text style={[styles.dateDay, isSelected && styles.dateSelectedText]}>
                        {String(day.getDate()).padStart(2, '0')}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.cardSection}>
              <View style={styles.slotHeaderRow}>
                <Text style={styles.slotHeaderTitle}>Khung giờ khả dụng</Text>
                <View style={styles.slotBadge}>
                  <Text style={styles.slotBadgeText}>Còn {availableSlotsCount} slot</Text>
                </View>
              </View>

              {slotsLoading ? (
                <BookingSkeleton />
              ) : slotsError ? (
                <View style={styles.stateBox}>
                  <MaterialIcons name="error-outline" size={20} color="#dc2626" />
                  <Text style={styles.stateText}>{slotsError}</Text>
                </View>
              ) : selectedDateSlots.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="calendar-today" size={28} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>Không có lịch tư vấn</Text>
                  <Text style={styles.emptySub}>Vui lòng chọn ngày khác</Text>
                </View>
              ) : (
                <View style={styles.slotGrid}>
                  {selectedDateSlots.map((slot) => {
                    const isDisabled = !isParentConsultationSlotSelectable(slot);
                    const isSelected = selectedSlot?.campusScheduleTemplateId === slot.campusScheduleTemplateId;
                    return (
                      <Pressable
                        key={`${slot.date}-${slot.campusScheduleTemplateId}`}
                        disabled={isDisabled}
                        style={({ pressed }) => [
                          styles.slotCard,
                          isDisabled && styles.slotDisabled,
                          isSelected && styles.slotSelected,
                          pressed && !isDisabled && styles.pressScale,
                        ]}
                        onPress={() => setSelectedSlot(slot)}
                      >
                        <Text style={[styles.slotTime, isSelected && styles.slotSelectedText]}>
                          {formatSlotTimeRange(slot.startTime, slot.endTime)}
                        </Text>
                        <Text style={[styles.slotStatus, isSelected && styles.slotSelectedSubText]}>
                          {slot.statusLabel || slot.status}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.bottomCtaWrap}>
            <Pressable
              style={[styles.bookBtn, !selectedSlot && styles.bookBtnDisabled]}
              onPress={handleOpenForm}
            >
              {selectedSlot ? (
                <LinearGradient
                  colors={['#1976d2', '#42a5f5']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.bookGradient}
                >
                  <Text style={styles.bookBtnText}>Đặt lịch</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.bookBtnText}>Đặt lịch</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.historyBody}>
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
            <ScrollView style={styles.historyListScroll} contentContainerStyle={styles.historyListContent}>
              {historyRows.map((row) => (
                <View key={row.id} style={styles.historyCard}>
                  <View style={styles.historyCardTop}>
                    <Text style={styles.historyDate}>
                      {row.appointmentDate} · {formatHistoryTime(row.appointmentTime)}
                    </Text>
                    <View style={styles.historyStatusPill}>
                      <Text style={styles.historyStatusPillText}>{parentOfflineConsultationStatusVi(row.status)}</Text>
                    </View>
                  </View>
                  {row.question ? <Text style={styles.historyQuestion}>{row.question}</Text> : null}
                  <Text style={styles.historyPhone}>{row.phone}</Text>
                </View>
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

      <Modal visible={consultFormVisible} transparent animationType="slide" onRequestClose={() => setConsultFormVisible(false)}>
        <KeyboardAvoidingView
          style={styles.formKeyboardRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
        >
          <Pressable style={styles.formBackdrop} onPress={() => setConsultFormVisible(false)}>
            <View style={styles.formCard} onStartShouldSetResponder={() => true}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.formScrollContent}
              >
                <View style={styles.formHeader}>
                  <Text style={styles.formTitle}>Đặt lịch tư vấn</Text>
                  <Pressable onPress={() => setConsultFormVisible(false)} hitSlop={8}>
                    <MaterialIcons name="close" size={20} color="#64748b" />
                  </Pressable>
                </View>
                <Text style={styles.formLabel}>Số điện thoại</Text>
                <TextInput value={bookingPhone} onChangeText={setBookingPhone} placeholder="Nhập số điện thoại" keyboardType="phone-pad" style={styles.input} />
                <Text style={styles.formLabel}>Câu hỏi</Text>
                <TextInput
                  value={bookingQuestion}
                  onChangeText={setBookingQuestion}
                  placeholder="Bạn muốn tư vấn điều gì?"
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.textarea]}
                />
                <Text style={styles.formLabel}>Khung giờ</Text>
                <View style={styles.readonlyField}>
                  <Text style={styles.readonlyText}>{selectedSlot ? formatSlotTimeRange(selectedSlot.startTime, selectedSlot.endTime) : '—'}</Text>
                </View>
                <Text style={styles.formLabel}>Ngày hẹn</Text>
                <View style={styles.readonlyField}>
                  <Text style={styles.readonlyText}>{selectedSlot?.date ?? '—'}</Text>
                </View>
                <Pressable style={[styles.submitBtn, bookingSubmitting && styles.submitBtnDisabled]} disabled={bookingSubmitting} onPress={handleSubmit}>
                  <Text style={styles.submitText}>{bookingSubmitting ? 'Đang gửi...' : 'Đặt lịch tư vấn'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <MessageDialog
        visible={bookingNotice != null}
        title={bookingNotice?.title ?? ''}
        message={bookingNotice?.message ?? ''}
        variant={bookingNotice?.variant ?? 'info'}
        onClose={() => setBookingNotice(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerBackBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { marginTop: 2, fontSize: 13, color: '#64748b' },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  segmentChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  segmentChipActive: { backgroundColor: '#1976d2' },
  segmentChipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  segmentChipTextActive: { color: '#fff' },
  noSchoolWrap: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noSchoolTitle: { fontSize: 17, fontWeight: '700', color: '#334155', marginTop: 8 },
  noSchoolSub: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  contentScroll: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 120, gap: 12 },
  historyBody: { flex: 1, padding: 16, gap: 12 },
  historyFilterTitle: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 },
  filterScroll: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
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
  historyStatusPill: { backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  historyStatusPillText: { fontSize: 11, fontWeight: '700', color: '#2e7d32' },
  historyQuestion: { fontSize: 14, color: '#334155' },
  historyPhone: { fontSize: 13, color: '#64748b' },
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
  retryBtn: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: '#1976d2' },
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
  campusScroll: { marginHorizontal: -2 },
  campusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
  },
  campusChipSelected: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  campusChipText: { color: '#334155', fontSize: 12, fontWeight: '600' },
  campusChipTextSelected: { color: '#fff' },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd',
  },
  weekLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  dateScroll: { height: 84 },
  dateChip: {
    width: 70,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginRight: 8,
    paddingVertical: 8,
  },
  dateChipSelected: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  dateChipToday: { borderWidth: 2, borderColor: '#16a34a' },
  dateChipDisabled: { opacity: 0.5 },
  dateWeekday: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  dateDay: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  dateSelectedText: { color: '#fff' },
  slotHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  slotHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  slotBadge: { borderRadius: 999, backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 4 },
  slotBadgeText: { fontSize: 12, fontWeight: '700', color: '#2e7d32' },
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
  emptyState: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155' },
  emptySub: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 12 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  slotCard: {
    width: '48.5%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    gap: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  slotDisabled: { backgroundColor: '#e5e7eb', borderColor: '#d1d5db', opacity: 0.75 },
  slotSelected: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  slotTime: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  slotStatus: { fontSize: 12, color: '#64748b' },
  slotSelectedText: { color: '#fff' },
  slotSelectedSubText: { color: '#dbeafe' },
  bottomCtaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 22,
    backgroundColor: '#ffffffeb',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  bookBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#90caf9',
    overflow: 'hidden',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnDisabled: { backgroundColor: '#90caf9' },
  bookBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  formKeyboardRoot: { flex: 1 },
  formBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  formCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
  },
  formScrollContent: { gap: 10, paddingBottom: 28 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  formTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  input: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  textarea: { minHeight: 90 },
  readonlyField: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#f8fafc' },
  readonlyText: { fontSize: 14, color: '#0f172a', fontWeight: '600' },
  submitBtn: { marginTop: 6, height: 46, borderRadius: 12, backgroundColor: '#1976d2', alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.8 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  skeletonWrap: { gap: 12 },
  skeletonLineLg: {
    width: '52%',
    height: 14,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  skeletonCard: {
    width: '48.5%',
    height: 72,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  pressScale: { transform: [{ scale: 0.97 }] },
});
