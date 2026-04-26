import type { PersonalityTypeDetail, PersonalityTypesGrouped } from '../types/studentProfile';

const GROUP_COLORS: Record<string, string> = {
  ANALYST: '#1976d2',
  DIPLOMAT: '#22c55e',
  SENTINEL: '#f59e0b',
  EXPLORER: '#ec4899',
};

export function flattenPersonalityTypes(
  grouped: PersonalityTypesGrouped | null | undefined
): PersonalityTypeDetail[] {
  if (!grouped || typeof grouped !== 'object') return [];
  const out: PersonalityTypeDetail[] = [];
  for (const list of Object.values(grouped)) {
    if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

export function findPersonalityByCode(
  grouped: PersonalityTypesGrouped | null | undefined,
  code: string
): PersonalityTypeDetail | undefined {
  const upper = code?.trim().toUpperCase();
  if (!upper) return undefined;
  return flattenPersonalityTypes(grouped).find((p) => p.code?.toUpperCase() === upper);
}

export function groupColorForPersonality(group: string | undefined): string {
  if (!group) return '#1976d2';
  return GROUP_COLORS[group] ?? '#1976d2';
}
