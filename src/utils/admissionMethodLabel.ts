const METHOD_LABELS: Record<string, string> = {
  HOC_BA: 'Học bạ',
  THI_TUYEN: 'Thi tuyển',
  XET_TUYEN: 'Xét tuyển',
  PHONG_VAN: 'Phỏng vấn',
  DIRECT: 'Tuyển thẳng',
};

export function admissionMethodLabel(code?: string | null): string {
  const trimmed = code?.trim();
  if (!trimmed) return '—';
  return METHOD_LABELS[trimmed] ?? trimmed.replace(/_/g, ' ');
}
