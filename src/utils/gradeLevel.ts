const GRADE_LABELS: Record<string, string> = {
  GRADE_06: 'Lớp 6',
  GRADE_07: 'Lớp 7',
  GRADE_08: 'Lớp 8',
  GRADE_09: 'Lớp 9',
};

export function formatGradeLevel(value: string | null | undefined): string {
  const raw = (value || '').trim().toUpperCase();
  if (!raw) return '';
  if (GRADE_LABELS[raw]) return GRADE_LABELS[raw];

  const match = raw.match(/^GRADE_(\d{1,2})$/);
  if (!match) return value?.trim() || '';
  const n = parseInt(match[1], 10);
  if (Number.isNaN(n)) return value?.trim() || '';
  return `Lớp ${n}`;
}

