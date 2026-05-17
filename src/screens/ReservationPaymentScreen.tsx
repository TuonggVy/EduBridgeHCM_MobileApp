import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import { useToast } from '../components/AppToast';
import { fetchAdmissionReservationFormById } from '../api/admissionReservation';
import {
  fetchProgramOfferings,
  fetchQrCodeInfo,
  submitReservationPayment,
  type ProgramOfferingItem,
  type QrCodeInfoBody,
} from '../api/reservationPayment';
import { admissionMethodLabel } from '../utils/admissionMethodLabel';
import {
  getPaymentResubmitCount,
  isReservationPaymentAgain,
  MAX_PAYMENT_RESUBMIT_ATTEMPTS,
} from '../utils/reservationStatus';
import { buildVietQrImageUrl, formatVnd } from '../utils/vietqr';

const CLOUDINARY_CLOUD_NAME =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || '';
const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() || process.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || '';

const PRIMARY = '#1976d2';
const PRIMARY_LIGHT = '#42a5f5';

type Props = {
  visible: boolean;
  admissionFormId: number;
  formStatus?: string | null;
  campusProgramOfferingId?: string | number | null;
  programName?: string | null;
  paymentResubmitCount?: number | null;
  transferCode?: string | null;
  schoolName?: string | null;
  studentName?: string | null;
  onBack: () => void;
  onSuccess?: (result?: { paymentResubmitCount: number }) => void;
};

function toOfferingId(value?: string | number | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

type ProofUpload = {
  localUri: string;
  remoteUrl: string | null;
  status: 'idle' | 'uploading' | 'uploaded' | 'error';
  error?: string;
};

const PAYMENT_STEPS = [
  { key: 'pay', label: 'Chờ thanh toán', active: true },
  { key: 'proof', label: 'Đã gửi minh chứng', active: false },
  { key: 'review', label: 'Nhà trường xác nhận', active: false },
  { key: 'done', label: 'Hoàn tất giữ chỗ', active: false },
];

async function uploadImageToCloudinary(uri: string, fileName?: string): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Thiếu cấu hình Cloudinary');
  }
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'image/jpeg',
    name: fileName ?? `payment-proof-${Date.now()}.jpg`,
  } as unknown as Blob);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || 'Upload thất bại');
  }
  if (typeof json?.secure_url !== 'string' || !json.secure_url) {
    throw new Error('Không nhận được URL ảnh');
  }
  return json.secure_url as string;
}

function formatDateRange(openDate?: string, closeDate?: string): string {
  const fmt = (v?: string) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleDateString('vi-VN');
  };
  return `${fmt(openDate)} – ${fmt(closeDate)}`;
}

export default function ReservationPaymentScreen({
  visible,
  admissionFormId,
  formStatus,
  campusProgramOfferingId,
  programName,
  paymentResubmitCount,
  transferCode,
  schoolName,
  studentName,
  onBack,
  onSuccess,
}: Props) {
  const insets = useSafeAreaInsets();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qrInfo, setQrInfo] = useState<QrCodeInfoBody | null>(null);
  const [programs, setPrograms] = useState<ProgramOfferingItem[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [proof, setProof] = useState<ProofUpload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const [usedResubmitAttempts, setUsedResubmitAttempts] = useState(0);

  const isPaymentAgain = isReservationPaymentAgain(formStatus);
  const lockedProgramId = isPaymentAgain ? toOfferingId(campusProgramOfferingId) : null;
  const programLocked = lockedProgramId != null;
  const resubmitCount = usedResubmitAttempts;
  const retriesLeft = Math.max(0, MAX_PAYMENT_RESUBMIT_ATTEMPTS - usedResubmitAttempts);
  const canResubmit = !isPaymentAgain || retriesLeft > 0;

  const syncUsedResubmitAttempts = useCallback(
    async (optimisticBump = false, usedOverride?: number) => {
      const base = usedOverride ?? getPaymentResubmitCount({ paymentResubmitCount });
      const optimistic = optimisticBump
        ? Math.min(MAX_PAYMENT_RESUBMIT_ATTEMPTS, base + 1)
        : base;
      let next = optimistic;
      try {
        const form = await fetchAdmissionReservationFormById(admissionFormId);
        if (form) {
          next = Math.max(getPaymentResubmitCount(form), optimistic);
        }
      } catch {
        // Giữ giá trị optimistic nếu refetch thất bại
      }
      setUsedResubmitAttempts(next);
      return next;
    },
    [admissionFormId, paymentResubmitCount]
  );

  const transferContent = useMemo(() => {
    const code = transferCode?.trim();
    if (code) return code;
    return `RESERVATION ${admissionFormId}`;
  }, [transferCode, admissionFormId]);

  const loadPaymentData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [qrRes, programRes] = await Promise.all([
        fetchQrCodeInfo(admissionFormId),
        fetchProgramOfferings(admissionFormId),
      ]);
      setQrInfo(qrRes.body);
      const list = Array.isArray(programRes.body) ? programRes.body : [];
      setPrograms(list);
      if (isPaymentAgain && lockedProgramId != null) {
        setSelectedProgramId(lockedProgramId);
      } else {
        const firstSelectable = list.find((p) => p.canSubmit);
        setSelectedProgramId(firstSelectable?.campusProgramOfferingId ?? null);
      }
    } catch (e: unknown) {
      setQrInfo(null);
      setPrograms([]);
      setLoadError(e instanceof Error ? e.message : 'Không thể tải thông tin thanh toán');
    } finally {
      setLoading(false);
    }
  }, [admissionFormId, isPaymentAgain, lockedProgramId]);

  useEffect(() => {
    if (!visible) return;
    setProof(null);
    setSuccessVisible(false);
    setUsedResubmitAttempts(getPaymentResubmitCount({ paymentResubmitCount }));
    void loadPaymentData();
  }, [visible, loadPaymentData, paymentResubmitCount]);

  const qrImageUrl = useMemo(() => {
    if (!qrInfo) return null;
    return buildVietQrImageUrl({
      bankInfo: qrInfo.bankInfo,
      amount: qrInfo.reservationFee,
      transferContent,
    });
  }, [qrInfo, transferContent]);

  const feeAmount = qrInfo?.reservationFee ?? 0;
  const canSubmit = Boolean(
    canResubmit && selectedProgramId && proof?.status === 'uploaded' && proof.remoteUrl
  );

  const displayPrograms = useMemo(() => {
    if (!programLocked || lockedProgramId == null) return programs;
    const matched = programs.filter((p) => p.campusProgramOfferingId === lockedProgramId);
    return matched;
  }, [programs, programLocked, lockedProgramId]);

  const copyText = async (value: string, toastMsg: string) => {
    await Clipboard.setStringAsync(value);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccess(toastMsg);
  };

  const handlePickProof = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Quyền truy cập', 'Cần quyền thư viện ảnh để tải minh chứng.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setProof({ localUri: asset.uri, remoteUrl: null, status: 'uploading' });
    try {
      const remoteUrl = await uploadImageToCloudinary(asset.uri, asset.fileName ?? undefined);
      setProof({ localUri: asset.uri, remoteUrl, status: 'uploaded' });
    } catch (e: unknown) {
      setProof({
        localUri: asset.uri,
        remoteUrl: null,
        status: 'error',
        error: e instanceof Error ? e.message : 'Upload thất bại',
      });
    }
  };

  const handleSaveQr = async () => {
    if (!qrImageUrl) return;
    setSavingQr(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Quyền truy cập', 'Cần quyền lưu ảnh vào thư viện.');
        return;
      }
      const baseDir = FileSystem.cacheDirectory;
      if (!baseDir) throw new Error('Không có thư mục cache');
      const dest = `${baseDir}reservation-qr-${Date.now()}.jpg`;
      const downloaded = await FileSystem.downloadAsync(qrImageUrl, dest);
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);
      Alert.alert('Đã lưu thành công', 'Ảnh mã QR đã được lưu vào thư viện ảnh.');
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Không lưu được ảnh QR');
    } finally {
      setSavingQr(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !proof?.remoteUrl || !selectedProgramId) return;
    setSubmitting(true);
    try {
      await submitReservationPayment({
        admissionFormId,
        action: isPaymentAgain ? 'payment-again' : 'payment',
        paymentUrl: proof.remoteUrl,
        campusProgramOfferingId: selectedProgramId,
      });
      let nextResubmitCount = usedResubmitAttempts;
      if (isPaymentAgain) {
        nextResubmitCount = await syncUsedResubmitAttempts(true, usedResubmitAttempts);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessVisible(true);
      if (isPaymentAgain) {
        onSuccess?.({ paymentResubmitCount: nextResubmitCount });
      }
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Không gửi được minh chứng thanh toán');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessVisible(false);
    if (!isPaymentAgain) {
      onSuccess?.();
    }
    onBack();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onBack}>
      <LinearGradient colors={['#f8fafc', '#f1f5f9']} style={styles.screen}>
        <StatusBar barStyle="dark-content" />

        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
            <MaterialIcons name="arrow-back-ios-new" size={18} color="#0f172a" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>{isPaymentAgain ? 'Nộp lại minh chứng' : 'Thanh toán giữ chỗ'}</Text>
            <Text style={styles.subtitle}>
              {isPaymentAgain
                ? 'Tải lại ảnh giao dịch — không thể đổi chương trình học'
                : 'Hoàn tất thanh toán để xác nhận suất học'}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {isPaymentAgain ? 'Nộp lại' : 'Chờ thanh toán'}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.centerStateText}>Đang tải thông tin thanh toán...</Text>
          </View>
        ) : !canResubmit ? (
          <View style={styles.centerState}>
            <MaterialIcons name="block" size={48} color="#b45309" />
            <Text style={styles.centerStateTitle}>Đã hết lượt nộp lại</Text>
            <Text style={styles.centerStateSub}>
              Bạn đã nộp lại minh chứng tối đa {MAX_PAYMENT_RESUBMIT_ATTEMPTS} lần. Vui lòng liên hệ nhà trường để
              được hỗ trợ.
            </Text>
            <Pressable onPress={onBack} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Quay lại</Text>
            </Pressable>
          </View>
        ) : loadError ? (
          <View style={styles.centerState}>
            <MaterialIcons name="error-outline" size={48} color="#ef4444" />
            <Text style={styles.centerStateTitle}>Không thể tải thông tin thanh toán</Text>
            <Text style={styles.centerStateSub}>{loadError}</Text>
            <Pressable onPress={() => void loadPaymentData()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 150 }]}
              showsVerticalScrollIndicator={false}
            >
              {(schoolName || studentName) && (
                <View style={styles.contextCard}>
                  {schoolName ? (
                    <Text style={styles.contextSchool} numberOfLines={2}>
                      {schoolName}
                    </Text>
                  ) : null}
                  {studentName ? <Text style={styles.contextStudent}>{studentName}</Text> : null}
                </View>
              )}

              <View style={styles.stepper}>
                {PAYMENT_STEPS.map((step, idx) => (
                  <View key={step.key} style={styles.stepItem}>
                    <View style={[styles.stepDot, idx === 0 && styles.stepDotActive]}>
                      {idx === 0 ? <MaterialIcons name="payments" size={14} color="#fff" /> : null}
                    </View>
                    <Text style={[styles.stepLabel, idx === 0 && styles.stepLabelActive]} numberOfLines={2}>
                      {step.label}
                    </Text>
                    {idx < PAYMENT_STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
                  </View>
                ))}
              </View>

              {isPaymentAgain ? (
                <View style={styles.retryBanner}>
                  <MaterialIcons name="info-outline" size={18} color="#1d4ed8" />
                  <Text style={styles.retryBannerText}>
                    Còn {retriesLeft}/{MAX_PAYMENT_RESUBMIT_ATTEMPTS} lần nộp lại minh chứng
                    {resubmitCount > 0 ? ` · Đã nộp lại ${resubmitCount} lần` : ''}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>
                {programLocked ? 'Chương trình học' : 'Chọn chương trình học'}
              </Text>
              {programLocked ? (
                <Text style={styles.programLockHint}>Chương trình đã chọn — không thể thay đổi khi nộp lại.</Text>
              ) : null}
              <View style={styles.programList}>
                {displayPrograms.length === 0 && programLocked && programName?.trim() ? (
                  <View style={[styles.programCard, styles.programCardSelected, styles.programCardLocked]}>
                    <View style={styles.programCheck}>
                      <MaterialIcons name="lock" size={20} color={PRIMARY} />
                    </View>
                    <Text style={styles.programName}>{programName.trim()}</Text>
                  </View>
                ) : displayPrograms.length === 0 ? (
                  <Text style={styles.emptyHint}>Chưa có chương trình khả dụng.</Text>
                ) : (
                  displayPrograms.map((program) => {
                    const selected = selectedProgramId === program.campusProgramOfferingId;
                    const disabled = programLocked || !program.canSubmit;
                    return (
                      <Pressable
                        key={program.campusProgramOfferingId}
                        disabled={disabled}
                        onPress={() => {
                          if (programLocked) return;
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedProgramId(program.campusProgramOfferingId);
                        }}
                        style={({ pressed }) => [
                          styles.programCard,
                          selected && styles.programCardSelected,
                          disabled && !selected && styles.programCardDisabled,
                          programLocked && selected && styles.programCardLocked,
                          pressed && !disabled && !programLocked && { transform: [{ scale: 0.98 }] },
                        ]}
                      >
                        {selected ? (
                          <View style={styles.programCheck}>
                            <MaterialIcons
                              name={programLocked ? 'lock' : 'check-circle'}
                              size={22}
                              color={PRIMARY}
                            />
                          </View>
                        ) : null}
                        <Text style={styles.programName}>{program.programName}</Text>
                        <Text style={styles.programMeta}>
                          Xét tuyển: {admissionMethodLabel(program.admissionMethod)}
                        </Text>
                        <Text style={styles.programMeta}>Còn lại: {program.remainingQuota} suất</Text>
                        <Text style={styles.programDates}>
                          {formatDateRange(program.openDate, program.closeDate)}
                        </Text>
                        {disabled && program.unavailableReason ? (
                          <Text style={styles.programUnavailable}>{program.unavailableReason}</Text>
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
              </View>

              <Text style={styles.sectionTitle}>Quét QR thanh toán</Text>
              <View style={styles.qrCard}>
                <Text style={styles.feeLabel}>Phí giữ chỗ</Text>
                <Text style={styles.feeValue}>{formatVnd(feeAmount)}</Text>

                <View style={styles.qrFrame}>
                  {qrImageUrl ? (
                    <Image source={{ uri: qrImageUrl }} style={styles.qrImage} resizeMode="contain" />
                  ) : (
                    <ActivityIndicator color={PRIMARY} />
                  )}
                </View>
                <Text style={styles.qrHint}>Quét mã để thanh toán nhanh</Text>

                {qrInfo ? (
                  <View style={styles.bankBlock}>
                    <BankRow
                      icon="account-balance"
                      label="Ngân hàng"
                      value={qrInfo.bankInfo.bankName}
                      onCopy={() => void copyText(qrInfo.bankInfo.bankName, 'Đã sao chép tên ngân hàng')}
                    />
                    <BankRow
                      icon="credit-card"
                      label="Số tài khoản"
                      value={qrInfo.bankInfo.accountNo}
                      onCopy={() => void copyText(qrInfo.bankInfo.accountNo, 'Đã sao chép số tài khoản')}
                    />
                    <BankRow
                      icon="person"
                      label="Chủ tài khoản"
                      value={qrInfo.bankInfo.accountName}
                      onCopy={() => void copyText(qrInfo.bankInfo.accountName, 'Đã sao chép tên chủ tài khoản')}
                    />
                    <BankRow
                      icon="receipt-long"
                      label="Nội dung CK"
                      value={transferContent}
                      onCopy={() => void copyText(transferContent, 'Đã sao chép nội dung chuyển khoản')}
                    />
                  </View>
                ) : null}

                <Pressable
                  style={styles.outlineBtn}
                  onPress={() => void handleSaveQr()}
                  disabled={savingQr || !qrImageUrl}
                >
                  {savingQr ? (
                    <ActivityIndicator size="small" color={PRIMARY} />
                  ) : (
                    <>
                      <MaterialIcons name="file-download" size={18} color={PRIMARY} />
                      <Text style={styles.outlineBtnText}>Lưu ảnh QR</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Text style={styles.sectionTitle}>Minh chứng giao dịch</Text>
              {!proof ? (
                <Pressable style={styles.uploadCard} onPress={() => void handlePickProof()}>
                  <MaterialIcons name="add-a-photo" size={40} color="#94a3b8" />
                  <Text style={styles.uploadTitle}>Tải ảnh giao dịch</Text>
                  <Text style={styles.uploadSub}>PNG, JPG dưới 10MB</Text>
                  <View style={styles.uploadBtn}>
                    <Text style={styles.uploadBtnText}>Chọn ảnh</Text>
                  </View>
                </Pressable>
              ) : (
                <View style={styles.proofCard}>
                  <Image source={{ uri: proof.localUri }} style={styles.proofImage} resizeMode="cover" />
                  {proof.status === 'uploading' ? (
                    <View style={styles.proofOverlay}>
                      <ActivityIndicator color="#fff" size="large" />
                      <Text style={styles.proofOverlayText}>Đang tải lên...</Text>
                    </View>
                  ) : proof.status === 'uploaded' ? (
                    <View style={styles.proofBadge}>
                      <MaterialIcons name="check-circle" size={16} color="#22C55E" />
                      <Text style={styles.proofBadgeText}>Đã tải lên</Text>
                    </View>
                  ) : null}
                  {proof.status === 'error' ? (
                    <Text style={styles.proofError}>{proof.error ?? 'Upload thất bại'}</Text>
                  ) : null}
                  <View style={styles.proofActions}>
                    <Pressable style={styles.proofActionBtn} onPress={() => void handlePickProof()}>
                      <Text style={styles.proofActionText}>Thay ảnh</Text>
                    </Pressable>
                    <Pressable style={styles.proofActionBtn} onPress={() => setProof(null)}>
                      <Text style={[styles.proofActionText, { color: '#ef4444' }]}>Xoá</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={[styles.summaryBar, { paddingBottom: insets.bottom + 12 }]}>
              <View style={styles.summaryTop}>
                <Text style={styles.summaryLabel}>Tổng thanh toán</Text>
                <Text style={styles.summaryAmount}>{formatVnd(feeAmount)}</Text>
              </View>
              <Pressable
                disabled={!canSubmit || submitting}
                onPress={() => void handleSubmit()}
                style={({ pressed }) => [
                  styles.submitWrap,
                  (!canSubmit || submitting) && styles.submitWrapDisabled,
                  pressed && canSubmit && { opacity: 0.92 },
                ]}
              >
                <LinearGradient
                  colors={canSubmit ? [PRIMARY, PRIMARY_LIGHT] : ['#94a3b8', '#cbd5e1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtn}
                >
                  <MaterialIcons name="qr-code-2" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>
                    {isPaymentAgain ? 'Gửi lại minh chứng' : 'Xác nhận đã thanh toán'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </>
        )}

        {submitting ? (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={styles.loadingText}>Đang xác nhận thanh toán...</Text>
            </View>
          </View>
        ) : null}

        <Modal visible={successVisible} transparent animationType="fade">
          <View style={styles.successBackdrop}>
            <View style={styles.successCard}>
              <View style={styles.successIconWrap}>
                <MaterialIcons name="check-circle" size={64} color="#22C55E" />
              </View>
              <Text style={styles.successTitle}>Đã gửi minh chứng thanh toán thành công</Text>
              <Text style={styles.successSub}>
                Nhà trường sẽ kiểm tra và xác nhận trong thời gian sớm nhất
              </Text>
              <Pressable onPress={handleSuccessClose} style={styles.successPrimaryBtn}>
                <LinearGradient colors={[PRIMARY, PRIMARY_LIGHT]} style={styles.successPrimaryGradient}>
                  <Text style={styles.successPrimaryText}>Quay về hồ sơ</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </Modal>
  );
}

function BankRow({
  icon,
  label,
  value,
  onCopy,
}: {
  icon: string;
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <View style={styles.bankRow}>
      <MaterialIcons name={icon} size={18} color="#64748b" />
      <View style={styles.bankRowText}>
        <Text style={styles.bankLabel}>{label}</Text>
        <Text style={styles.bankValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
      <Pressable onPress={onCopy} hitSlop={8} style={styles.copyBtn}>
        <MaterialIcons name="content-copy" size={18} color={PRIMARY} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  statusBadge: {
    marginTop: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: PRIMARY },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  centerStateText: { fontSize: 14, color: '#64748b' },
  centerStateTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  centerStateSub: { fontSize: 13, color: '#64748b', textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },
  contextCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },
  contextSchool: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  contextStudent: { marginTop: 4, fontSize: 13, color: '#64748b' },
  stepper: {
    flexDirection: 'row',
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    gap: 4,
  },
  stepItem: { flex: 1, alignItems: 'center', position: 'relative' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: PRIMARY },
  stepLabel: { marginTop: 6, fontSize: 9, color: '#94a3b8', textAlign: 'center' },
  stepLabelActive: { color: PRIMARY, fontWeight: '700' },
  stepLine: {
    position: 'absolute',
    top: 14,
    right: -8,
    width: 16,
    height: 2,
    backgroundColor: '#e2e8f0',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  programList: { gap: 10, marginBottom: 20 },
  programCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  programCardSelected: {
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.18,
  },
  programCardDisabled: { opacity: 0.5 },
  programCardLocked: { borderColor: '#94a3b8' },
  programLockHint: { marginTop: -4, marginBottom: 10, fontSize: 12, color: '#64748b' },
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  retryBannerText: { flex: 1, fontSize: 13, color: '#1e40af', lineHeight: 18 },
  programCheck: { position: 'absolute', top: 12, right: 12 },
  programName: { fontSize: 16, fontWeight: '700', color: '#0f172a', paddingRight: 28 },
  programMeta: { marginTop: 4, fontSize: 13, color: '#475569' },
  programDates: { marginTop: 6, fontSize: 12, color: '#64748b' },
  programUnavailable: { marginTop: 8, fontSize: 12, color: '#dc2626', fontWeight: '600' },
  emptyHint: { fontSize: 13, color: '#64748b', paddingVertical: 8 },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 26,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    alignItems: 'center',
  },
  feeLabel: { fontSize: 13, color: '#64748b' },
  feeValue: { fontSize: 28, fontWeight: '800', color: PRIMARY, marginTop: 4 },
  qrFrame: {
    marginTop: 16,
    width: 220,
    height: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrImage: { width: 210, height: 210 },
  qrHint: { marginTop: 10, fontSize: 13, color: '#64748b' },
  bankBlock: { width: '100%', marginTop: 16, gap: 10 },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bankRowText: { flex: 1 },
  bankLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  bankValue: { fontSize: 14, color: '#0f172a', fontWeight: '700', marginTop: 2 },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtn: {
    marginTop: 14,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    paddingVertical: 10,
  },
  outlineBtnText: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  uploadCard: {
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadTitle: { marginTop: 10, fontSize: 16, fontWeight: '700', color: '#0f172a' },
  uploadSub: { marginTop: 4, fontSize: 12, color: '#64748b' },
  uploadBtn: {
    marginTop: 14,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  proofCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginBottom: 24,
  },
  proofImage: { width: '100%', height: 220 },
  proofOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  proofOverlayText: { color: '#fff', fontWeight: '600' },
  proofBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  proofBadgeText: { fontSize: 12, fontWeight: '700', color: '#15803d' },
  proofError: { padding: 10, fontSize: 12, color: '#dc2626' },
  proofActions: { flexDirection: 'row', justifyContent: 'center', gap: 16, padding: 12 },
  proofActionBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  proofActionText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  summaryBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: { fontSize: 12, color: '#64748b' },
  summaryAmount: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  submitWrap: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  submitWrapDisabled: { opacity: 0.85 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248,250,252,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    minWidth: 220,
  },
  loadingText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  successBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
  },
  successIconWrap: { marginBottom: 12 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  successSub: { marginTop: 8, fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  successPrimaryBtn: { marginTop: 20, width: '100%', borderRadius: 16, overflow: 'hidden' },
  successPrimaryGradient: { paddingVertical: 14, alignItems: 'center' },
  successPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
