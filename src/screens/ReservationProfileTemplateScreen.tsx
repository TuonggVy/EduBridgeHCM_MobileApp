import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import {
  fetchParentDocumentCatalog,
  fetchReservationFormTemplate,
  saveReservationFormTemplate,
  updateReservationFormTemplate,
  type ReservationDocumentItem,
  type ReservationTemplate,
  type ReservationTemplateMetaItem,
} from '../api/admissionReservation';
import { ApiError } from '../api/client';
import { fetchParentStudents } from '../api/parentStudent';
import type { ParentStudentProfile } from '../types/studentProfile';
import { formatGradeLevel } from '../utils/gradeLevel';

const CLOUDINARY_CLOUD_NAME =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || '';
const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() || process.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || '';
const PRIMARY = '#1976d2';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Học sinh cần tải mẫu (GET bắt buộc studentProfileId). */
  studentProfileId?: number | null;
  /** Mở thẳng form tạo mới (từ màn danh sách khi chưa có hồ sơ). */
  startInEditMode?: boolean;
  /** Học sinh đã có mẫu — dùng khi tạo hồ sơ cho học sinh khác. */
  existingTemplateStudentProfileIds?: number[];
  onSaved?: () => void;
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

async function uploadImageToCloudinary(uri: string, fileName?: string) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Thiếu cấu hình Cloudinary');
  }
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'image/jpeg',
    name: fileName ?? `template-${Date.now()}.jpg`,
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

function uploadsFromMeta(meta: ReservationTemplateMetaItem[]): Record<string, UploadItem[]> {
  const next: Record<string, UploadItem[]> = {};
  meta.forEach((item) => {
    const urls = Array.isArray(item.imageUrl) ? item.imageUrl.filter(Boolean) : [];
    if (!urls.length) return;
    next[item.key] = urls.map((url, index) => ({
      id: `${item.key}-${index}-${url}`,
      localUri: url,
      remoteUrl: url,
      status: 'uploaded' as const,
    }));
  });
  return next;
}

export default function ReservationProfileTemplateScreen({
  visible,
  onClose,
  studentProfileId: studentProfileIdProp,
  startInEditMode = false,
  existingTemplateStudentProfileIds,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [template, setTemplate] = useState<ReservationTemplate | null>(null);
  const [students, setStudents] = useState<ParentStudentProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [documents, setDocuments] = useState<ReservationDocumentItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [uploadsByDoc, setUploadsByDoc] = useState<Record<string, UploadItem[]>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const excludedStudentIds = useMemo(
    () => new Set((existingTemplateStudentProfileIds ?? []).filter((id) => Number.isFinite(id))),
    [existingTemplateStudentProfileIds]
  );

  /** GET /api/v1/parent/documents — danh mục tài liệu hồ sơ. */
  const loadDocuments = useCallback(async (): Promise<ReservationDocumentItem[]> => {
    setDocumentsLoading(true);
    try {
      const res = await fetchParentDocumentCatalog();
      const list = Array.isArray(res.body) ? res.body : [];
      setDocuments(list);
      return list;
    } catch (e: unknown) {
      setDocuments([]);
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không tải được danh sách tài liệu.');
      return [];
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  /** GET /api/v1/parent/student — danh sách hồ sơ con để chọn khi tạo/cập nhật mẫu. */
  const loadStudents = useCallback(async (): Promise<ParentStudentProfile[]> => {
    setStudentsLoading(true);
    try {
      const res = await fetchParentStudents();
      const list = Array.isArray(res.body) ? res.body : [];
      setStudents(list);
      return list;
    } catch (e: unknown) {
      setStudents([]);
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không tải được danh sách học sinh.');
      return [];
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const loadTemplate = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial', profileIdOverride?: number | null) => {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);

      const [list] = await Promise.all([loadStudents(), loadDocuments()]);

      const resolvedProfileId = profileIdOverride ?? studentProfileIdProp ?? toNumberId(list[0]?.id);
      const skipFetch =
        startInEditMode && studentProfileIdProp == null && profileIdOverride == null;

      let body: ReservationTemplate | null = null;
      if (!skipFetch && resolvedProfileId != null) {
        try {
          const templateRes = await fetchReservationFormTemplate(resolvedProfileId);
          body = templateRes.body ?? null;
        } catch (e: unknown) {
          if (e instanceof ApiError && e.status === 404) {
            body = null;
          } else {
            Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không tải được hồ sơ giữ chỗ.');
          }
        }
      }

      setTemplate(body);
      if (body) {
        setSelectedStudentId(body.studentProfileId);
        setUploadsByDoc(uploadsFromMeta(body.profileMetaData ?? []));
        setEditing(false);
      } else {
        const excludedIds = new Set(existingTemplateStudentProfileIds ?? []);
        const firstWithoutTemplate = list.find((s) => {
          const id = toNumberId(s.id);
          return id != null && !excludedIds.has(id);
        });
        const nextStudentId = skipFetch
          ? toNumberId(firstWithoutTemplate?.id) ?? toNumberId(list[0]?.id)
          : resolvedProfileId != null && list.some((s) => toNumberId(s.id) === resolvedProfileId)
            ? resolvedProfileId
            : toNumberId(list[0]?.id);
        setSelectedStudentId(nextStudentId);
        setUploadsByDoc({});
        setEditing(profileIdOverride != null ? true : startInEditMode);
      }

      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    },
    [loadStudents, loadDocuments, startInEditMode, studentProfileIdProp, existingTemplateStudentProfileIds]
  );

  useEffect(() => {
    if (!visible) return;
    void loadTemplate('initial', studentProfileIdProp ?? null);
  }, [visible, studentProfileIdProp, loadTemplate]);

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setRefreshing(false);
      setSaving(false);
      setEditing(false);
      setTemplate(null);
      setStudents([]);
      setStudentsLoading(false);
      setDocuments([]);
      setDocumentsLoading(false);
      setSelectedStudentId(null);
      setUploadsByDoc({});
      setPreviewImageUrl(null);
    }
  }, [visible]);

  const docNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    documents.forEach((doc) => map.set(doc.code, doc.name));
    return map;
  }, [documents]);

  const requiredDocuments = useMemo(() => documents.filter((doc) => doc.required), [documents]);
  const optionalDocuments = useMemo(() => documents.filter((doc) => !doc.required), [documents]);

  const uploadedDocCount = useMemo(() => {
    return documents.reduce((count, doc) => {
      const uploaded = (uploadsByDoc[doc.code] ?? []).some((item) => item.remoteUrl);
      return uploaded ? count + 1 : count;
    }, 0);
  }, [documents, uploadsByDoc]);

  const missingRequired = useMemo(
    () =>
      requiredDocuments.filter((doc) => {
        const uploaded = (uploadsByDoc[doc.code] ?? []).some((item) => item.remoteUrl);
        return !uploaded;
      }),
    [requiredDocuments, uploadsByDoc]
  );

  const startEditing = useCallback(() => {
    if (template) {
      setSelectedStudentId(template.studentProfileId);
      setUploadsByDoc(uploadsFromMeta(template.profileMetaData ?? []));
    } else {
      setUploadsByDoc({});
    }
    setEditing(true);
  }, [template]);

  useEffect(() => {
    if (!visible || !editing) return;
    void loadDocuments();
    void loadStudents().then((list) => {
      if (template) {
        setSelectedStudentId(template.studentProfileId);
        return;
      }
      setSelectedStudentId((prev) => {
        if (prev != null && list.some((s) => toNumberId(s.id) === prev)) return prev;
        return toNumberId(list[0]?.id);
      });
    });
  }, [visible, editing, template, loadStudents, loadDocuments]);

  const handlePickImage = (docCode: string) => {
    Alert.alert('Tải tài liệu', 'Chọn nguồn ảnh', [
      { text: 'Camera', onPress: () => void openPicker(docCode, 'camera') },
      { text: 'Thư viện', onPress: () => void openPicker(docCode, 'library') },
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

    for (const asset of res.assets) {
      if (!asset?.uri) continue;
      const id = `${docCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setUploadsByDoc((prev) => ({
        ...prev,
        [docCode]: [...(prev[docCode] ?? []), { id, localUri: asset.uri, remoteUrl: null, status: 'uploading' }],
      }));
      try {
        const remoteUrl = await uploadImageToCloudinary(asset.uri, asset.fileName ?? undefined);
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
            item.id === id
              ? { ...item, status: 'error', error: e instanceof Error ? e.message : 'Upload thất bại' }
              : item
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

  const handleSave = async () => {
    if (!selectedStudentId) {
      Alert.alert('Thiếu dữ liệu', 'Vui lòng chọn học sinh.');
      return;
    }
    if (missingRequired.length > 0) {
      Alert.alert('Thiếu hồ sơ', 'Vui lòng tải đầy đủ tài liệu bắt buộc.');
      return;
    }

    const submissionDocuments = documents
      .map((doc) => {
        const urls = (uploadsByDoc[doc.code] ?? [])
          .map((item) => item.remoteUrl)
          .filter((url): url is string => Boolean(url));
        return { key: doc.code, imageUrl: urls };
      })
      .filter((item) => item.imageUrl.length > 0);

    setSaving(true);
    try {
      if (template?.id != null) {
        await updateReservationFormTemplate({
          admissionReservationFormTemplateId: template.id,
          studentProfileId: selectedStudentId,
          submissionDocuments,
        });
      } else {
        await saveReservationFormTemplate({
          studentProfileId: selectedStudentId,
          submissionDocuments,
        });
      }
      await loadTemplate('refresh', selectedStudentId);
      setEditing(false);
      onSaved?.();
      Alert.alert('Thành công', template ? 'Đã cập nhật hồ sơ giữ chỗ.' : 'Đã tạo hồ sơ giữ chỗ.');
    } catch (e: unknown) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không lưu được hồ sơ giữ chỗ.');
    } finally {
      setSaving(false);
    }
  };

  const renderDocCard = (doc: ReservationDocumentItem) => {
    const uploads = uploadsByDoc[doc.code] ?? [];
    const hasUploaded = uploads.some((item) => item.remoteUrl);
    const showRequiredError = doc.required && !hasUploaded;
    return (
      <View key={doc.code} style={[styles.docCard, showRequiredError && styles.docCardError]}>
        <View style={styles.docHeader}>
          <Text style={styles.docTitle}>{doc.name}</Text>
          <View style={[styles.docBadge, doc.required ? styles.badgeRequired : styles.badgeOptional]}>
            <Text style={[styles.docBadgeText, doc.required ? styles.badgeRequiredText : styles.badgeOptionalText]}>
              {doc.required ? 'Bắt buộc' : 'Tùy chọn'}
            </Text>
          </View>
        </View>
        <Pressable style={styles.uploadZone} onPress={() => handlePickImage(doc.code)} disabled={saving}>
          <MaterialIcons name="cloud-upload" size={26} color={PRIMARY} />
          <Text style={styles.uploadTitle}>Tải ảnh lên</Text>
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
                  {(item.remoteUrl || item.localUri) && (
                    <Pressable onPress={() => setPreviewImageUrl(item.remoteUrl || item.localUri)}>
                      <Text style={styles.thumbActionText}>Xem</Text>
                    </Pressable>
                  )}
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

  const renderMetaGallery = (meta: ReservationTemplateMetaItem[], nameByCode: Map<string, string>) => {
    if (!meta.length) {
      return <Text style={styles.meta}>Chưa có tài liệu đính kèm.</Text>;
    }
    return meta.map((item) => {
      const urls = Array.isArray(item.imageUrl) ? item.imageUrl.filter(Boolean) : [];
      if (!urls.length) return null;
      return (
        <View key={item.key} style={styles.viewDocBlock}>
          <Text style={styles.viewDocTitle}>{nameByCode.get(item.key) ?? item.key}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbList}>
            {urls.map((url, index) => (
              <Pressable key={`${item.key}-${index}`} onPress={() => setPreviewImageUrl(url)}>
                <Image source={{ uri: url }} style={styles.viewThumb} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      );
    });
  };

  const selectedStudent = students.find((s) => toNumberId(s.id) === selectedStudentId) ?? null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn} disabled={saving}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{editing ? (template ? 'Cập nhật hồ sơ' : 'Tạo hồ sơ') : 'Chi tiết hồ sơ'}</Text>
          <Text style={styles.subtitle}>
            {editing
              ? template
                ? 'Chỉnh sửa mẫu hồ sơ giữ chỗ'
                : 'Tạo mẫu hồ sơ giữ chỗ mới'
              : 'Xem thông tin và tài liệu đã lưu'}
          </Text>
        </View>
        {!editing && template ? (
          <Pressable onPress={startEditing} style={styles.editBtn}>
            <MaterialIcons name="edit" size={18} color={PRIMARY} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : editing ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              <View style={styles.sectionHeadRow}>
                <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Chọn học sinh</Text>
                <Pressable
                  onPress={() => void loadStudents()}
                  disabled={studentsLoading}
                  style={styles.reloadStudentsBtn}
                >
                  <MaterialIcons name="refresh" size={18} color={studentsLoading ? '#94a3b8' : PRIMARY} />
                </Pressable>
              </View>
              {studentsLoading ? (
                <View style={styles.studentsLoadingBox}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                  <Text style={styles.meta}>Đang tải hồ sơ học sinh…</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studentRow}>
                  {students.map((student) => {
                    const studentId = toNumberId(student.id);
                    const active = studentId != null && studentId === selectedStudentId;
                    const lockedToTemplate = Boolean(template);
                    const hasExistingTemplate =
                      !lockedToTemplate && studentId != null && excludedStudentIds.has(studentId);
                    const disabled = lockedToTemplate || studentId == null || hasExistingTemplate;
                    return (
                      <Pressable
                        key={String(student.id)}
                        style={[
                          styles.studentCard,
                          active && styles.studentCardActive,
                          disabled && !active && styles.studentCardDisabled,
                        ]}
                        onPress={() => {
                          if (disabled) return;
                          if (studentId == null) return;
                          setSelectedStudentId(studentId);
                          void loadTemplate('refresh', studentId);
                        }}
                        disabled={disabled}
                      >
                        <View style={styles.studentAvatar}>
                          <MaterialIcons
                            name={hasExistingTemplate ? 'lock' : 'school'}
                            size={20}
                            color={hasExistingTemplate ? '#94a3b8' : PRIMARY}
                          />
                        </View>
                        <Text
                          style={[styles.studentName, hasExistingTemplate && styles.studentNameDisabled]}
                          numberOfLines={2}
                        >
                          {student.studentName || 'Học sinh'}
                        </Text>
                        <Text style={styles.genderChipText}>{genderLabel(student.gender)}</Text>
                        {hasExistingTemplate ? (
                          <Text style={styles.studentHasTemplateText}>Đã có hồ sơ</Text>
                        ) : null}
                        {student.studentCode?.trim() ? (
                          <Text style={styles.studentCodeText} numberOfLines={1}>
                            Mã HS: {student.studentCode.trim()}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {!studentsLoading && students.length === 0 ? (
                <Text style={styles.meta}>Chưa có hồ sơ học sinh. Vui lòng thêm con trong mục Tài khoản trước.</Text>
              ) : null}
              {selectedStudent ? (
                <Text style={styles.meta}>Đang chọn: {selectedStudent.studentName}</Text>
              ) : null}
              {template ? (
                <Text style={styles.metaHint}>Học sinh đã gắn với mẫu hồ sơ, không thể đổi khi cập nhật.</Text>
              ) : excludedStudentIds.size > 0 ? (
                <Text style={styles.metaHint}>Học sinh đã có hồ sơ giữ chỗ sẽ không chọn được.</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Tài liệu hồ sơ</Text>
              {documentsLoading ? (
                <View style={styles.studentsLoadingBox}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                  <Text style={styles.meta}>Đang tải danh mục tài liệu…</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.progressText}>
                    {uploadedDocCount}/{documents.length || 0} tài liệu
                  </Text>
                  {requiredDocuments.length > 0 ? (
                    <>
                      <Text style={styles.subSectionTitle}>Hồ sơ bắt buộc</Text>
                      {requiredDocuments.map((doc) => renderDocCard(doc))}
                    </>
                  ) : null}
                  {optionalDocuments.length > 0 ? (
                    <>
                      <Text style={styles.subSectionTitle}>Hồ sơ bổ sung</Text>
                      {optionalDocuments.map((doc) => renderDocCard(doc))}
                    </>
                  ) : null}
                  {!documentsLoading && documents.length === 0 ? (
                    <Text style={styles.meta}>Chưa có danh mục tài liệu.</Text>
                  ) : null}
                </>
              )}
            </View>
          </ScrollView>

          <View style={[styles.bottomBar, styles.bottomBarCentered]}>
            <Pressable
              style={[
                styles.submitBtnWrap,
                template ? styles.submitBtnWrapUpdate : styles.submitBtnWrapNarrow,
              ]}
              onPress={() => void handleSave()}
              disabled={saving || missingRequired.length > 0 || !selectedStudentId}
            >
              <LinearGradient
                colors={
                  saving || missingRequired.length > 0 || !selectedStudentId
                    ? ['#94a3b8', '#94a3b8']
                    : ['#1976d2', '#42a5f5']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitBtn}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialIcons name="save" size={18} color="#fff" />
                )}
                <Text style={styles.submitText}>{saving ? 'Đang lưu...' : template ? 'Lưu thay đổi' : 'Tạo hồ sơ'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </>
      ) : template ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadTemplate('refresh')} />}
        >
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <View style={[styles.statusPill, template.isApplied ? styles.statusApplied : styles.statusDraft]}>
                <Text style={[styles.statusPillText, template.isApplied ? styles.statusAppliedText : styles.statusDraftText]}>
                  {template.isApplied ? 'Đã áp dụng' : 'Chưa áp dụng'}
                </Text>
              </View>
              <Text style={styles.meta}>Cập nhật: {formatDateTime(template.updatedTime)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thông tin học sinh</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Họ tên</Text>
                <Text style={styles.infoValue}>{template.studentName || '—'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Giới tính</Text>
                <Text style={styles.infoValue}>{genderLabel(template.gender)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Mã học sinh</Text>
                <Text style={styles.infoValue}>{template.studentCode?.trim() || '—'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>CCCD</Text>
                <Text style={styles.infoValue}>{template.identityCard?.trim() || '—'}</Text>
              </View>
              <View style={styles.infoItemFull}>
                <Text style={styles.infoLabel}>Địa chỉ</Text>
                <Text style={styles.infoValue}>{template.address?.trim() || '—'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thông tin phụ huynh</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Họ tên</Text>
                <Text style={styles.infoValue}>{template.parentName?.trim() || '—'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Số điện thoại</Text>
                <Text style={styles.infoValue}>{template.parentPhone?.trim() || '—'}</Text>
              </View>
              <View style={styles.infoItemFull}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{template.parentEmail?.trim() || '—'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tài liệu hồ sơ</Text>
            {renderMetaGallery(template.profileMetaData ?? [], docNameByCode)}
          </View>

          {(template.transcriptImages?.length ?? 0) > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ảnh học bạ</Text>
              {(template.transcriptImages ?? []).map((item, index) => {
                if (!item.imageUrl) return null;
                return (
                  <View key={`${item.grade}-${index}`} style={styles.viewDocBlock}>
                    <Text style={styles.viewDocTitle}>{formatGradeLevel(item.grade) || item.grade}</Text>
                    <Pressable onPress={() => setPreviewImageUrl(item.imageUrl)}>
                      <Image source={{ uri: item.imageUrl }} style={styles.transcriptImage} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={styles.footerMeta}>Tạo lúc: {formatDateTime(template.createdTime)}</Text>
        </ScrollView>
      ) : (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  headerCenter: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800', color: '#0f172a' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#64748b', lineHeight: 18 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  centerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  sectionTitleInline: { marginBottom: 0 },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reloadStudentsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  studentsLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  progressText: { marginBottom: 10, fontSize: 12, fontWeight: '700', color: PRIMARY },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusApplied: { backgroundColor: '#dcfce7' },
  statusDraft: { backgroundColor: '#fef3c7' },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  statusAppliedText: { color: '#15803d' },
  statusDraftText: { color: '#b45309' },
  infoGrid: { gap: 10 },
  infoItem: { borderRadius: 12, backgroundColor: '#f8fafc', padding: 10 },
  infoItemFull: { borderRadius: 12, backgroundColor: '#f8fafc', padding: 10 },
  infoLabel: { fontSize: 12, color: '#64748b' },
  infoValue: { marginTop: 2, fontSize: 14, color: '#0f172a', fontWeight: '700' },
  meta: { fontSize: 12, color: '#64748b', marginTop: 6 },
  metaHint: { fontSize: 11, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' },
  footerMeta: { textAlign: 'center', fontSize: 12, color: '#94a3b8', marginBottom: 24 },
  studentRow: { gap: 10, paddingBottom: 4 },
  studentCard: {
    width: 170,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    backgroundColor: '#fff',
    gap: 6,
  },
  studentCardActive: {
    borderColor: PRIMARY,
    shadowColor: '#1976d2',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  studentCardDisabled: { opacity: 0.55 },
  studentNameDisabled: { color: '#94a3b8' },
  studentHasTemplateText: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
    textAlign: 'center',
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  genderChipText: { fontSize: 11, color: '#0369a1', fontWeight: '700' },
  studentCodeText: { fontSize: 11, color: '#64748b' },
  docCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 10,
  },
  docCardError: { borderColor: '#fecaca', backgroundColor: '#fff7f7' },
  docHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  docTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  docBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeRequired: { backgroundColor: '#fee2e2' },
  badgeOptional: { backgroundColor: '#e2e8f0' },
  docBadgeText: { fontSize: 11, fontWeight: '700' },
  badgeRequiredText: { color: '#b91c1c' },
  badgeOptionalText: { color: '#475569' },
  subSectionTitle: { marginTop: 4, marginBottom: 8, fontSize: 13, fontWeight: '700', color: '#334155' },
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
  requiredErrorText: { marginTop: 8, fontSize: 12, color: '#dc2626', fontWeight: '600' },
  thumbList: { marginTop: 10, gap: 8 },
  thumbCard: {
    width: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 6,
  },
  thumbImage: { width: '100%', height: 68, borderRadius: 8, backgroundColor: '#f1f5f9' },
  thumbStatus: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ffffffd9',
    borderRadius: 999,
    padding: 3,
  },
  thumbActions: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  thumbActionText: { color: PRIMARY, fontSize: 12, fontWeight: '700' },
  thumbDeleteText: { color: '#dc2626', fontSize: 12, fontWeight: '700' },
  viewDocBlock: { marginBottom: 12 },
  viewDocTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  viewThumb: { width: 120, height: 90, borderRadius: 10, backgroundColor: '#f1f5f9' },
  transcriptImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#f1f5f9' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyCtaWrap: { alignSelf: 'center', width: '72%', maxWidth: 220 },
  emptyCta: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyCtaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffffee',
  },
  bottomBarCentered: {
    justifyContent: 'center',
  },
  submitBtnWrap: {},
  submitBtnWrapNarrow: { width: '80%', maxWidth: 400 },
  submitBtnWrapUpdate: { width: '82%', maxWidth: 400 },
  submitBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewImage: { width: '100%', height: '78%' },
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
});
