import type { SchoolDetail } from '../types/school';

/** BE có thể trả `program` ở root offering hoặc lồng trong `curriculum.program`. */
export function resolveCampaignOfferingNodes(offering: Record<string, unknown>): {
  program: Record<string, unknown> | null;
  curriculum: Record<string, unknown> | null;
} {
  const curriculumTop =
    offering.curriculum && typeof offering.curriculum === 'object'
      ? (offering.curriculum as Record<string, unknown>)
      : null;
  const programTop =
    offering.program && typeof offering.program === 'object'
      ? (offering.program as Record<string, unknown>)
      : null;
  const programNested =
    curriculumTop?.program && typeof curriculumTop.program === 'object'
      ? (curriculumTop.program as Record<string, unknown>)
      : null;
  const program = programTop ?? programNested;
  const curriculum =
    curriculumTop ??
    (programTop?.curriculum && typeof programTop.curriculum === 'object'
      ? (programTop.curriculum as Record<string, unknown>)
      : null);
  return { program, curriculum };
}

/** Năm query GET .../campaign/template/public. */
export function pickCampaignQueryYear(detail: SchoolDetail | null): number {
  const years: number[] = [];
  for (const c of detail?.curriculumList ?? []) {
    if (typeof c.applicationYear === 'number' && c.applicationYear > 0) years.push(c.applicationYear);
    for (const prog of c.programList ?? []) {
      const cur = (prog as Record<string, unknown>).curriculum;
      if (cur && typeof cur === 'object') {
        const ay = (cur as Record<string, unknown>).applicationYear;
        if (typeof ay === 'number' && ay > 0) years.push(ay);
      }
    }
  }
  if (years.length > 0) return Math.max(...years);
  return new Date().getFullYear();
}

export function campaignQueryYears(detail: SchoolDetail | null): number[] {
  const primary = pickCampaignQueryYear(detail);
  const calendar = new Date().getFullYear();
  return primary === calendar ? [primary] : [primary, calendar];
}
