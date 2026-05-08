import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import { fetchParentStudents } from '../api/parentStudent';
import { getProfile } from '../api/profile';
import {
  fetchParentDocuments,
  submitAdmissionReservationForm,
  type ReservationDocumentItem,
} from '../api/admissionReservation';
import type { ParentStudentProfile } from '../types/studentProfile';

const CLOUDINARY_CLOUD_NAME =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || '';
const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() || process.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || '';
const PRIMARY = '#1976d2';

type Props = {
  visible: boolean;
  campusProgramOfferingId: number | null;
  onClose: () => void;
  onViewSubmittedForms?: () => void;
};

type UploadItem = {
  id: string;
  localUri: string;
  remoteUrl: string | null;
  status: 'uploading' | 'uploaded' | 'error';
  error?: string;
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

async function uploadImageToCloudinary(uri: string, fileName?: string) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Thiếu cấu hình Cloudinary');
  }
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'image/jpeg',
    name: fileName ?? `reservation-${Date.now()}.jpg`,
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

export default function AdmissionReservationFormScreen({
  visible,
  campusProgramOfferingId,
  onClose,
  onViewSubmittedForms,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [students, setStudents] = useState<ParentStudentProfile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [requiredDocs, setRequiredDocs] = useState<ReservationDocumentItem[]>([]);
  const [optionalDocs, setOptionalDocs] = useState<ReservationDocumentItem[]>([]);
  const [uploadsByDoc, setUploadsByDoc] = useState<Record<string, UploadItem[]>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !campusProgramOfferingId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchParentStudents(),
      getProfile(),
      fetchParentDocuments(campusProgramOfferingId),
    ])
      .then(([studentsRes, profileRes, docsRes]) => {
        if (cancelled) return;
        const list = studentsRes.body ?? [];
        setStudents(list);
        setSelectedStudentId((prev) => prev ?? toNumberId(list[0]?.id));
        setParentName(profileRes.body.parent?.name ?? '');
        setParentPhone(profileRes.body.parent?.phone ?? '');
        setParentEmail(profileRes.body.email ?? '');
        setRequiredDocs(docsRes.body.required ?? []);
        setOptionalDocs(docsRes.body.optional ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không tải được dữ liệu nộp hồ sơ.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, campusProgramOfferingId]);

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setSubmitting(false);
      setStudents([]);
      setSelectedStudentId(null);
      setParentName('');
      setParentPhone('');
      setParentEmail('');
      setRequiredDocs([]);
      setOptionalDocs([]);
      setUploadsByDoc({});
      setPreviewImageUrl(null);
    }
  }, [visible]);

  const totalDocs = requiredDocs.length + optionalDocs.length;
  const uploadedDocCount = useMemo(() => {
    return [...requiredDocs, ...optionalDocs].reduce((count, doc) => {
      const uploaded = (uploadsByDoc[doc.code] ?? []).some((item) => item.remoteUrl);
      return uploaded ? count + 1 : count;
    }, 0);
  }, [requiredDocs, optionalDocs, uploadsByDoc]);
  const missingRequired = useMemo(
    () =>
      requiredDocs.filter((doc) => {
        const uploaded = (uploadsByDoc[doc.code] ?? []).some((item) => item.remoteUrl);
        return !uploaded;
      }),
    [requiredDocs, uploadsByDoc]
  );

  const handlePickImage = (docCode: string) => {
    Alert.alert('Tải tài liệu', 'Chọn nguồn ảnh', [
      {
        text: 'Camera',
        onPress: () => {
          void openPicker(docCode, 'camera');
        },
      },
      {
        text: 'Thư viện',
        onPress: () => {
          void openPicker(docCode, 'library');
        },
      },
      { text: 'Huỷ', style: 'cancel' },
    ]);
  };

  const openPicker = async (docCode: string, source: 'camera' | 'library') => {
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: 10,
          });
    if (res.canceled || !res.assets?.length) return;

    const validAssets = res.assets.filter((asset) => !!asset?.uri);
    if (validAssets.length === 0) return;

    for (const asset of validAssets) {
      const localUri = asset.uri!;
      const id = `${docCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setUploadsByDoc((prev) => ({
        ...prev,
        [docCode]: [...(prev[docCode] ?? []), { id, localUri, remoteUrl: null, status: 'uploading' }],
      }));
      try {
        const remoteUrl = await uploadImageToCloudinary(localUri);
        setUploadsByDoc((prev) => ({
          ...prev,
          [docCode]: (prev[docCode] ?? []).map((item) =>
            item.id === id ? { ...item, remoteUrl, status: 'uploaded' } : item
          ),
        }));
      } catch (e: unknown) {
        setUploadsByDoc((prev) => ({
          ...prev,
          [docCode]: (prev[docCode] ?? []).map((item) =>
            item.id === id ? { ...item, status: 'error', error: e instanceof Error ? e.message : 'Upload thất bại' } : item
          ),
        }));
      }
    }
  };

  const removeUpload = (docCode: string, uploadId: string) => {
    setUploadsByDoc((prev) => ({
      ...prev,
      [docCode]: (prev[docCode] ?? []).filter((item) => item.id !== uploadId),
    }));
  };

  const handleSubmit = async () => {
    if (!campusProgramOfferingId || !selectedStudentId) {
      Alert.alert('Thiếu dữ liệu', 'Vui lòng chọn học sinh và gói tuyển sinh hợp lệ.');
      return;
    }
    if (missingRequired.length > 0) {
      Alert.alert('Thiếu hồ sơ', 'Vui lòng tải lên đầy đủ tài liệu bắt buộc.');
      return;
    }
    const docs = [...requiredDocs, ...optionalDocs]
      .map((doc) => {
        const urls = (uploadsByDoc[doc.code] ?? []).map((item) => item.remoteUrl).filter((url): url is string => Boolean(url));
        return urls.length > 0 ? { key: doc.code, imageUrl: urls } : null;
      })
      .filter((item): item is { key: string; imageUrl: string[] } => item != null);

    setSubmitting(true);
    try {
      await submitAdmissionReservationForm({
        submissionDocuments: docs,
        campusProgramOfferingId,
        studentProfileId: selectedStudentId,
      });
      onViewSubmittedForms?.();
    } catch (e: unknown) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không thể nộp hồ sơ.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderDocCard = (doc: ReservationDocumentItem, isRequired: boolean) => {
    const uploads = uploadsByDoc[doc.code] ?? [];
    const hasUploaded = uploads.some((item) => item.remoteUrl);
    const showRequiredError = isRequired && !hasUploaded;
    return (
      <View key={doc.code} style={[styles.docCard, showRequiredError && styles.docCardError]}>
        <View style={styles.docHeader}>
          <Text style={styles.docTitle}>{doc.name}</Text>
          <View style={[styles.docBadge, isRequired ? styles.badgeRequired : styles.badgeOptional]}>
            <Text style={[styles.docBadgeText, isRequired ? styles.badgeRequiredText : styles.badgeOptionalText]}>
              {isRequired ? 'Bắt buộc' : 'Tùy chọn'}
            </Text>
          </View>
        </View>
        <Pressable style={styles.uploadZone} onPress={() => handlePickImage(doc.code)} disabled={submitting}>
          <MaterialIcons name="cloud-upload" size={26} color={PRIMARY} />
          <Text style={styles.uploadTitle}>Tải ảnh lên</Text>
          <Text style={styles.uploadSub}>Hỗ trợ JPG, PNG</Text>
        </Pressable>
        {showRequiredError ? <Text style={styles.requiredErrorText}>Vui lòng tải lên tài liệu bắt buộc</Text> : null}
        {uploads.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbList}>
            {uploads.map((item) => (
              <View key={item.id} style={styles.thumbCard}>
                <Image source={{ uri: item.localUri }} style={styles.thumbImage} />
                {item.status === 'uploading' ? (
                  <View style={styles.thumbStatus}>
                    <ActivityIndicator size="small" color={PRIMARY} />
                  </View>
                ) : null}
                <View style={styles.thumbActions}>
                  {item.remoteUrl || item.localUri ? (
                    <Pressable onPress={() => setPreviewImageUrl(item.remoteUrl || item.localUri)}>
                      <Text style={styles.thumbActionText}>Xem</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => removeUpload(doc.code, item.id)}>
                    <Text style={styles.thumbDeleteText}>Xóa</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
    );
  };

  const selectedStudent = students.find((s) => toNumberId(s.id) === selectedStudentId) ?? null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn} disabled={submitting}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Nộp hồ sơ giữ chỗ</Text>
          <Text style={styles.subtitle}>Hoàn tất hồ sơ để gửi yêu cầu giữ chỗ cho học sinh</Text>
        </View>
        <Text style={styles.progressText}>
          {uploadedDocCount}/{totalDocs || 0} tài liệu
        </Text>
      </View>
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Thông tin học sinh</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studentRow}>
                {students.map((student) => {
                  const studentId = toNumberId(student.id);
                  const active = studentId != null && studentId === selectedStudentId;
                  return (
                    <Pressable
                      key={String(student.id)}
                      style={[styles.studentCard, active && styles.studentCardActive]}
                      onPress={() => {
                        if (studentId != null) setSelectedStudentId(studentId);
                      }}
                    >
                      <View style={styles.studentAvatar}>
                        <MaterialIcons name="school" size={20} color={PRIMARY} />
                      </View>
                      <Text style={styles.studentName}>{student.studentName || 'Học sinh'}</Text>
                      <View style={styles.genderChip}>
                        <Text style={styles.genderChipText}>{genderLabel(student.gender)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {students.length === 0 ? <Text style={styles.meta}>Chưa có hồ sơ học sinh.</Text> : null}
              {selectedStudent ? <Text style={styles.meta}>Đang chọn: {selectedStudent.studentName}</Text> : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Thông tin phụ huynh</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Họ tên</Text>
                  <Text style={styles.infoValue}>{parentName || '—'}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Số điện thoại</Text>
                  <Text style={styles.infoValue}>{parentPhone || '—'}</Text>
                </View>
                <View style={styles.infoItemFull}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{parentEmail || '—'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Hồ sơ cần nộp</Text>
              <Text style={styles.subSectionTitle}>Hồ sơ bắt buộc</Text>
              {requiredDocs.map((doc) => renderDocCard(doc, true))}
              <Text style={styles.subSectionTitle}>Hồ sơ bổ sung</Text>
              {optionalDocs.map((doc) => renderDocCard(doc, false))}
            </View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <Text style={styles.bottomMeta}>Đã tải {uploadedDocCount} / {totalDocs || 0} tài liệu</Text>
            <Pressable
              style={styles.submitBtnWrap}
              onPress={() => void handleSubmit()}
              disabled={submitting || missingRequired.length > 0}
            >
              <LinearGradient
                colors={submitting || missingRequired.length > 0 ? ['#94a3b8', '#94a3b8'] : ['#1976d2', '#42a5f5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitBtn}
              >
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="send" size={18} color="#fff" />}
                <Text style={styles.submitText}>{submitting ? 'Đang nộp hồ sơ...' : 'Nộp hồ sơ'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </>
      )}
      <Modal transparent visible={previewImageUrl != null} animationType="fade" onRequestClose={() => setPreviewImageUrl(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewImageUrl(null)}>
          {previewImageUrl ? (
            <Image source={{ uri: previewImageUrl }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
          <Pressable style={styles.previewCloseBtn} onPress={() => setPreviewImageUrl(null)}>
            <MaterialIcons name="close" size={18} color="#fff" />
          </Pressable>
        </Pressable>
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
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  headerCenter: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800', color: '#0f172a' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#64748b' },
  progressText: { marginTop: 8, fontSize: 12, fontWeight: '700', color: PRIMARY },
  centerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 14, paddingBottom: 120 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 14, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  studentRow: { gap: 10, paddingBottom: 4 },
  studentCard: { width: 170, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 12, backgroundColor: '#fff', gap: 6 },
  studentCardActive: { borderColor: PRIMARY, shadowColor: '#1976d2', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  studentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  studentName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  genderChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#e0f2fe' },
  genderChipText: { fontSize: 11, color: '#0369a1', fontWeight: '700' },
  meta: { marginTop: 8, fontSize: 12, color: '#64748b' },
  infoGrid: { gap: 10 },
  infoItem: { borderRadius: 12, backgroundColor: '#f8fafc', padding: 10 },
  infoItemFull: { borderRadius: 12, backgroundColor: '#f8fafc', padding: 10 },
  infoLabel: { fontSize: 12, color: '#64748b' },
  infoValue: { marginTop: 2, fontSize: 14, color: '#0f172a', fontWeight: '700' },
  subSectionTitle: { marginTop: 8, marginBottom: 8, fontSize: 13, fontWeight: '700', color: '#334155' },
  docCard: { borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', padding: 10, marginBottom: 10 },
  docCardError: { borderColor: '#fecaca', backgroundColor: '#fff7f7' },
  docHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  docTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  docBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeRequired: { backgroundColor: '#fee2e2' },
  badgeOptional: { backgroundColor: '#e2e8f0' },
  docBadgeText: { fontSize: 11, fontWeight: '700' },
  badgeRequiredText: { color: '#b91c1c' },
  badgeOptionalText: { color: '#475569' },
  uploadZone: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fbff',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  uploadTitle: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  uploadSub: { fontSize: 11, color: '#64748b' },
  requiredErrorText: { marginTop: 8, fontSize: 12, color: '#dc2626', fontWeight: '600' },
  thumbList: { marginTop: 10, gap: 8 },
  thumbCard: { width: 120, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', padding: 6 },
  thumbImage: { width: '100%', height: 68, borderRadius: 8, backgroundColor: '#f1f5f9' },
  thumbStatus: { position: 'absolute', top: 8, right: 8, backgroundColor: '#ffffffd9', borderRadius: 999, padding: 3 },
  thumbActions: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  thumbActionText: { color: PRIMARY, fontSize: 12, fontWeight: '700' },
  thumbDeleteText: { color: '#dc2626', fontSize: 12, fontWeight: '700' },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: '78%',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 52,
    right: 22,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffffee',
  },
  bottomMeta: { marginBottom: 10, fontSize: 12, color: '#64748b' },
  submitBtnWrap: {
    width: '92%',
    alignSelf: 'center',
  },
  submitBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
