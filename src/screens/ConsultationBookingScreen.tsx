import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import { fetchParentConsultationSlots, bookOfflineConsultation } from '../api/parentConsultation';
import type { ParentConsultationSlot } from '../types/consultation';
import type { SchoolDetail } from '../types/school';

type Props = {
  visible: boolean;
  school: SchoolDetail | null;
  onClose: () => void;
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

function asDateOnly(value: string): Date | null {
  if (!value) return null;
  const dt = new Date(`${value}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

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

export default function ConsultationBookingScreen({ visible, school, onClose }: Props) {
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

  const campusList = useMemo(() => school?.campusList ?? [], [school?.campusList]);
  const selectedCampus = useMemo(() => campusList.find((campus) => campus.id === selectedCampusId) ?? null, [campusList, selectedCampusId]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(consultWeekStart, i)), [consultWeekStart]);
  const weekDateKeys = useMemo(() => weekDates.map((date) => toIsoDate(date)), [weekDates]);
  const selectedDateSlots = useMemo(() => slotsByDate[selectedDate] ?? [], [slotsByDate, selectedDate]);
  const availableSlotsCount = useMemo(
    () => selectedDateSlots.filter((slot) => slot.status !== 'PAST').length,
    [selectedDateSlots]
  );
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!visible) return;
    const firstCampusId = campusList[0]?.id ?? null;
    setSelectedCampusId(firstCampusId);
    setConsultWeekStart(getWeekStart(new Date()));
    setSelectedDate(toIsoDate(new Date()));
    setSelectedSlot(null);
    setSlotsByDate({});
    setSlotsError(null);
    setConsultFormVisible(false);
  }, [visible, campusList]);

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

  const handleOpenForm = () => {
    if (!selectedSlot) {
      Alert.alert('Chưa chọn khung giờ', 'Vui lòng chọn một slot tư vấn trước khi đặt lịch.');
      return;
    }
    setConsultFormVisible(true);
  };

  const handleSubmit = async () => {
    if (!selectedSlot) return;
    const phone = bookingPhone.trim();
    if (!phone) {
      Alert.alert('Thiếu số điện thoại', 'Vui lòng nhập số điện thoại để đặt lịch tư vấn.');
      return;
    }
    setBookingSubmitting(true);
    try {
      await bookOfflineConsultation({
        phone,
        question: bookingQuestion.trim(),
        appointmentDate: selectedSlot.date,
        appointmentTime: selectedSlot.startTime,
      });
      setConsultFormVisible(false);
      setBookingPhone('');
      setBookingQuestion('');
      Alert.alert('Đặt lịch thành công', 'Nhà trường sẽ liên hệ xác nhận lịch tư vấn với bạn.');
    } catch (error: unknown) {
      Alert.alert('Không thể đặt lịch', error instanceof Error ? error.message : 'Vui lòng thử lại.');
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
            {selectedCampus?.name ?? campusList[0]?.name ?? 'Cơ sở'}
          </Text>
        </View>
      </View>

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
              const hasAvailableSlot = daySlots.some((slot) => slot.status !== 'PAST');
              const isToday = isSameDay(day, today);
              return (
                <Pressable
                  key={dayKey}
                  disabled={!hasAvailableSlot}
                  style={({ pressed }) => [
                    styles.dateChip,
                    isSelected && styles.dateChipSelected,
                    isToday && !isSelected && styles.dateChipToday,
                    !hasAvailableSlot && styles.dateChipDisabled,
                    pressed && hasAvailableSlot && styles.pressScale,
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
                const isDisabled = slot.status === 'PAST';
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

      <Modal visible={consultFormVisible} transparent animationType="slide" onRequestClose={() => setConsultFormVisible(false)}>
        <Pressable style={styles.formBackdrop} onPress={() => setConsultFormVisible(false)}>
          <Pressable style={styles.formCard} onPress={() => {}}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Đặt lịch tư vấn</Text>
              <Pressable onPress={() => setConsultFormVisible(false)} hitSlop={8}>
                <MaterialIcons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>
            <Text style={styles.formLabel}>Số điện thoại</Text>
            <TextInput value={bookingPhone} onChangeText={setBookingPhone} placeholder="Nhập số điện thoại" keyboardType="phone-pad" style={styles.input} />
            <Text style={styles.formLabel}>Câu hỏi</Text>
            <TextInput value={bookingQuestion} onChangeText={setBookingQuestion} placeholder="Bạn muốn tư vấn điều gì?" multiline textAlignVertical="top" style={[styles.input, styles.textarea]} />
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
          </Pressable>
        </Pressable>
      </Modal>
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
  contentScroll: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 120, gap: 12 },
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
  emptySub: { fontSize: 13, color: '#64748b' },
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
  formBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  formCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 26, gap: 10 },
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
