import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RequiredSubmissionDocumentsModal } from '../components/RequiredSubmissionDocumentsModal';
import { SystemFeedbackModal } from '../components/SystemFeedbackModal';
import {
  confirmReservationEnrollment,
  fetchParentDocumentCatalog,
  type ReservationFormItem,
} from '../api/admissionReservation';
import { formatGradeLevel } from '../utils/gradeLevel';
import {
  canConfirmReservationEnrollment,
  canSubmitReservationPayment,
  canViewRequiredSubmissionDocuments,
  isReservationPaymentAgain,
  reservationDisplayReason,
  reservationReasonTitle,
  reservationStatusUi,
} from '../utils/reservationStatus';
import ReservationPaymentScreen from './ReservationPaymentScreen';

const { width: WIN_W, height: WIN_H } = Dimensions.get('window');

type EnrollmentFeedbackState = {
  visible: boolean;
  title: string;
  message: string;
  variant: 'success' | 'error';
};

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

export default function AdmissionReservationListScreen({
  visible,
  item,
  onBack,
  onPaymentSuccess,
}: Props & { onPaymentSuccess?: (result?: { paymentResubmitCount: number }) => void }) {
  const insets = useSafeAreaInsets();
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [docNameByCode, setDocNameByCode] = useState<Map<string, string>>(new Map());
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [requiredDocsVisible, setRequiredDocsVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [enrollmentFeedback, setEnrollmentFeedback] = useState<EnrollmentFeedbackState>({
    visible: false,
    title: '',
    message: '',
    variant: 'success',
  });

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
      setPaymentVisible(false);
      setRequiredDocsVisible(false);
      setConfirmVisible(false);
      setConfirming(false);
      setEnrollmentFeedback({ visible: false, title: '', message: '', variant: 'success' });
    }
  }, [visible]);

  const handleConfirmEnrollment = async () => {
    if (!item || confirming) return;
    setConfirming(true);
    try {
      await confirmReservationEnrollment(item.id);
      setConfirmVisible(false);
      onPaymentSuccess?.();
      setEnrollmentFeedback({
        visible: true,
        title: 'Thành công',
        message: 'Đã xác nhận nhập học.',
        variant: 'success',
      });
    } catch (e: unknown) {
      setEnrollmentFeedback({
        visible: true,
        title: 'Không xác nhận được nhập học',
        message: e instanceof Error ? e.message : 'Vui lòng thử lại sau.',
        variant: 'error',
      });
    } finally {
      setConfirming(false);
    }
  };

  const openPreview = (images: string[], index: number) => {
    if (images.length === 0) return;
    setPreviewImages(images);
    setPreviewIndex(index);
  };

  if (!visible || !item) return null;

  const status = reservationStatusUi(item.status);
  const reason = reservationDisplayReason(item);
  const reasonTitle = reservationReasonTitle(item.status);
  const metadata = Array.isArray(item.profileMetaData) ? item.profileMetaData : [];
  const programLabel = displayText(item.programName, '');
  const transcripts = (item.transcriptImages ?? []).filter((t) => Boolean(t.imageUrl));
  const paymentProofUrl = item.paymentProofUrl?.trim() || null;
  const showPaymentCta = canSubmitReservationPayment(item);
  const showConfirmCta = canConfirmReservationEnrollment(item.status);
  const showRequiredDocsCta = canViewRequiredSubmissionDocuments(item.status);
  const isPaymentAgain = isReservationPaymentAgain(item.status);
  const showBottomBar = showPaymentCta || showConfirmCta || showRequiredDocsCta;

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

      <ScrollView
        contentContainerStyle={[
          styles.content,
          showBottomBar && { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
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

          {paymentProofUrl ? (
            <View style={styles.paymentProofSection}>
              <View style={styles.paymentProofHead}>
                <MaterialIcons name="receipt-long" size={18} color="#1976d2" />
                <Text style={styles.paymentProofTitle}>Minh chứng thanh toán</Text>
              </View>
              <Text style={styles.paymentProofHint}>Ảnh chụp màn hình giao dịch đã nộp</Text>
              <Pressable
                onPress={() => openPreview([paymentProofUrl], 0)}
                style={({ pressed }) => [styles.paymentProofCard, pressed && { opacity: 0.92 }]}
              >
                <Image source={{ uri: paymentProofUrl }} style={styles.paymentProofImage} resizeMode="cover" />
                <View style={styles.paymentProofZoom}>
                  <MaterialIcons name="zoom-in" size={18} color="#fff" />
                  <Text style={styles.paymentProofZoomText}>Nhấn để xem ảnh</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {item.status === 'RESERVATION_PAYMENT_REJECTED' && !showPaymentCta ? (
            <View style={styles.retryExhaustedBox}>
              <MaterialIcons name="info-outline" size={18} color="#b45309" />
              <Text style={styles.retryExhaustedText}>
                Đã hết lượt nộp lại minh chứng (tối đa 3 lần). Vui lòng liên hệ nhà trường để được hỗ trợ.
              </Text>
            </View>
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

      {showBottomBar ? (
        <View style={[styles.paymentBar, { paddingBottom: insets.bottom + 12 }]}>
          {showPaymentCta ? (
            <Pressable
              onPress={() => setPaymentVisible(true)}
              style={({ pressed }) => [styles.paymentBtnWrap, pressed && { opacity: 0.92 }]}
            >
              <LinearGradient
                colors={['#1976d2', '#42a5f5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.paymentBtn}
              >
                <MaterialIcons name="payments" size={20} color="#fff" />
                <Text style={styles.paymentBtnText}>
                  {isPaymentAgain ? 'Nộp lại phí giữ chỗ' : 'Nộp phí giữ chỗ'}
                </Text>
                <MaterialIcons name="qr-code-2" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          ) : null}
          {showConfirmCta ? (
            <Pressable
              onPress={() => setConfirmVisible(true)}
              disabled={confirming}
              style={({ pressed }) => [
                styles.paymentBtnWrap,
                showPaymentCta && { marginTop: 10 },
                pressed && { opacity: 0.92 },
              ]}
            >
              <LinearGradient
                colors={['#15803d', '#22c55e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.paymentBtn}
              >
                {confirming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialIcons name="how-to-reg" size={20} color="#fff" />
                )}
                <Text style={styles.paymentBtnText}>Xác nhận nhập học</Text>
              </LinearGradient>
            </Pressable>
          ) : null}
          {showRequiredDocsCta ? (
            <Pressable
              onPress={() => setRequiredDocsVisible(true)}
              style={({ pressed }) => [
                styles.paymentBtnWrap,
                (showPaymentCta || showConfirmCta) && { marginTop: 10 },
                pressed && { opacity: 0.92 },
              ]}
            >
              <View style={styles.outlinePaymentBtn}>
                <MaterialIcons name="folder-special" size={20} color="#1976d2" />
                <Text style={styles.outlinePaymentBtnText}>Hồ sơ cần nộp</Text>
                <MaterialIcons name="chevron-right" size={22} color="#1976d2" />
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmVisible}
        title="Xác nhận nhập học"
        message="Bạn có chắc muốn xác nhận nhập học?"
        cancelLabel="Huỷ"
        confirmLabel="Xác nhận"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => void handleConfirmEnrollment()}
      />

      <ReservationPaymentScreen
        visible={paymentVisible}
        admissionFormId={item.id}
        formStatus={item.status}
        campusProgramOfferingId={item.campusProgramOfferingId}
        programName={item.programName}
        paymentResubmitCount={item.paymentResubmitCount}
        transferCode={item.transferCode}
        schoolName={item.schoolName}
        studentName={item.studentName}
        onBack={() => setPaymentVisible(false)}
        onSuccess={(result) => {
          setPaymentVisible(false);
          onPaymentSuccess?.(result);
        }}
      />

      <RequiredSubmissionDocumentsModal
        visible={requiredDocsVisible}
        admissionFormId={item.id}
        schoolName={item.schoolName}
        studentName={item.studentName}
        onClose={() => setRequiredDocsVisible(false)}
      />

      <SystemFeedbackModal
        visible={enrollmentFeedback.visible}
        title={enrollmentFeedback.title}
        message={enrollmentFeedback.message}
        variant={enrollmentFeedback.variant}
        onDismiss={() => setEnrollmentFeedback((prev) => ({ ...prev, visible: false }))}
      />

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
  paymentProofSection: { marginTop: 14 },
  paymentProofHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paymentProofTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  paymentProofHint: { marginTop: 4, marginBottom: 10, fontSize: 12, color: '#64748b' },
  paymentProofCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paymentProofImage: { width: '100%', height: 200, backgroundColor: '#f1f5f9' },
  paymentProofZoom: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  paymentProofZoomText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  retryExhaustedBox: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#fffbeb',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  retryExhaustedText: { flex: 1, fontSize: 12, color: '#92400e', lineHeight: 18 },
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
  paymentBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(248,250,252,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  paymentBtnWrap: { borderRadius: 18, overflow: 'hidden' },
  paymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 18,
  },
  paymentBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  outlinePaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1976d2',
    backgroundColor: '#fff',
  },
  outlinePaymentBtnText: { color: '#1976d2', fontSize: 16, fontWeight: '800' },
});
