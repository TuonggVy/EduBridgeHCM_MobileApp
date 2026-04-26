import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  findNodeHandle,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
const Ionicons = require('@expo/vector-icons').Ionicons;
import {
  autoFillTranscriptScores,
  createParentStudent,
  updateParentStudent,
  fetchParentMajors,
  fetchParentPersonalityTypes,
  fetchParentSubjects,
} from '../api/parentStudent';
import type {
  AcademicInfo,
  MajorGroup,
  ParentStudentProfile,
  SubjectGroup,
  PersonalityTypesGrouped,
  PersonalityTypeDetail,
  TranscriptImagePayload,
} from '../types/studentProfile';
import { groupColorForPersonality } from '../utils/personalityTypes';
import { useToast } from '../components/AppToast';

/** Khớp HomeScreen — primary + gradient nút Lưu */
const PRIMARY = '#1976d2';
const GRADIENT_SAVE = ['#1976d2', '#42a5f5'] as const;
const sp = { xs: 8, sm: 12, md: 16, lg: 20 } as const;
const radius = { md: 12, lg: 16, xl: 20, full: 9999 } as const;
const { width: WIN_W } = Dimensions.get('window');
const GRID_GAP = 10;
const CARD_W = (WIN_W - 40 - GRID_GAP) / 2;

const GENDERS = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'OTHER', label: 'Khác' },
];

const GRADE_OPTIONS = [
  { label: 'Lớp 6', value: 'GRADE_06' },
  { label: 'Lớp 7', value: 'GRADE_07' },
  { label: 'Lớp 8', value: 'GRADE_08' },
  { label: 'Lớp 9', value: 'GRADE_09' },
] as const;

const ALLOWED_GRADE_LEVELS: Set<string> = new Set(GRADE_OPTIONS.map((g) => g.value));

const REQUIRED_FIELD_TITLE = 'Required';
const REQUIRED_FIELD_MESSAGE = 'Nhập thông tin';
const CLOUDINARY_CLOUD_NAME =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || '';
const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() || process.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || '';

type SubjectRow = { subjectName: string; score: string };
type SubjectType = 'regular' | 'foreign_language';
type AcademicBlock = { gradeLevel: string; regularRows: SubjectRow[]; foreignRows: SubjectRow[] };
type LegacyAcademicBlock = { gradeLevel?: string; rows?: SubjectRow[] };
type TranscriptUploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error' | 'extracting' | 'extracted';
type TranscriptUploadItem = {
  imageUrl: string | null;
  localUri?: string;
  status: TranscriptUploadStatus;
  error?: string;
};

type Props = {
  visible: boolean;
  initialStudent: ParentStudentProfile | null;
  onClose: () => void;
  onSaved: () => void;
};

function SubjectPickerModal({
  visible,
  groups,
  disabledNames,
  onClose,
  onPick,
}: {
  visible: boolean;
  groups: SubjectGroup[];
  disabledNames: Set<string>;
  onClose: () => void;
  onPick: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (visible && groups.length) {
      const init: Record<string, boolean> = {};
      groups.forEach((g) => {
        init[g.type || g.label] = true;
      });
      setExpanded(init);
    }
  }, [visible, groups]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={subPickerStyles.wrap}>
        <View style={subPickerStyles.head}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={subPickerStyles.cancel}>Hủy</Text>
          </Pressable>
          <Text style={subPickerStyles.title}>Chọn môn học</Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView contentContainerStyle={subPickerStyles.scroll}>
          {groups.map((g) => {
            const key = g.type || g.label;
            const open = expanded[key] !== false;
            return (
              <View key={key} style={subPickerStyles.acc}>
                <Pressable
                  onPress={() => setExpanded((s) => ({ ...s, [key]: !open }))}
                  style={subPickerStyles.accHead}
                >
                  <Text style={subPickerStyles.accLabel}>{g.label}</Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#64748b" />
                </Pressable>
                {open && (
                  <View style={subPickerStyles.chips}>
                    {g.subjects.map((s) => {
                      const disabled = disabledNames.has(s.name);
                      return (
                        <Pressable
                          key={s.id}
                          disabled={disabled}
                          onPress={() => {
                            onPick(s.name);
                            onClose();
                          }}
                          style={({ pressed }) => [
                            subPickerStyles.chip,
                            disabled && subPickerStyles.chipDisabled,
                            pressed && !disabled && { opacity: 0.85 },
                          ]}
                        >
                          <Text style={[subPickerStyles.chipText, disabled && subPickerStyles.chipTextDisabled]}>
                            {s.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function emptyAcademic(): AcademicBlock {
  return {
    gradeLevel: '',
    regularRows: [{ subjectName: '', score: '' }],
    foreignRows: [{ subjectName: '', score: '' }],
  };
}

function normalizeRows(rows: unknown): SubjectRow[] {
  if (!Array.isArray(rows) || rows.length === 0) return [{ subjectName: '', score: '' }];
  return rows.map((r) => ({
    subjectName: typeof (r as SubjectRow)?.subjectName === 'string' ? (r as SubjectRow).subjectName : '',
    score: typeof (r as SubjectRow)?.score === 'string' ? (r as SubjectRow).score : '',
  }));
}

function normalizeAcademicBlock(block: AcademicBlock | LegacyAcademicBlock): AcademicBlock {
  const regular = (block as AcademicBlock).regularRows;
  const foreign = (block as AcademicBlock).foreignRows;

  if (Array.isArray(regular) || Array.isArray(foreign)) {
    return {
      gradeLevel: typeof block.gradeLevel === 'string' ? block.gradeLevel : '',
      regularRows: normalizeRows(regular),
      foreignRows: normalizeRows(foreign),
    };
  }

  const legacyRows = (block as LegacyAcademicBlock).rows;
  return {
    gradeLevel: typeof block.gradeLevel === 'string' ? block.gradeLevel : '',
    regularRows: normalizeRows(legacyRows),
    foreignRows: [{ subjectName: '', score: '' }],
  };
}

function normalizeGradeLevelInput(input: string): string {
  const raw = input.trim().toUpperCase();
  if (ALLOWED_GRADE_LEVELS.has(raw)) return raw;

  const byLabel = GRADE_OPTIONS.find((g) => g.label.toUpperCase() === raw);
  if (byLabel) return byLabel.value;

  const m = raw.match(/(\d{1,2})$/);
  if (!m) return raw;
  const n = m[1].padStart(2, '0');
  const enumValue = `GRADE_${n}`;
  return ALLOWED_GRADE_LEVELS.has(enumValue) ? enumValue : raw;
}

function gradeLevelDisplayValue(input: string): string {
  const normalized = normalizeGradeLevelInput(input);
  const byValue = GRADE_OPTIONS.find((g) => g.value === normalized);
  if (byValue) return byValue.label;
  return input;
}

function normalizeVietnameseText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

async function uploadImageToCloudinary(params: { uri: string; mimeType?: string; fileName?: string }) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Thiếu cấu hình Cloudinary. Vui lòng thêm EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME và EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET');
  }
  const mimeType = params.mimeType || 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append('file', {
    uri: params.uri,
    type: mimeType,
    name: params.fileName || `transcript-${Date.now()}.${ext}`,
  } as unknown as Blob);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const msg =
      (typeof data?.error === 'object' && data?.error?.message) ||
      (typeof data?.error === 'string' && data?.error) ||
      `Upload thất bại (${res.status})`;
    throw new Error(msg);
  }
  if (!data?.secure_url) throw new Error('Phản hồi Cloudinary không có secure_url');
  return String(data.secure_url);
}

export default function StudentProfileFormScreen({ visible, initialStudent, onClose, onSaved }: Props) {
  const { showWarning, showError, showSuccess } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const fieldRefs = useRef<Record<string, View | null>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const setFieldRef = useCallback((key: string) => (node: View | null) => {
    fieldRefs.current[key] = node;
  }, []);

  const scrollToFieldKey = useCallback((key: string) => {
    requestAnimationFrame(() => {
      const child = fieldRefs.current[key];
      const content = scrollContentRef.current;
      const scroll = scrollRef.current;
      if (!child || !content || !scroll) return;
      const contentNode = findNodeHandle(content);
      const childNode = findNodeHandle(child);
      if (contentNode == null || childNode == null) return;
      UIManager.measureLayout(
        childNode,
        contentNode,
        () => {},
        (_x, y) => {
          scroll.scrollTo({ y: Math.max(0, y - 20), animated: true });
        }
      );
    });
  }, []);

  const warnRequiredAt = useCallback(
    (key: string, message = REQUIRED_FIELD_MESSAGE) => {
      scrollToFieldKey(key);
      setFieldErrors({ [key]: message });
      showWarning(message, REQUIRED_FIELD_TITLE);
    },
    [scrollToFieldKey, showWarning]
  );

  const clearFieldError = useCallback((key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const [loadingRefs, setLoadingRefs] = useState(false);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [personalityGrouped, setPersonalityGrouped] = useState<PersonalityTypesGrouped | null>(null);
  const [majorGroups, setMajorGroups] = useState<MajorGroup[]>([]);
  const [majorGroupsExpanded, setMajorGroupsExpanded] = useState<Record<string, boolean>>({});

  const [studentName, setStudentName] = useState('');
  const [gender, setGender] = useState('');
  const [personalityCode, setPersonalityCode] = useState('');
  const [favouriteJob, setFavouriteJob] = useState('');
  const [academics, setAcademics] = useState<AcademicBlock[]>([emptyAcademic()]);

  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [pickTarget, setPickTarget] = useState<{ bi: number; ri: number; type: SubjectType } | null>(null);
  const [transcriptUploads, setTranscriptUploads] = useState<Record<string, TranscriptUploadItem>>({});
  const [transcriptPreviewOpen, setTranscriptPreviewOpen] = useState(false);
  const [transcriptPreview, setTranscriptPreview] = useState<AcademicInfo[]>([]);
  const [transcriptExtracting, setTranscriptExtracting] = useState(false);

  const [saving, setSaving] = useState(false);
  const [jobSuggestOpen, setJobSuggestOpen] = useState(false);

  const filteredMajorGroups = useMemo(() => {
    const q = favouriteJob.trim().toLowerCase();
    if (q.length < 1) return majorGroups;
    return majorGroups
      .map((g) => ({
        ...g,
        majors: g.majors.filter((m) => m.name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.majors.length > 0);
  }, [favouriteJob, majorGroups]);

  const regularSubjectNames = useMemo(() => {
    const regularGroups = subjectGroups.filter((g) => g.type === 'regular');
    const sourceGroups = regularGroups.length
      ? regularGroups
      : subjectGroups.filter((g) => g.type !== 'foreign_language');
    const names = sourceGroups
      .flatMap((g) => g.subjects || [])
      .map((s) => s.name.trim())
      .filter(Boolean);
    return Array.from(new Set(names));
  }, [subjectGroups]);

  const allowedRegularSubjectNameKeys = useMemo(
    () => new Set(regularSubjectNames.map((name) => normalizeVietnameseText(name)).filter(Boolean)),
    [regularSubjectNames]
  );

  const foreignSubjectNameKeys = useMemo(() => {
    return new Set(
      subjectGroups
        .filter((g) => g.type === 'foreign_language')
        .flatMap((g) => g.subjects || [])
        .map((s) => normalizeVietnameseText(s.name))
        .filter(Boolean)
    );
  }, [subjectGroups]);

  const normalizeAcademicWithCatalogSubjects = useCallback(
    (block: AcademicBlock | LegacyAcademicBlock): AcademicBlock => {
      const normalized = normalizeAcademicBlock(block);
      if (!regularSubjectNames.length) return normalized;

      const scoreByName = new Map<string, string>();
      normalized.regularRows.forEach((row) => {
        const key = row.subjectName.trim();
        if (!key || scoreByName.has(key)) return;
        scoreByName.set(key, row.score);
      });

      return {
        ...normalized,
        regularRows: regularSubjectNames.map((name) => ({
          subjectName: name,
          score: scoreByName.get(name) ?? '',
        })),
      };
    },
    [regularSubjectNames]
  );

  useEffect(() => {
    if (!visible) return;
    setLoadingRefs(true);
    Promise.all([fetchParentSubjects(), fetchParentPersonalityTypes(), fetchParentMajors()])
      .then(([subRes, perRes, majRes]) => {
        setSubjectGroups(Array.isArray(subRes.body) ? subRes.body : []);
        setPersonalityGrouped(perRes.body && typeof perRes.body === 'object' ? perRes.body : null);
        setMajorGroups(Array.isArray(majRes.body) ? majRes.body : []);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Không tải được danh mục';
        showError(msg, 'Something went wrong');
      })
      .finally(() => setLoadingRefs(false));
  }, [visible]);

  useEffect(() => {
    if (!majorGroups.length) return;
    setMajorGroupsExpanded((prev) => {
      const next = { ...prev };
      majorGroups.forEach((g) => {
        if (next[g.group] === undefined) next[g.group] = true;
      });
      return next;
    });
  }, [majorGroups]);

  // Khi mở dropdown gợi ý, luôn expand lại tất cả group
  // để người dùng không bị "kẹt" ở trạng thái thu (false) cho một group nào đó.
  useEffect(() => {
    if (!jobSuggestOpen) return;
    setMajorGroupsExpanded(() => {
      const next: Record<string, boolean> = {};
      majorGroups.forEach((g) => {
        next[g.group] = true;
      });
      return next;
    });
  }, [jobSuggestOpen, majorGroups]);

  useEffect(() => {
    if (!visible) return;
    setFieldErrors({});
    setTranscriptUploads({});
    setTranscriptPreview([]);
    setTranscriptPreviewOpen(false);
    if (initialStudent) {
      setStudentName(initialStudent.studentName ?? '');
      setGender(initialStudent.gender ?? '');
      setPersonalityCode(initialStudent.personalityTypeCode ?? '');
      setFavouriteJob(initialStudent.favouriteJob ?? '');
      setTranscriptUploads(() => {
        const next: Record<string, TranscriptUploadItem> = {};
        (initialStudent.transcriptImages || []).forEach((item) => {
          const normalizedGrade = normalizeGradeLevelInput(item.grade || '');
          if (!ALLOWED_GRADE_LEVELS.has(normalizedGrade) || !item.imageUrl) return;
          next[normalizedGrade] = {
            imageUrl: item.imageUrl,
            localUri: item.imageUrl,
            status: 'uploaded',
          };
        });
        return next;
      });
      if (initialStudent.academicInfos?.length) {
        setAcademics(
          initialStudent.academicInfos.map((a) => {
            const regularRows: SubjectRow[] = [];
            const foreignRows: SubjectRow[] = [];
            (a.subjectResults || []).forEach((sr) => {
              const belongsToForeign = subjectGroups.some(
                (g) => g.type === 'foreign_language' && g.subjects?.some((s) => s.name === sr.subjectName)
              );
              const row = { subjectName: sr.subjectName, score: String(sr.score) };
              if (belongsToForeign) foreignRows.push(row);
              else regularRows.push(row);
            });
            return {
              gradeLevel: normalizeGradeLevelInput(a.gradeLevel ?? ''),
              regularRows: regularRows.length ? regularRows : [{ subjectName: '', score: '' }],
              foreignRows: foreignRows.length ? foreignRows : [{ subjectName: '', score: '' }],
            };
          }).map(normalizeAcademicWithCatalogSubjects)
        );
      } else {
        setAcademics([normalizeAcademicWithCatalogSubjects(emptyAcademic())]);
      }
    } else {
      setStudentName('');
      setGender('');
      setPersonalityCode('');
      setFavouriteJob('');
      setAcademics([normalizeAcademicWithCatalogSubjects(emptyAcademic())]);
    }
  }, [visible, initialStudent, subjectGroups, normalizeAcademicWithCatalogSubjects]);

  useEffect(() => {
    if (!visible || !regularSubjectNames.length) return;
    setAcademics((prev) => prev.map(normalizeAcademicWithCatalogSubjects));
  }, [visible, regularSubjectNames, normalizeAcademicWithCatalogSubjects]);

  const openSubjectPicker = (bi: number, ri: number, type: SubjectType) => {
    setPickTarget({ bi, ri, type });
    setSubjectPickerOpen(true);
  };

  const onSubjectPicked = (name: string) => {
    if (!pickTarget) return;
    const { bi, ri, type } = pickTarget;
    clearFieldError(`row-${type === 'foreign_language' ? 'foreign' : 'regular'}-${bi}-${ri}`);
    setAcademics((prev) => {
      const next = prev.map((b, i) => {
        if (i !== bi) return b;
        const key = type === 'foreign_language' ? 'foreignRows' : 'regularRows';
        const rows = b[key].map((r, j) => (j === ri ? { ...r, subjectName: name } : r));
        return { ...b, [key]: rows };
      });
      return next;
    });
    setPickTarget(null);
  };

  const disabledSubjectNamesForPicker = useMemo(() => {
    if (!pickTarget) return new Set<string>();
    const block = academics[pickTarget.bi];
    if (!block) return new Set<string>();
    const normalized = normalizeAcademicBlock(block);
    const key = pickTarget.type === 'foreign_language' ? 'foreignRows' : 'regularRows';

    return new Set(
      normalized[key]
        .filter((_, index) => index !== pickTarget.ri)
        .map((row) => row.subjectName.trim())
        .filter(Boolean)
    );
  }, [academics, pickTarget]);

  const addAcademicBlock = () => setAcademics((p) => [...p, normalizeAcademicWithCatalogSubjects(emptyAcademic())]);
  const removeAcademicBlock = (bi: number) => {
    if (academics.length <= 1) return;
    setAcademics((p) => p.filter((_, i) => i !== bi));
  };

  const addSubjectRow = (bi: number, type: SubjectType) => {
    setAcademics((p) =>
      p.map((b, i) => {
        if (i !== bi) return b;
        const normalized = normalizeAcademicBlock(b);
        const key = type === 'foreign_language' ? 'foreignRows' : 'regularRows';
        return { ...normalized, [key]: [...normalized[key], { subjectName: '', score: '' }] };
      })
    );
  };

  const removeSubjectRow = (bi: number, ri: number, type: SubjectType) => {
    setAcademics((p) =>
      p.map((b, i) => {
        if (i !== bi) return b;
        const normalized = normalizeAcademicBlock(b);
        const key = type === 'foreign_language' ? 'foreignRows' : 'regularRows';
        if (normalized[key].length <= 1) return normalized;
        return { ...normalized, [key]: normalized[key].filter((_, j) => j !== ri) };
      })
    );
  };

  const updateGrade = (bi: number, text: string) => {
    clearFieldError(`grade-${bi}`);
    setAcademics((p) => p.map((b, i) => (i === bi ? { ...b, gradeLevel: text } : b)));
  };

  const updateRow = (bi: number, ri: number, patch: Partial<SubjectRow>, type: SubjectType) => {
    clearFieldError(`row-${type === 'foreign_language' ? 'foreign' : 'regular'}-${bi}-${ri}`);
    setAcademics((p) =>
      p.map((b, i) => {
        if (i !== bi) return b;
        const normalized = normalizeAcademicBlock(b);
        const key = type === 'foreign_language' ? 'foreignRows' : 'regularRows';
        return {
          ...normalized,
          [key]: normalized[key].map((r, j) => (j === ri ? { ...r, ...patch } : r)),
        };
      })
    );
  };

  const setTranscriptStatus = useCallback(
    (gradeLevel: string, patch: Partial<TranscriptUploadItem>) => {
      setTranscriptUploads((prev) => ({
        ...prev,
        [gradeLevel]: {
          ...prev[gradeLevel],
          imageUrl: prev[gradeLevel]?.imageUrl ?? null,
          status: prev[gradeLevel]?.status ?? 'idle',
          ...patch,
        },
      }));
    },
    []
  );

  const pickAndUploadTranscript = useCallback(
    async (gradeLevel: string, source: 'camera' | 'library') => {
      try {
        const permission =
          source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showWarning('Bạn chưa cấp quyền truy cập ảnh/camera', 'Warning');
          return;
        }

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({
                allowsEditing: false,
                quality: 0.85,
              })
            : await ImagePicker.launchImageLibraryAsync({
                allowsEditing: false,
                quality: 0.85,
              });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        if (!asset?.uri) return;

        setTranscriptStatus(gradeLevel, { localUri: asset.uri, status: 'uploading', error: undefined });
        try {
          const uploadedUrl = await uploadImageToCloudinary({
            uri: asset.uri,
            mimeType: asset.mimeType || 'image/jpeg',
            fileName: asset.fileName || `transcript-${gradeLevel}.jpg`,
          });
          setTranscriptStatus(gradeLevel, {
            imageUrl: uploadedUrl,
            localUri: asset.uri,
            status: 'uploaded',
            error: undefined,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Upload thất bại';
          setTranscriptStatus(gradeLevel, { status: 'error', error: message });
          showError(message, 'Upload thất bại');
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Không thể mở camera/thư viện';
        showError(message, 'Không mở được trình chọn ảnh');
        setTranscriptStatus(gradeLevel, { status: 'error', error: message });
      }
    },
    [setTranscriptStatus, showError, showWarning]
  );

  const removeTranscriptUpload = useCallback((gradeLevel: string) => {
    setTranscriptUploads((prev) => ({
      ...prev,
      [gradeLevel]: { imageUrl: null, status: 'idle' },
    }));
  }, []);

  const applyAutoFillResult = useCallback(
    (academicInfos: AcademicInfo[]) => {
      setAcademics((prev) =>
        prev.map((rawBlock) => {
          const block = normalizeAcademicBlock(rawBlock);
          const normalizedGrade = normalizeGradeLevelInput(block.gradeLevel);
          const matched = academicInfos.find((a) => normalizeGradeLevelInput(a.gradeLevel) === normalizedGrade);
          if (!matched) return normalizeAcademicWithCatalogSubjects(block);

          const regularRows: SubjectRow[] = [];
          const foreignRows: SubjectRow[] = [];
          (matched.subjectResults || []).forEach((sr) => {
            const normalizedName = normalizeVietnameseText(sr.subjectName || '');
            const row = { subjectName: sr.subjectName, score: String(sr.score ?? '') };
            if (foreignSubjectNameKeys.has(normalizedName)) foreignRows.push(row);
            else regularRows.push(row);
          });

          return normalizeAcademicWithCatalogSubjects({
            gradeLevel: normalizedGrade,
            regularRows,
            foreignRows: foreignRows.length ? foreignRows : [{ subjectName: '', score: '' }],
          });
        })
      );
      showSuccess('Đã điền điểm từ học bạ vào form.', 'Thành công');
    },
    [foreignSubjectNameKeys, normalizeAcademicWithCatalogSubjects, showSuccess]
  );

  const runAutoFillTranscript = useCallback(async () => {
    const payloadImages: TranscriptImagePayload[] = GRADE_OPTIONS.map((g) => ({
      gradeLevel: g.value,
      imageUrl: transcriptUploads[g.value]?.imageUrl || null,
    }));
    if (!payloadImages.some((x) => x.imageUrl)) {
      showWarning('Vui lòng tải ít nhất 1 ảnh học bạ trước khi tự động điền', 'Warning');
      return;
    }

    setTranscriptExtracting(true);
    setTranscriptPreview([]);
    try {
      setTranscriptUploads((prev) => {
        const next = { ...prev };
        payloadImages.forEach((img) => {
          if (!img.imageUrl) return;
          next[img.gradeLevel] = {
            ...(next[img.gradeLevel] || { imageUrl: img.imageUrl, status: 'uploaded' }),
            status: 'extracting',
            error: undefined,
          };
        });
        return next;
      });

      const res = await autoFillTranscriptScores({ images: payloadImages });
      const infos = Array.isArray(res.body?.academicInfos) ? res.body.academicInfos : [];
      setTranscriptPreview(infos);
      setTranscriptPreviewOpen(true);
      setTranscriptUploads((prev) => {
        const next = { ...prev };
        payloadImages.forEach((img) => {
          if (!img.imageUrl) return;
          next[img.gradeLevel] = {
            ...(next[img.gradeLevel] || { imageUrl: img.imageUrl, status: 'uploaded' }),
            status: 'extracted',
            error: undefined,
          };
        });
        return next;
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Không thể trích xuất điểm từ học bạ';
      showError(message, 'Something went wrong');
      setTranscriptUploads((prev) => {
        const next = { ...prev };
        payloadImages.forEach((img) => {
          if (!img.imageUrl) return;
          next[img.gradeLevel] = {
            ...(next[img.gradeLevel] || { imageUrl: img.imageUrl, status: 'uploaded' }),
            status: 'error',
            error: message,
          };
        });
        return next;
      });
    } finally {
      setTranscriptExtracting(false);
    }
  }, [showError, showWarning, transcriptUploads]);

  const handleSave = async () => {
    setFieldErrors({});
    const name = studentName.trim();
    if (!name) {
      warnRequiredAt('name');
      return;
    }
    if (!gender) {
      warnRequiredAt('gender');
      return;
    }
    if (!personalityCode.trim()) {
      warnRequiredAt('personality');
      return;
    }
    const favJob = favouriteJob.trim();
    if (!favJob) {
      warnRequiredAt('favouriteJob');
      return;
    }

    const academicInfos: AcademicInfo[] = [];
    for (let bi = 0; bi < academics.length; bi++) {
      const rawBlock = academics[bi];
      const block = normalizeAcademicBlock(rawBlock);
      const gl = normalizeGradeLevelInput(block.gradeLevel);
      if (!gl) {
        warnRequiredAt(`grade-${bi}`, 'Vui lòng chọn khối/lớp');
        return;
      }
      if (!ALLOWED_GRADE_LEVELS.has(gl)) {
        warnRequiredAt(`grade-${bi}`, 'Khối/lớp không hợp lệ');
        return;
      }
      const subjectResults: { subjectName: string; score: number }[] = [];
      for (let ri = 0; ri < block.regularRows.length; ri++) {
        const row = block.regularRows[ri];
        const sn = row.subjectName.trim();
        if (!sn) continue;
        if (!allowedRegularSubjectNameKeys.has(normalizeVietnameseText(sn))) continue;
        const scoreText = row.score.trim();
        if (!scoreText) continue;
        const sc = parseFloat(scoreText.replace(',', '.'));
        if (Number.isNaN(sc)) {
          warnRequiredAt(`row-regular-${bi}-${ri}`, 'Vui lòng nhập điểm hợp lệ');
          return;
        }
        subjectResults.push({ subjectName: sn, score: sc });
      }
      for (let ri = 0; ri < block.foreignRows.length; ri++) {
        const row = block.foreignRows[ri];
        const sn = row.subjectName.trim();
        if (!sn) continue;
        const sc = parseFloat(row.score.replace(',', '.'));
        if (Number.isNaN(sc)) {
          warnRequiredAt(`row-foreign-${bi}-${ri}`, 'Vui lòng nhập điểm hợp lệ');
          return;
        }
        subjectResults.push({ subjectName: sn, score: sc });
      }
      if (!subjectResults.length) {
        warnRequiredAt(`row-regular-${bi}-0`, 'Vui lòng nhập ít nhất 1 môn học');
        return;
      }
      academicInfos.push({ gradeLevel: gl, subjectResults });
    }

    const transcriptImages = GRADE_OPTIONS
      .map((g) => ({
        grade: g.value,
        imageUrl: transcriptUploads[g.value]?.imageUrl || null,
      }))
      .filter((item) => item.imageUrl);

    const payloadBase = {
      studentName: name,
      gender,
      personalityTypeCode: personalityCode.trim().toUpperCase(),
      favouriteJob: favJob,
      academicInfos,
      transcriptImages,
    };

    const rawId = initialStudent?.id;
    const studentIdForUpdate =
      rawId === undefined || rawId === null
        ? NaN
        : typeof rawId === 'number'
          ? rawId
          : Number(String(rawId).trim());

    if (initialStudent && !Number.isFinite(studentIdForUpdate)) {
      showWarning('Thiếu mã học sinh, không thể cập nhật. Vui lòng tải lại danh sách.', 'Warning');
      return;
    }

    setSaving(true);
    try {
      if (initialStudent) {
        await updateParentStudent({
          studentId: studentIdForUpdate,
          ...payloadBase,
        });
        showSuccess('Đã cập nhật hồ sơ học sinh.', 'Thành công');
      } else {
        await createParentStudent(payloadBase);
        showSuccess('Đã thêm hồ sơ học sinh.', 'Thành công');
      }
      onSaved();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không lưu được';
      showError(msg, 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const renderPersonalityGrid = () => {
    if (!personalityGrouped) return null;
    const entries = Object.entries(personalityGrouped);
    return entries.map(([groupName, list]) => (
      <View key={groupName} style={styles.pGroup}>
        <Text style={styles.pGroupTitle}>{groupName}</Text>
        <View style={styles.pGrid}>
          {(list as PersonalityTypeDetail[]).map((p) => {
            const selected = personalityCode === p.code;
            const accent = groupColorForPersonality(p.personalityTypeGroup);
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  setPersonalityCode(p.code);
                  clearFieldError('personality');
                }}
                style={({ pressed }) => [
                  styles.pCard,
                  { width: CARD_W },
                  selected && { borderColor: accent, backgroundColor: `${accent}14` },
                  pressed && { opacity: 0.92 },
                ]}
              >
                <Image source={{ uri: p.image }} style={styles.pCardImg} resizeMode="contain" />
                <Text style={styles.pCardCode}>{p.code}</Text>
                <Text style={styles.pCardName} numberOfLines={2}>
                  {p.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={26} color="#64748b" />
          </Pressable>
          <Text style={styles.headerTitle}>{initialStudent ? 'Cập nhật hồ sơ con' : 'Thêm hồ sơ con'}</Text>
          <View style={{ width: 40 }} />
        </View>

        {loadingRefs ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Đang tải danh mục…</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View ref={scrollContentRef} collapsable={false}>

            <View style={styles.field} ref={setFieldRef('name')} collapsable={false}>
              <Text style={styles.label}>
                Tên học sinh <Text style={styles.req}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={studentName}
                onChangeText={(t) => {
                  setStudentName(t);
                  clearFieldError('name');
                }}
                placeholder="Ví dụ: Nguyễn Văn A"
                placeholderTextColor="#94a3b8"
              />
              {!!fieldErrors.name && <Text style={styles.fieldErrorText}>{fieldErrors.name}</Text>}
            </View>

            <View style={styles.field} ref={setFieldRef('gender')} collapsable={false}>
              <Text style={styles.label}>
                Giới tính <Text style={styles.req}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g.value}
                    onPress={() => {
                      setGender(g.value);
                      clearFieldError('gender');
                    }}
                    style={[styles.chip, gender === g.value && styles.chipOn]}
                  >
                    <Text style={[styles.chipTxt, gender === g.value && styles.chipTxtOn]}>{g.label}</Text>
                  </Pressable>
                ))}
              </View>
              {!!fieldErrors.gender && <Text style={styles.fieldErrorText}>{fieldErrors.gender}</Text>}
            </View>

            <View style={styles.field} ref={setFieldRef('personality')} collapsable={false}>
              <Text style={styles.label}>
                Tính cách MBTI <Text style={styles.req}>*</Text>
              </Text>
              {renderPersonalityGrid()}
              {!!fieldErrors.personality && <Text style={styles.fieldErrorText}>{fieldErrors.personality}</Text>}
            </View>

            <View style={styles.field} ref={setFieldRef('favouriteJob')} collapsable={false}>
              <Text style={styles.label}>
                Nghề nghiệp yêu thích <Text style={styles.req}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={favouriteJob}
                onChangeText={(t) => {
                  setFavouriteJob(t);
                  clearFieldError('favouriteJob');
                  setJobSuggestOpen(true);
                }}
                onFocus={() => setJobSuggestOpen(true)}
                placeholder="Gõ để gợi ý từ danh ngành đại học"
                placeholderTextColor="#94a3b8"
              />
              {!!fieldErrors.favouriteJob && <Text style={styles.fieldErrorText}>{fieldErrors.favouriteJob}</Text>}
              {jobSuggestOpen && filteredMajorGroups.length > 0 && (
                <View style={styles.suggestBox}>
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator
                    style={styles.suggestScroll}
                    contentContainerStyle={styles.suggestScrollContent}
                  >
                    {filteredMajorGroups.map((g) => {
                      const open = majorGroupsExpanded[g.group] !== false;
                      return (
                        <View key={g.group} style={styles.suggestAcc}>
                          <Pressable
                            onPress={() =>
                              setMajorGroupsExpanded((s) => ({ ...s, [g.group]: !open }))
                            }
                            style={styles.suggestAccHead}
                          >
                            <Text style={styles.suggestGroupTitle} numberOfLines={2}>
                              {g.group}
                            </Text>
                            <Ionicons
                              name={open ? 'chevron-up' : 'chevron-down'}
                              size={20}
                              color="#64748b"
                            />
                          </Pressable>
                          {open &&
                            g.majors.map((m) => (
                              <Pressable
                                key={`${g.group}-${m.code}`}
                                onPress={() => {
                                  setFavouriteJob(m.name);
                                  setJobSuggestOpen(false);
                                }}
                                style={styles.suggestRow}
                              >
                                <Text style={styles.suggestText} numberOfLines={2}>
                                  {m.name}
                                </Text>
                              </Pressable>
                            ))}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {jobSuggestOpen &&
                favouriteJob.trim().length > 0 &&
                majorGroups.length > 0 &&
                filteredMajorGroups.length === 0 && (
                  <View style={styles.suggestBox}>
                    <Text style={styles.suggestEmpty}>Không tìm thấy ngành phù hợp</Text>
                  </View>
                )}
            </View>

            <Text style={styles.sectionHdr}>Kết quả học tập theo khối</Text>
            {academics.map((rawBlock, bi) => {
              const block = normalizeAcademicBlock(rawBlock);
              return (
              <View key={bi} style={styles.academicCard}>
                <View style={styles.academicHead}>
                  <Text style={styles.academicTitle}>Khối / lớp</Text>
                  {academics.length > 1 && (
                    <Pressable onPress={() => removeAcademicBlock(bi)}>
                      <Text style={styles.removeTxt}>Xóa khối</Text>
                    </Pressable>
                  )}
                </View>
                <View ref={setFieldRef(`grade-${bi}`)} collapsable={false}>
                <TextInput
                  style={styles.input}
                  value={gradeLevelDisplayValue(block.gradeLevel)}
                  onChangeText={(t) => updateGrade(bi, t)}
                  placeholder="Ví dụ: Lớp 9"
                  placeholderTextColor="#94a3b8"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeScroll}>
                  {GRADE_OPTIONS.map((g) => (
                    <Pressable key={g.value} onPress={() => updateGrade(bi, g.value)} style={styles.gradeChip}>
                      <Text style={styles.gradeChipTxt}>{g.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {!!fieldErrors[`grade-${bi}`] && <Text style={styles.fieldErrorText}>{fieldErrors[`grade-${bi}`]}</Text>}
                </View>

                {ALLOWED_GRADE_LEVELS.has(normalizeGradeLevelInput(block.gradeLevel)) && (
                  <View style={styles.transcriptCard}>
                    <View style={styles.transcriptHead}>
                      <Text style={styles.transcriptTitle}>Tải học bạ {gradeLevelDisplayValue(block.gradeLevel)}</Text>
                      {(() => {
                        const grade = normalizeGradeLevelInput(block.gradeLevel);
                        const status = transcriptUploads[grade]?.status || 'idle';
                        const statusMap: Record<TranscriptUploadStatus, { label: string; color: string; bg: string }> = {
                          idle: { label: 'Chưa tải', color: '#64748b', bg: '#f1f5f9' },
                          uploading: { label: 'Đang tải', color: '#b45309', bg: '#fef3c7' },
                          uploaded: { label: 'Đã tải', color: '#1d4ed8', bg: '#dbeafe' },
                          extracting: { label: 'Đang xử lý', color: '#b45309', bg: '#fef3c7' },
                          extracted: { label: 'Đã trích xuất', color: '#15803d', bg: '#dcfce7' },
                          error: { label: 'Lỗi', color: '#b91c1c', bg: '#fee2e2' },
                        };
                        const st = statusMap[status];
                        return (
                          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                            <Text style={[styles.statusBadgeTxt, { color: st.color }]}>{st.label}</Text>
                          </View>
                        );
                      })()}
                    </View>
                    <Text style={styles.transcriptHint}>Chụp hoặc tải ảnh để hệ thống tự động nhập điểm.</Text>
                    <View style={styles.transcriptActions}>
                      <Pressable
                        onPress={() => pickAndUploadTranscript(normalizeGradeLevelInput(block.gradeLevel), 'camera')}
                        style={styles.outlineBtn}
                      >
                        <Ionicons name="camera-outline" size={17} color={PRIMARY} />
                        <Text style={styles.outlineBtnTxt}>Chụp ảnh</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => pickAndUploadTranscript(normalizeGradeLevelInput(block.gradeLevel), 'library')}
                        style={styles.outlineBtn}
                      >
                        <Ionicons name="images-outline" size={17} color={PRIMARY} />
                        <Text style={styles.outlineBtnTxt}>Chọn từ thư viện</Text>
                      </Pressable>
                    </View>
                    {(() => {
                      const grade = normalizeGradeLevelInput(block.gradeLevel);
                      const item = transcriptUploads[grade];
                      if (!item?.localUri) return null;
                      return (
                        <View style={styles.uploadPreviewRow}>
                          <Image source={{ uri: item.localUri }} style={styles.uploadThumb} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.uploadPreviewTxt}>Ảnh học bạ {gradeLevelDisplayValue(block.gradeLevel)}</Text>
                            {!!item.error && <Text style={styles.uploadErrorTxt}>{item.error}</Text>}
                          </View>
                          <Pressable onPress={() => removeTranscriptUpload(grade)} style={styles.trashBtn}>
                            <Ionicons name="trash-outline" size={19} color="#ef4444" />
                          </Pressable>
                        </View>
                      );
                    })()}
                    {bi === 0 && (
                      <Pressable onPress={runAutoFillTranscript} style={styles.autoFillBtn} disabled={transcriptExtracting}>
                        <LinearGradient colors={[...GRADIENT_SAVE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.autoFillGrad}>
                          {transcriptExtracting ? (
                            <>
                              <ActivityIndicator size="small" color="#fff" />
                              <Text style={styles.autoFillTxt}>Đang đọc dữ liệu học bạ...</Text>
                            </>
                          ) : (
                            <>
                              <Ionicons name="sparkles-outline" size={18} color="#fff" />
                              <Text style={styles.autoFillTxt}>Tự động điền điểm</Text>
                            </>
                          )}
                        </LinearGradient>
                      </Pressable>
                    )}
                  </View>
                )}

                <Text style={styles.subjectSectionTitle}>Môn học chính</Text>
                {block.regularRows.map((row, ri) => (
                  <View key={ri} style={styles.rowBlock} ref={setFieldRef(`row-regular-${bi}-${ri}`)} collapsable={false}>
                    <Text style={styles.rowLabel}>Môn & điểm</Text>
                    <View style={styles.rowInner}>
                      <View style={styles.subjectPick}>
                        <Text style={styles.subjectPickTxt}>{row.subjectName}</Text>
                      </View>
                      <TextInput
                        style={styles.scoreInput}
                        value={row.score}
                        onChangeText={(t) => updateRow(bi, ri, { score: t }, 'regular')}
                        placeholder="Điểm"
                        placeholderTextColor="#94a3b8"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    {!!fieldErrors[`row-regular-${bi}-${ri}`] && (
                      <Text style={styles.fieldErrorText}>{fieldErrors[`row-regular-${bi}-${ri}`]}</Text>
                    )}
                  </View>
                ))}

                <Text style={styles.subjectSectionTitle}>Ngoại ngữ (không bắt buộc)</Text>
                {block.foreignRows.map((row, ri) => (
                  <View key={ri} style={styles.rowBlock} ref={setFieldRef(`row-foreign-${bi}-${ri}`)} collapsable={false}>
                    <Text style={styles.rowLabel}>Môn & điểm</Text>
                    <View style={styles.rowInner}>
                      <Pressable
                        style={styles.subjectPick}
                        onPress={() => openSubjectPicker(bi, ri, 'foreign_language')}
                      >
                        <Text style={row.subjectName ? styles.subjectPickTxt : styles.subjectPickPh}>
                          {row.subjectName || 'Chọn ngoại ngữ'}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#64748b" />
                      </Pressable>
                      <TextInput
                        style={styles.scoreInput}
                        value={row.score}
                        onChangeText={(t) => updateRow(bi, ri, { score: t }, 'foreign_language')}
                        placeholder="Điểm"
                        placeholderTextColor="#94a3b8"
                        keyboardType="decimal-pad"
                      />
                      {block.foreignRows.length > 1 && (
                        <Pressable onPress={() => removeSubjectRow(bi, ri, 'foreign_language')} style={styles.trashBtn}>
                          <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </Pressable>
                      )}
                    </View>
                    {!!fieldErrors[`row-foreign-${bi}-${ri}`] && (
                      <Text style={styles.fieldErrorText}>{fieldErrors[`row-foreign-${bi}-${ri}`]}</Text>
                    )}
                  </View>
                ))}
                <Pressable onPress={() => addSubjectRow(bi, 'foreign_language')} style={styles.addRowBtn}>
                  <Ionicons name="add-circle-outline" size={20} color={PRIMARY} />
                  <Text style={styles.addRowTxt}>Thêm ngoại ngữ</Text>
                </Pressable>
              </View>
            )})}

            <Pressable onPress={addAcademicBlock} style={styles.addBlockBtn}>
              <Ionicons name="layers-outline" size={22} color={PRIMARY} />
              <Text style={styles.addBlockTxt}>Thêm khối học khác</Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [styles.saveBtn, (pressed || saving) && { opacity: 0.9 }]}
            >
              <LinearGradient colors={[...GRADIENT_SAVE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveGrad}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Lưu hồ sơ</Text>}
              </LinearGradient>
            </Pressable>

            <View style={{ height: 48 }} />
            </View>
          </ScrollView>
        )}

        <SubjectPickerModal
          visible={subjectPickerOpen}
          groups={subjectGroups.filter((g) =>
            pickTarget?.type === 'foreign_language' ? g.type === 'foreign_language' : g.type === 'regular'
          )}
          disabledNames={disabledSubjectNamesForPicker}
          onClose={() => {
            setSubjectPickerOpen(false);
            setPickTarget(null);
          }}
          onPick={onSubjectPicked}
        />

        <Modal
          visible={transcriptPreviewOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setTranscriptPreviewOpen(false)}
        >
          <View style={styles.previewOverlay}>
            <View style={styles.previewSheet}>
              <View style={styles.previewHead}>
                <Text style={styles.previewTitle}>Kết quả nhận diện</Text>
                <Pressable onPress={() => setTranscriptPreviewOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.previewBody}>
                {GRADE_OPTIONS.map((g) => {
                  const info = transcriptPreview.find((x) => normalizeGradeLevelInput(x.gradeLevel) === g.value);
                  const rows = Array.isArray(info?.subjectResults) ? info?.subjectResults : [];
                  return (
                    <View key={g.value} style={styles.previewGradeCard}>
                      <Text style={styles.previewGradeTitle}>{g.label}</Text>
                      {rows.length ? (
                        rows.map((row, idx) => (
                          <View key={`${g.value}-${idx}`} style={styles.previewRow}>
                            <Text style={styles.previewSubject} numberOfLines={1}>
                              {row.subjectName}
                            </Text>
                            <Text style={styles.previewScore}>{row.score}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.previewEmpty}>Chưa có dữ liệu điểm cho khối này</Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              <Text style={styles.previewWarn}>Dữ liệu trong form sẽ được cập nhật theo kết quả nhận diện.</Text>
              <View style={styles.previewActions}>
                <Pressable onPress={() => setTranscriptPreviewOpen(false)} style={styles.previewCancelBtn}>
                  <Text style={styles.previewCancelTxt}>Đóng</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    applyAutoFillResult(transcriptPreview);
                    setTranscriptPreviewOpen(false);
                  }}
                  style={styles.previewApplyBtn}
                >
                  <Text style={styles.previewApplyTxt}>Điền vào form</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 54 : 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  closeBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#64748b' },
  scroll: { flex: 1 },
  scrollContent: { padding: sp.lg },
  hint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: sp.md,
    lineHeight: 18,
  },
  field: { marginBottom: sp.lg },
  label: { fontSize: 15, fontWeight: '600', color: '#334155', marginBottom: sp.xs },
  req: { color: '#ef4444' },
  fieldErrorText: {
    marginTop: 6,
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: '#f1f5f9',
  },
  chipOn: { backgroundColor: '#dbeafe' },
  chipTxt: { fontSize: 15, color: '#64748b', fontWeight: '500' },
  chipTxtOn: { color: PRIMARY, fontWeight: '700' },
  pGroup: { marginBottom: sp.md },
  pGroupTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: sp.sm },
  pGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  pCard: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  pCardImg: { width: '100%', height: 72 },
  pCardCode: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  pCardName: { fontSize: 11, color: '#64748b', textAlign: 'center' },
  suggestBox: {
    marginTop: 8,
    maxHeight: 320,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestScroll: { maxHeight: 320 },
  suggestScrollContent: { paddingBottom: 8 },
  suggestAcc: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  suggestAccHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  suggestGroupTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  suggestRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingLeft: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  suggestText: { fontSize: 14, color: '#334155' },
  suggestEmpty: { padding: 14, fontSize: 14, color: '#64748b', textAlign: 'center' },
  sectionHdr: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: sp.sm },
  academicCard: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: sp.md,
    marginBottom: sp.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  academicHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.xs },
  academicTitle: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  removeTxt: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  subjectSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: sp.md,
    marginBottom: 2,
  },
  gradeScroll: { marginVertical: sp.sm },
  gradeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  gradeChipTxt: { fontSize: 13, fontWeight: '600', color: '#475569' },
  transcriptCard: {
    marginTop: 4,
    backgroundColor: '#f8fbff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderStyle: 'dashed',
    padding: sp.sm,
  },
  transcriptHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  transcriptTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  transcriptHint: { marginTop: 6, fontSize: 12, color: '#64748b' },
  transcriptActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  outlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  outlineBtnTxt: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  statusBadgeTxt: { fontSize: 11, fontWeight: '700' },
  uploadPreviewRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 8,
  },
  uploadThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#e2e8f0' },
  uploadPreviewTxt: { fontSize: 12, fontWeight: '600', color: '#334155' },
  uploadErrorTxt: { marginTop: 2, fontSize: 11, color: '#dc2626' },
  autoFillBtn: { marginTop: 10, borderRadius: radius.md, overflow: 'hidden' },
  autoFillGrad: {
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  autoFillTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  rowBlock: { marginTop: sp.sm },
  rowLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 6 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectPick: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  subjectPickTxt: { fontSize: 15, color: '#0f172a', flex: 1 },
  subjectPickPh: { fontSize: 15, color: '#94a3b8', flex: 1 },
  scoreInput: {
    width: 72,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
    textAlign: 'center',
  },
  trashBtn: { padding: 8 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: sp.sm },
  addRowTxt: { fontSize: 14, fontWeight: '600', color: PRIMARY },
  addBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: sp.lg,
  },
  addBlockTxt: { fontSize: 15, fontWeight: '700', color: PRIMARY },
  saveBtn: { borderRadius: radius.lg, overflow: 'hidden', minHeight: 52 },
  saveGrad: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  previewSheet: {
    maxHeight: '88%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  previewTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  previewBody: { padding: sp.md, gap: 10 },
  previewGradeCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.lg,
    padding: sp.sm,
    backgroundColor: '#f8fafc',
  },
  previewGradeTitle: { fontSize: 14, fontWeight: '800', color: '#1e3a8a', marginBottom: 8 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  previewSubject: { flex: 1, fontSize: 13, color: '#334155' },
  previewScore: { width: 40, textAlign: 'right', fontSize: 13, fontWeight: '700', color: '#0f172a' },
  previewEmpty: { fontSize: 13, color: '#64748b' },
  previewWarn: {
    marginHorizontal: sp.md,
    marginTop: 4,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
  },
  previewActions: { flexDirection: 'row', gap: 10, padding: sp.md },
  previewCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  previewCancelTxt: { fontSize: 14, fontWeight: '600', color: '#475569' },
  previewApplyBtn: {
    flex: 1,
    backgroundColor: PRIMARY,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  previewApplyTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

const subPickerStyles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f8fafc' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingTop: Platform.OS === 'ios' ? 54 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  cancel: { fontSize: 16, color: '#64748b', fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  scroll: { padding: sp.md },
  acc: { marginBottom: sp.md, backgroundColor: '#fff', borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  accHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: sp.md,
    backgroundColor: '#f8fafc',
  },
  accLabel: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', padding: sp.sm, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: '#e3f2fd',
  },
  chipDisabled: {
    backgroundColor: '#f1f5f9',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: '#1565c0' },
  chipTextDisabled: { color: '#94a3b8' },
});
