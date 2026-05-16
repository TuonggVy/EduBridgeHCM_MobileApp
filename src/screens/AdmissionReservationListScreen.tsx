import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import {
  fetchParentDocumentCatalog,
  type ReservationFormItem,
} from '../api/admissionReservation';
import { formatGradeLevel } from '../utils/gradeLevel';

const { width: WIN_W, height: WIN_H } = Dimensions.get('window');

type Props = {
  visible: boolean;
  item: ReservationFormItem | null;
  onBack: () => void;
};

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

export default function AdmissionReservationListScreen({ visible, item, onBack }: Props) {
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [docNameByCode, setDocNameByCode] = useState<Map<string, string>>(new Map());

  const loadDocCatalog = useCallback(async () => {
    try {
      const res = await fetchParentDocumentCatalog();
      const map = new Map<string, string>();
      (Array.isArray(res.body) ? res.body : []).forEach((doc) => map.set(doc.code, doc.name));
      setDocNameByCode(map);
    } catch {
      setDocNameByCode(new Map());
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void loadDocCatalog();
  }, [visible, loadDocCatalog]);

  useEffect(() => {
    if (!visible) {
      setPreviewImages([]);
      setPreviewIndex(0);
    }
  }, [visible]);

  const openPreview = (images: string[], index: number) => {
    if (images.length === 0) return;
    setPreviewImages(images);
    setPreviewIndex(index);
  };

  if (!visible || !item) return null;

  const status = statusUi(item.status);
  const reason = item.rejectReason?.trim() || item.cancelReason?.trim() || null;
  const reasonTitle =
    item.status === 'RESERVATION_CANCELLED'
      ? 'Lý do huỷ'
      : item.status === 'RESERVATION_REJECTED'
        ? 'Lý do từ chối'
        : 'Ghi chú';
  const metadata = Array.isArray(item.profileMetaData) ? item.profileMetaData : [];
  const programLabel = displayText(item.programName, '');
  const transcripts = (item.transcriptImages ?? []).filter((t) => Boolean(t.imageUrl));

  return (
    <LinearGradient colors={['#f8fafc', '#f1f5f9']} style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerShell}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <MaterialIcons name="arrow-back-ios-new" size={18} color="#0f172a" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Chi tiết đơn</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {displayText(item.schoolName, 'Đơn giữ chỗ')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.schoolAvatar}>
              <MaterialIcons name="school" size={20} color="#1976d2" />
            </View>
            <View style={styles.schoolBlock}>
              <Text style={styles.schoolName}>{displayText(item.schoolName, 'Trường học')}</Text>
              {programLabel ? (
                <Text style={styles.schoolSub} numberOfLines={1}>
                  {programLabel}
                </Text>
              ) : null}
            </View>
            <LinearGradient colors={status.colors} style={styles.statusChip}>
              <View style={styles.statusIconDot}>
                <MaterialIcons name={status.icon} size={12} color={status.text} />
              </View>
              <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
            </LinearGradient>
          </View>

          <Text style={styles.sectionTitle}>Thông tin học sinh</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>HỌ TÊN</Text>
              <Text style={styles.infoValue} numberOfLines={2}>
                {displayText(item.studentName)}
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>CCCD HỌC SINH</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {displayText(item.studentCode)}
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>GIỚI TÍNH</Text>
              <Text style={styles.infoValue}>{genderLabel(item.gender)}</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Thông tin phụ huynh</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>HỌ TÊN</Text>
              <Text style={styles.infoValue} numberOfLines={2}>
                {displayText(item.parentName)}
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>CCCD PHỤ HUYNH</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {displayText(item.identityCard)}
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>SỐ ĐIỆN THOẠI</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {displayText(item.parentPhone)}
              </Text>
            </View>
            <View style={styles.infoItemFull}>
              <Text style={styles.infoLabel}>EMAIL</Text>
              <Text style={styles.infoValue} numberOfLines={2}>
                {displayText(item.parentEmail)}
              </Text>
            </View>
          </View>

          <View style={styles.submittedBox}>
            <Text style={styles.infoLabel}>NGÀY NỘP</Text>
            <Text style={styles.infoValue}>{formatDateTime(item.createdTime)}</Text>
          </View>

          {item.address?.trim() ? (
            <View style={styles.addressBox}>
              <Text style={styles.infoLabel}>ĐỊA CHỈ</Text>
              <Text style={styles.infoValue}>{item.address.trim()}</Text>
            </View>
          ) : null}

          {metadata.some((m) => (m.imageUrl?.length ?? 0) > 0) ? (
            <>
              <Text style={styles.uploadTitle}>Tài liệu hồ sơ</Text>
              {metadata.map((m) => {
                const urls = (m.imageUrl ?? []).filter(Boolean);
                if (!urls.length) return null;
                return (
                  <View key={`${item.id}-${m.key}`} style={styles.metaBlock}>
                    <Text style={styles.metaKey}>{docNameByCode.get(m.key) ?? m.key}</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.imageRow}
                    >
                      {urls.map((url, idx) => (
                        <Pressable
                          key={`${m.key}-${idx}`}
                          onPress={() => openPreview(urls, idx)}
                          style={styles.thumbWrap}
                        >
                          <Image source={{ uri: url }} style={styles.thumb} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                );
              })}
            </>
          ) : null}

          {transcripts.length > 0 ? (
            <>
              <Text style={styles.uploadTitle}>Ảnh học bạ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
                {transcripts.map((t, idx) => {
                  const url = t.imageUrl!;
                  const allUrls = transcripts.map((x) => x.imageUrl!).filter(Boolean);
                  return (
                    <Pressable
                      key={`${item.id}-transcript-${t.grade}-${idx}`}
                      style={styles.transcriptCard}
                      onPress={() => openPreview(allUrls, idx)}
                    >
                      <Image source={{ uri: url }} style={styles.transcriptThumb} />
                      <Text style={styles.transcriptGrade}>{formatGradeLevel(t.grade) || t.grade}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {reason ? (
            <View style={styles.reasonBox}>
              <View style={styles.reasonHead}>
                <View style={styles.reasonIconWrap}>
                  <MaterialIcons name="report-gmailerrorred" size={16} color="#ef4444" />
                </View>
                <Text style={styles.reasonTitle}>{reasonTitle}</Text>
              </View>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          ) : null}

          {item.verifiedBy?.trim() ? (
            <View style={styles.verifyBox}>
              <View style={styles.verifyHead}>
                <MaterialIcons name="verified" size={16} color="#16a34a" />
                <Text style={styles.verifyText}>Được xét duyệt bởi</Text>
              </View>
              <Text style={styles.verifyEmail}>{item.verifiedBy.trim()}</Text>
            </View>
          ) : null}

          <Text style={styles.footerMeta}>Cập nhật: {formatDateTime(item.updatedTime)}</Text>
        </View>
      </ScrollView>

      {previewImages.length > 0 ? (
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewBackdrop} onPress={() => setPreviewImages([])} />
          <View style={styles.previewHead}>
            <Pressable onPress={() => setPreviewImages([])} style={styles.previewCloseBtn} hitSlop={12}>
              <MaterialIcons name="close" size={20} color="#fff" />
            </Pressable>
            <Text style={styles.previewCounter}>
              {previewIndex + 1}/{previewImages.length}
            </Text>
          </View>
          {previewImages[previewIndex] ? (
            <Image
              source={{ uri: previewImages[previewIndex] }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewThumbRow}>
            {previewImages.map((img, idx) => (
              <Pressable key={`${img}-${idx}`} onPress={() => setPreviewIndex(idx)}>
                <Image
                  source={{ uri: img }}
                  style={[styles.previewThumb, idx === previewIndex && styles.previewThumbActive]}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerShell: { paddingTop: 56, paddingHorizontal: 14, paddingBottom: 4 },
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
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32 },
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
  sectionTitle: { marginTop: 14, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  sectionTitleSpaced: { marginTop: 16 },
  infoGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoBox: {
    width: '48%',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    padding: 10,
    minHeight: 62,
  },
  infoItemFull: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    padding: 10,
    minHeight: 62,
  },
  submittedBox: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    padding: 10,
  },
  addressBox: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    padding: 10,
  },
  infoLabel: { fontSize: 10, color: '#64748b', fontWeight: '700' },
  infoValue: { marginTop: 4, fontSize: 12, color: '#0f172a', fontWeight: '700' },
  uploadTitle: { marginTop: 14, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  metaBlock: { marginTop: 10 },
  metaKey: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 8 },
  imageRow: { gap: 8 },
  thumbWrap: { borderRadius: 18, overflow: 'hidden' },
  thumb: { width: 102, height: 102, borderRadius: 18, backgroundColor: '#f1f5f9' },
  transcriptCard: {
    width: 112,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  transcriptThumb: { width: 112, height: 84, backgroundColor: '#f1f5f9' },
  transcriptGrade: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  reasonBox: { marginTop: 12, borderRadius: 16, padding: 12, backgroundColor: '#fff1f2' },
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
  verifyBox: { marginTop: 12, borderRadius: 16, padding: 12, backgroundColor: '#f0fdf4' },
  verifyHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifyText: { fontSize: 12, color: '#166534', fontWeight: '700' },
  verifyEmail: { marginTop: 4, fontSize: 12, color: '#15803d' },
  footerMeta: { marginTop: 14, fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  previewOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 200, elevation: 200 },
  previewBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.94)' },
  previewHead: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 201,
  },
  previewCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  previewCounter: { color: '#fff', fontSize: 13, fontWeight: '700' },
  previewImage: {
    position: 'absolute',
    top: Math.round(WIN_H * 0.12),
    left: 16,
    width: WIN_W - 32,
    height: Math.round(WIN_H * 0.58),
  },
  previewThumbRow: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 8,
  },
  previewThumb: { width: 56, height: 56, borderRadius: 10, opacity: 0.65 },
  previewThumbActive: { opacity: 1, borderWidth: 2, borderColor: '#60a5fa' },
});
