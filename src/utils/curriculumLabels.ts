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

export function getMethodLearningLabel(methodLearning: string): string {
  const map: Record<string, string> = {
    PROJECT_BASED: 'Học theo dự án',
    INQUIRY_BASED: 'Học khám phá',
    LECTURE_BASED: 'Học truyền thống',
    BLENDED: 'Kết hợp',
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
    case 'INQUIRY_BASED':
      return { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' };
    case 'BLENDED':
      return { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' };
    default:
      return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
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
