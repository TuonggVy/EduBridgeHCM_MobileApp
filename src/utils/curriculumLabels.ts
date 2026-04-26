import type { TextStyle, ViewStyle } from 'react-native';

/** Nhãn tiếng Việt + màu badge theo loại chương trình (Material / design tokens) */
export function getCurriculumTypeLabel(curriculumType: string): string {
  const map: Record<string, string> = {
    INTEGRATED: 'Tích hợp',
    INTERNATIONAL: 'Quốc tế',
    NATIONAL: 'Trong nước',
    BILINGUAL: 'Song ngữ',
  };
  return map[curriculumType] ?? curriculumType;
}

export function getCurriculumTypeBadgeColors(curriculumType: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (curriculumType) {
    case 'INTEGRATED':
      return { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' };
    case 'INTERNATIONAL':
      return { bg: '#f3e8ff', text: '#7c3aed', border: '#c4b5fd' };
    case 'BILINGUAL':
      return { bg: '#ecfdf5', text: '#047857', border: '#6ee7b7' };
    case 'NATIONAL':
      return { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' };
    default:
      return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  }
}

/**
 * Khớp `LearningMethod` (BE): `name()` → `displayName` tiếng Việt.
 * Giữ thêm vài mã cũ nếu DB/response vẫn còn.
 */
export function getMethodLearningLabel(methodLearning: string): string {
  const map: Record<string, string> = {
    PROJECT_BASED: 'Dạy học dựa trên dự án',
    COOPERATIVE: 'Dạy học hợp tác',
    EXPERIENTIAL: 'Dạy học qua trải nghiệm',
    PROBLEM_BASED: 'Dạy học giải quyết vấn đề',
    PERSONALIZED: 'Cá nhân hóa học tập',
    BLENDED: 'Dạy học tích hợp/Trực tuyến',
    VISUAL_PRACTICE: 'Dạy học trực quan và thực hành',
    STEM_STEAM: 'Tích hợp STEM/STEAM',
    INQUIRY_BASED: 'Học khám phá',
    LECTURE_BASED: 'Học truyền thống',
  };
  return map[methodLearning] ?? methodLearning;
}

export function getMethodLearningBadgeColors(methodLearning: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (methodLearning) {
    case 'PROJECT_BASED':
      return { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' };
    case 'COOPERATIVE':
      return { bg: '#ecfdf5', text: '#047857', border: '#6ee7b7' };
    case 'EXPERIENTIAL':
      return { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' };
    case 'PROBLEM_BASED':
      return { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' };
    case 'PERSONALIZED':
      return { bg: '#f0fdf4', text: '#166534', border: '#86efac' };
    case 'BLENDED':
      return { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' };
    case 'VISUAL_PRACTICE':
      return { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' };
    case 'STEM_STEAM':
      return { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' };
    case 'INQUIRY_BASED':
      return { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' };
    case 'LECTURE_BASED':
      return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    default:
      return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
  }
}

export function getProgramActiveLabel(isActive: string): string {
  const map: Record<string, string> = {
    PRO_ACTIVE: 'Đang áp dụng',
    PRO_DRAFT: 'Nháp',
    PRO_CLOSED: 'Ngừng áp dụng',
  };
  return map[isActive] ?? isActive;
}

export function getProgramActiveBadgeColors(isActive: string): { bg: string; text: string } {
  switch (isActive) {
    case 'PRO_ACTIVE':
      return { bg: '#dcfce7', text: '#15803d' };
    case 'PRO_DRAFT':
      return { bg: '#fef3c7', text: '#b45309' };
    case 'PRO_CLOSED':
      return { bg: '#fee2e2', text: '#b91c1c' };
    default:
      return { bg: '#f1f5f9', text: '#475569' };
  }
}

export function getCurriculumStatusLabel(status: string): string {
  const map: Record<string, string> = {
    CUR_ACTIVE: 'Đang mở',
    CUR_DRAFT: 'Nháp',
    CUR_CLOSED: 'Đã đóng',
  };
  return map[status] ?? status;
}

export function getCurriculumStatusBadgeColors(status: string): {
  bg: string;
  text: string;
} {
  switch (status) {
    case 'CUR_ACTIVE':
      return { bg: '#dcfce7', text: '#15803d' };
    case 'CUR_DRAFT':
      return { bg: '#f1f5f9', text: '#64748b' };
    case 'CUR_CLOSED':
      return { bg: '#fee2e2', text: '#b91c1c' };
    default:
      return { bg: '#f1f5f9', text: '#475569' };
  }
}

export function badgePillStyle(colors: {
  bg: string;
  text: string;
  border?: string;
}): { wrap: ViewStyle; text: TextStyle } {
  return {
    wrap: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.bg,
      borderWidth: colors.border ? 1 : 0,
      borderColor: colors.border ?? 'transparent',
    },
    text: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
  };
}
