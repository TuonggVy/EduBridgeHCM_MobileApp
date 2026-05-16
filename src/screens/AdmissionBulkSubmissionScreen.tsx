import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import {
  checkSchoolsAdmissionAvailability,
  fetchParentDocumentCatalog,
  fetchReservationFormTemplate,
  submitBulkAdmissionReservation,
  type ReservationDocumentItem,
  type ReservationTemplate,
  type SchoolAvailabilitySchool,
  type SchoolUnavailableGroup,
} from '../api/admissionReservation';
import { ApiError } from '../api/client';
import { fetchParentStudents } from '../api/parentStudent';
import type { ParentStudentProfile } from '../types/studentProfile';
import type { SchoolSummary } from '../types/school';
import { formatGradeLevel } from '../utils/gradeLevel';

const PRIMARY = '#1976d2';
const GRADIENT = ['#1976d2', '#42a5f5'] as const;
const TOTAL_STEPS = 4;
const { width: WIN_W, height: WIN_H } = Dimensions.get('window');

type Props = {
  visible: boolean;
  schools: SchoolSummary[];
  onClose: () => void;
  onViewSubmittedForms?: () => void;
  onOpenReservationProfile?: () => void;
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
  return '—';
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

function StickyCta({
  label,
  onPress,
  disabled,
  loading,
  subLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  subLabel?: string;
}) {
  return (
    <View style={styles.stickyBar}>
      {subLabel ? <Text style={styles.stickySub}>{subLabel}</Text> : null}
      <Pressable
        style={[styles.stickyBtnWrap, disabled && { opacity: 0.55 }]}
        onPress={onPress}
        disabled={disabled || loading}
      >
        <LinearGradient colors={disabled ? ['#94a3b8', '#94a3b8'] : [...GRADIENT]} style={styles.stickyBtn}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.stickyBtnText}>{label}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export default function AdmissionBulkSubmissionScreen({
  visible,
  schools,
  onClose,
  onViewSubmittedForms,
  onOpenReservationProfile,
}: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [students, setStudents] = useState<ParentStudentProfile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [availableSchools, setAvailableSchools] = useState<SchoolAvailabilitySchool[]>([]);
  const [unavailableGroups, setUnavailableGroups] = useState<SchoolUnavailableGroup[]>([]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<number[]>([]);

  const [template, setTemplate] = useState<ReservationTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [docCatalog, setDocCatalog] = useState<ReservationDocumentItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submittedSchoolNames, setSubmittedSchoolNames] = useState<string[]>([]);

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const selectedStudent = useMemo(
    () => students.find((s) => toNumberId(s.id) === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  const docNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    docCatalog.forEach((d) => map.set(d.code, d.name));
    return map;
  }, [docCatalog]);

  const schoolNameById = useMemo(() => {
    const map = new Map<number, string>();
    schools.forEach((s) => map.set(s.id, s.name));
    availableSchools.forEach((s) => map.set(s.schoolId, s.schoolName));
    return map;
  }, [schools, availableSchools]);

  const resetFlow = useCallback(() => {
    setStep(1);
    setLoading(false);
    setStudents([]);
    setSelectedStudentId(null);
    setSchoolsLoading(false);
    setAvailableSchools([]);
    setUnavailableGroups([]);
    setSelectedSchoolIds([]);
    setTemplate(null);
    setTemplateLoading(false);
    setSubmitting(false);
    setSubmittedSchoolNames([]);
    setPreviewImageUrl(null);
  }, []);

  useEffect(() => {
    if (!visible) {
      resetFlow();
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchParentStudents(), fetchParentDocumentCatalog()])
      .then(([studentsRes, docsRes]) => {
        if (cancelled) return;
        const list = Array.isArray(studentsRes.body) ? studentsRes.body : [];
        setStudents(list);
        setSelectedStudentId(toNumberId(list[0]?.id));
        setDocCatalog(Array.isArray(docsRes.body) ? docsRes.body : []);
      })
      .catch((e) => {
        if (!cancelled) {
          Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không tải được dữ liệu.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, resetFlow]);

  const loadSchoolAvailability = useCallback(async () => {
    if (!selectedStudentId) return;
    setSchoolsLoading(true);
    try {
      const schoolIds = schools.map((s) => s.id);
      const res = await checkSchoolsAdmissionAvailability(selectedStudentId, schoolIds);
      const available = Array.isArray(res.body?.available) ? res.body.available : [];
      const unavailable = Array.isArray(res.body?.unavailable) ? res.body.unavailable : [];
      setAvailableSchools(available);
      setUnavailableGroups(unavailable);
      setSelectedSchoolIds(available.map((s) => s.schoolId));
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không kiểm tra được trường.');
      setAvailableSchools([]);
      setUnavailableGroups([]);
      setSelectedSchoolIds([]);
    } finally {
      setSchoolsLoading(false);
    }
  }, [selectedStudentId, schools]);

  const loadTemplate = useCallback(async () => {
    if (!selectedStudentId) return;
    setTemplateLoading(true);
    try {
      const res = await fetchReservationFormTemplate(selectedStudentId);
      setTemplate(res.body ?? null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setTemplate(null);
      } else {
        Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không tải được hồ sơ giữ chỗ.');
        setTemplate(null);
      }
    } finally {
      setTemplateLoading(false);
    }
  }, [selectedStudentId]);

  const toggleSchool = (schoolId: number) => {
    setSelectedSchoolIds((prev) =>
      prev.includes(schoolId) ? prev.filter((id) => id !== schoolId) : [...prev, schoolId]
    );
  };

  const goNext = async () => {
    if (step === 1) {
      if (!selectedStudentId) {
        Alert.alert('Thiếu thông tin', 'Vui lòng chọn học sinh.');
        return;
      }
      setStep(2);
      await loadSchoolAvailability();
      return;
    }
    if (step === 2) {
      if (!selectedSchoolIds.length) {
        Alert.alert('Thiếu thông tin', 'Vui lòng chọn ít nhất một trường.');
        return;
      }
      setStep(3);
      await loadTemplate();
      return;
    }
    if (step === 3) {
      if (!template) {
        Alert.alert(
          'Chưa có hồ sơ giữ chỗ',
          'Vui lòng tạo hồ sơ giữ chỗ trước khi nộp.',
          [
            { text: 'Đóng', style: 'cancel' },
            {
              text: 'Tạo hồ sơ',
              onPress: () => {
                onClose();
                onOpenReservationProfile?.();
              },
            },
          ]
        );
        return;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!template || !selectedStudentId || !selectedSchoolIds.length) return;
    const submissionDocuments = (template.profileMetaData ?? [])
      .map((item) => ({
        key: item.key,
        imageUrl: Array.isArray(item.imageUrl) ? item.imageUrl.filter(Boolean) : [],
      }))
      .filter((item) => item.imageUrl.length > 0);

    if (!submissionDocuments.length) {
      Alert.alert('Thiếu hồ sơ', 'Hồ sơ giữ chỗ chưa có tài liệu để nộp.');
      return;
    }

    setSubmitting(true);
    try {
      await submitBulkAdmissionReservation({
        studentProfileId: selectedStudentId,
        schoolIds: selectedSchoolIds,
        submissionDocuments,
      });
      setSubmittedSchoolNames(
        selectedSchoolIds.map((id) => schoolNameById.get(id) || availableSchools.find((s) => s.schoolId === id)?.schoolName || `Trường #${id}`)
      );
      setStep(5);
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không nộp được hồ sơ.');
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (step <= 1 || step === 5) {
      onClose();
      return;
    }
    setStep((s) => s - 1);
  };

  const progress = step >= 5 ? 1 : (step - 1) / TOTAL_STEPS;

  const renderProgress = () => (
    <View style={styles.progressWrap}>
      <Text style={styles.progressLabel}>
        {step >= 5 ? 'Hoàn tất' : `Bước ${step} / ${TOTAL_STEPS}`}
      </Text>
      <View style={styles.progressTrack}>
        <LinearGradient
          colors={[...GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${Math.max(8, progress * 100)}%` }]}
        />
      </View>
    </View>
  );

  const renderStep1 = () => (
    <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepHint}>Chọn học sinh để tiếp tục</Text>
      {students.map((student) => {
        const id = toNumberId(student.id);
        const active = id != null && id === selectedStudentId;
        return (
          <Pressable
            key={String(student.id)}
            onPress={() => id != null && setSelectedStudentId(id)}
            style={[styles.studentCard, active && styles.studentCardActive]}
          >
            {active ? (
              <View style={styles.checkBadge}>
                <MaterialIcons name="check" size={14} color="#fff" />
              </View>
            ) : null}
            <View style={styles.studentCardTop}>
              <LinearGradient colors={['#e0f2fe', '#eff6ff']} style={styles.studentAvatar}>
                <MaterialIcons name="school" size={26} color={PRIMARY} />
              </LinearGradient>
              <View style={styles.studentCardMain}>
                <Text style={styles.studentName}>{student.studentName}</Text>
                <Text style={styles.studentSub}>
                  {student.studentCode?.trim() ? `CCCD: ${student.studentCode.trim()}` : 'Chưa có mã'} ·{' '}
                  {genderLabel(student.gender)}
                </Text>
                {student.personalityTypeCode ? (
                  <View style={styles.mbtiPill}>
                    <Text style={styles.mbtiPillText}>{student.personalityTypeCode}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {student.favouriteJob ? (
              <Text style={styles.favJob} numberOfLines={2}>
                Ngành yêu thích: {student.favouriteJob}
              </Text>
            ) : null}
            {student.traits?.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.traitRow}>
                {student.traits.slice(0, 4).map((t) => (
                  <View key={t.name} style={styles.traitChip}>
                    <Text style={styles.traitChipText}>{t.name}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Pressable>
        );
      })}
      {!loading && students.length === 0 ? (
        <Text style={styles.emptyText}>Chưa có hồ sơ học sinh. Vui lòng thêm con trong Tài khoản.</Text>
      ) : null}
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      {schoolsLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.meta}>Đang kiểm tra trường…</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Trường đủ điều kiện</Text>
          {availableSchools.length === 0 ? (
            <Text style={styles.emptyText}>Không có trường nào đủ điều kiện nộp hồ sơ.</Text>
          ) : (
            availableSchools.map((school) => {
              const checked = selectedSchoolIds.includes(school.schoolId);
              return (
                <Pressable
                  key={school.schoolId}
                  onPress={() => toggleSchool(school.schoolId)}
                  style={[styles.schoolCard, checked && styles.schoolCardActive]}
                >
                  <View style={styles.schoolCardLeft}>
                    <View style={styles.schoolLogo}>
                      <MaterialIcons name="domain" size={22} color={PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.schoolName}>{school.schoolName}</Text>
                      <Text style={styles.schoolOk}>Đủ điều kiện nộp hồ sơ</Text>
                    </View>
                  </View>
                  <MaterialIcons
                    name={checked ? 'check-box' : 'check-box-outline-blank'}
                    size={24}
                    color={checked ? PRIMARY : '#94a3b8'}
                  />
                </Pressable>
              );
            })
          )}

          {unavailableGroups.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Trường chưa đủ điều kiện</Text>
              {unavailableGroups.map((group, gi) =>
                group.schools.map((school) => (
                  <View key={`${gi}-${school.schoolId}`} style={styles.schoolCardWarn}>
                    <View style={styles.schoolCardLeft}>
                      <View style={[styles.schoolLogo, styles.schoolLogoWarn]}>
                        <MaterialIcons name="info-outline" size={22} color="#ea580c" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.schoolName}>{school.schoolName}</Text>
                        <Text style={styles.schoolWarn}>{group.reason}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      {templateLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : !template ? (
        <View style={styles.missingTemplate}>
          <MaterialIcons name="folder-off" size={48} color="#93c5fd" />
          <Text style={styles.missingTitle}>Chưa có hồ sơ giữ chỗ</Text>
          <Text style={styles.missingSub}>Tạo hồ sơ giữ chỗ trước khi nộp đến các trường.</Text>
          <Pressable
            onPress={() => {
              onClose();
              onOpenReservationProfile?.();
            }}
          >
            <LinearGradient colors={[...GRADIENT]} style={styles.missingCta}>
              <Text style={styles.missingCtaText}>Tạo hồ sơ giữ chỗ</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{template.studentName}</Text>
            <Text style={styles.summarySub}>
              Phụ huynh: {template.parentName} · {template.parentPhone}
            </Text>
            <Text style={styles.summarySub}>Cập nhật: {formatDateTime(template.updatedTime)}</Text>
          </View>

          <Text style={styles.sectionTitle}>Tài liệu hồ sơ</Text>
          {(template.profileMetaData ?? []).map((doc) => {
            const urls = Array.isArray(doc.imageUrl) ? doc.imageUrl.filter(Boolean) : [];
            return (
              <View key={doc.key} style={styles.docCard}>
                <View style={styles.docCardHeader}>
                  <View style={styles.docCardTitleWrap}>
                    <Text style={styles.docName}>{docNameByCode.get(doc.key) ?? doc.key}</Text>
                    <Text style={styles.docOk}>Đã tải lên</Text>
                  </View>
                  <MaterialIcons name="check-circle" size={22} color="#16a34a" />
                </View>
                {urls.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.docThumbRow}
                  >
                    {urls.map((url, index) => (
                      <Pressable
                        key={`${doc.key}-${index}`}
                        onPress={() => setPreviewImageUrl(url)}
                        style={styles.docThumbPressable}
                      >
                        <Image source={{ uri: url }} style={styles.docThumb} />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={[styles.docThumb, styles.docThumbEmpty]}>
                    <MaterialIcons name="description" size={24} color="#94a3b8" />
                  </View>
                )}
              </View>
            );
          })}

          {(template.transcriptImages?.length ?? 0) > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Ảnh học bạ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.transcriptRow}>
                {(template.transcriptImages ?? []).map((item, idx) => {
                  if (!item.imageUrl) return null;
                  return (
                    <Pressable
                      key={`${item.grade}-${idx}`}
                      style={styles.transcriptCard}
                      onPress={() => item.imageUrl && setPreviewImageUrl(item.imageUrl)}
                    >
                      <Image source={{ uri: item.imageUrl }} style={styles.transcriptImg} />
                      <Text style={styles.transcriptGrade}>{formatGradeLevel(item.grade) || item.grade}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );

  const renderStep4 = () => (
    <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepHint}>Xác nhận trước khi gửi</Text>
      <View style={styles.summaryCard}>
        <Text style={styles.confirmLabel}>Học sinh</Text>
        <Text style={styles.confirmValue}>{selectedStudent?.studentName ?? template?.studentName}</Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.confirmLabel}>Trường đã chọn ({selectedSchoolIds.length})</Text>
        {selectedSchoolIds.map((id) => (
          <View key={id} style={styles.confirmRow}>
            <MaterialIcons name="check-circle" size={18} color="#16a34a" />
            <Text style={styles.confirmValue}>{schoolNameById.get(id) ?? `Trường #${id}`}</Text>
          </View>
        ))}
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.confirmLabel}>Tài liệu</Text>
        <Text style={styles.confirmValue}>
          {(template?.profileMetaData ?? []).length} loại tài liệu ·{' '}
          {(template?.transcriptImages ?? []).length} ảnh học bạ
        </Text>
      </View>
    </ScrollView>
  );

  const renderSuccess = () => (
    <View style={styles.successWrap}>
      <LinearGradient colors={['#dcfce7', '#ecfdf5']} style={styles.successIcon}>
        <MaterialIcons name="check-circle" size={56} color="#16a34a" />
      </LinearGradient>
      <Text style={styles.successTitle}>Hồ sơ đã được gửi thành công</Text>
      <Text style={styles.successSub}>Đã gửi đến {submittedSchoolNames.length} trường</Text>
      <View style={styles.successList}>
        {submittedSchoolNames.map((name) => (
          <View key={name} style={styles.successItem}>
            <MaterialIcons name="school" size={18} color={PRIMARY} />
            <Text style={styles.successItemText}>{name}</Text>
          </View>
        ))}
      </View>
      <Pressable style={styles.secondaryBtn} onPress={() => onViewSubmittedForms?.()}>
        <Text style={styles.secondaryBtnText}>Xem đơn đã nộp</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={onClose}>
        <Text style={styles.secondaryBtnText}>Đóng</Text>
      </Pressable>
    </View>
  );

  if (!visible) return null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Nộp hồ sơ giữ chỗ</Text>
          <Text style={styles.headerSub}>
            {step === 1 && 'Chọn học sinh'}
            {step === 2 && 'Chọn trường'}
            {step === 3 && 'Xem lại hồ sơ'}
            {step === 4 && 'Xác nhận & gửi'}
            {step === 5 && 'Thành công'}
          </Text>
        </View>
      </View>

      {step < 5 ? renderProgress() : null}

      {loading && step === 1 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : step === 1 ? (
        renderStep1()
      ) : step === 2 ? (
        renderStep2()
      ) : step === 3 ? (
        renderStep3()
      ) : step === 4 ? (
        renderStep4()
      ) : (
        renderSuccess()
      )}

      {step < 5 && step !== 3 ? (
        <StickyCta
          label={step === 4 ? 'Nộp hồ sơ' : 'Tiếp tục'}
          onPress={() => void goNext()}
          disabled={
            (step === 1 && !selectedStudentId) ||
            (step === 2 && (!selectedSchoolIds.length || schoolsLoading)) ||
            (step === 4 && submitting)
          }
          loading={submitting && step === 4}
          subLabel={step === 2 && selectedSchoolIds.length > 0 ? `Đã chọn ${selectedSchoolIds.length} trường` : undefined}
        />
      ) : null}
      {step === 3 && template ? (
        <StickyCta label="Tiếp tục" onPress={() => void goNext()} disabled={templateLoading} />
      ) : null}

      {previewImageUrl ? (
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewBackdrop} onPress={() => setPreviewImageUrl(null)} />
          <Image source={{ uri: previewImageUrl }} style={styles.previewImage} resizeMode="contain" />
          <Pressable style={styles.previewCloseBtn} onPress={() => setPreviewImageUrl(null)} hitSlop={12}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  headerSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  progressWrap: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  progressLabel: { fontSize: 12, fontWeight: '700', color: PRIMARY, marginBottom: 8 },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  stepContent: { padding: 16, paddingBottom: 120 },
  stepHint: { fontSize: 14, color: '#64748b', marginBottom: 14 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  meta: { marginTop: 10, fontSize: 13, color: '#64748b' },
  emptyText: { textAlign: 'center', color: '#64748b', fontSize: 14, paddingVertical: 24 },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  studentCardActive: { borderColor: PRIMARY, backgroundColor: '#eff6ff' },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  studentCardTop: { flexDirection: 'row', gap: 12 },
  studentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentCardMain: { flex: 1 },
  studentName: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  studentSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  mbtiPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#e0f2fe',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mbtiPillText: { fontSize: 11, fontWeight: '800', color: '#0369a1' },
  favJob: { marginTop: 10, fontSize: 13, color: '#475569' },
  traitRow: { gap: 8, marginTop: 10 },
  traitChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  traitChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  schoolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  schoolCardActive: { borderColor: PRIMARY, backgroundColor: '#eff6ff' },
  schoolCardWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  schoolCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  schoolLogo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolLogoWarn: { backgroundColor: '#ffedd5' },
  schoolName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  schoolOk: { fontSize: 12, color: '#16a34a', marginTop: 2, fontWeight: '600' },
  schoolWarn: { fontSize: 12, color: '#c2410c', marginTop: 4, lineHeight: 18 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  summaryTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  summarySub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  docCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  docCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  docCardTitleWrap: { flex: 1, minWidth: 0 },
  docThumbRow: { gap: 8, paddingRight: 4 },
  docThumbPressable: { borderRadius: 12, overflow: 'hidden' },
  docThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#f1f5f9' },
  docThumbEmpty: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  docOk: { fontSize: 12, color: '#16a34a', marginTop: 2 },
  transcriptRow: { gap: 12, paddingBottom: 8 },
  transcriptCard: { width: 140, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff' },
  transcriptImg: { width: 140, height: 100, backgroundColor: '#f1f5f9' },
  transcriptGrade: {
    padding: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  missingTemplate: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  missingTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 12 },
  missingSub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  missingCta: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  missingCtaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  confirmLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  confirmValue: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: '#ffffffee',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  stickySub: { fontSize: 13, color: '#64748b', marginBottom: 8, textAlign: 'center' },
  stickyBtnWrap: { borderRadius: 16, overflow: 'hidden' },
  stickyBtn: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  stickyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  successWrap: { flex: 1, alignItems: 'center', padding: 32, paddingTop: 48 },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  successSub: { fontSize: 14, color: '#64748b', marginTop: 8, marginBottom: 20 },
  successList: { width: '100%', gap: 8, marginBottom: 24 },
  successItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 14,
  },
  successItemText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#334155' },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700', color: PRIMARY },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 200,
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.94)',
  },
  previewImage: {
    position: 'absolute',
    top: Math.round(WIN_H * 0.1),
    left: 16,
    width: WIN_W - 32,
    height: Math.round(WIN_H * 0.72),
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 201,
  },
});
