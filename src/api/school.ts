import { apiRequest } from './client';
import type {
  AdmissionDocumentRequirement,
  AdmissionMethodDetail,
  AdmissionProcessStep,
  Curriculum,
  CurriculumProgram,
  NearbyCampusSearchItem,
  NearbyCampusSearchResponse,
  SchoolCampaignTemplate,
  SchoolCampaignTemplateResponse,
  SchoolDetail,
  SchoolDetailResponse,
  SchoolListResponse,
  SchoolSummary,
} from '../types/school';

function normalizeSchoolSummary(school: SchoolSummary): SchoolSummary {
  return {
    ...school,
    description: school.description ?? null,
    averageRating: school.averageRating ?? null,
    websiteUrl: school.websiteUrl ?? null,
    hotline: school.hotline ?? null,
    emailSupport: school.emailSupport ?? null,
    representativeName: school.representativeName ?? null,
    logoUrl: school.logoUrl ?? null,
    foundingDate: school.foundingDate ?? null,
    isFavourite: Boolean(school.isFavourite),
    totalCampus: Number.isFinite(school.totalCampus) ? school.totalCampus : 0,
  };
}

function normalizeCampusList(school: SchoolDetail): SchoolDetail['campusList'] {
  const campusList = Array.isArray(school.campusList)
    ? school.campusList
    : Array.isArray(school.campustList)
      ? school.campustList
      : [];

  return campusList.map((campus) => ({
    ...campus,
    ward: typeof campus.ward === 'string' ? campus.ward : null,
    consultantEmails: Array.isArray(campus.consultantEmails)
      ? campus.consultantEmails.filter((email): email is string => typeof email === 'string')
      : [],
    facility: campus.facility && typeof campus.facility === 'object' ? campus.facility : null,
  }));
}

function normalizeCurriculumProgram(program: unknown): CurriculumProgram {
  if (!program || typeof program !== 'object') {
    return {
      baseTuitionFee: null,
      targetStudentDescription: null,
      name: '',
      campusProgramOfferingList: [],
      graduationStandard: null,
      isActive: null,
    };
  }
  const p = program as Record<string, unknown>;
  const fee = p.baseTuitionFee;
  return {
    baseTuitionFee: typeof fee === 'number' && Number.isFinite(fee) ? fee : null,
    targetStudentDescription: typeof p.targetStudentDescription === 'string' ? p.targetStudentDescription : null,
    name: typeof p.name === 'string' ? p.name : '',
    campusProgramOfferingList: Array.isArray(p.campusProgramOfferingList)
      ? (p.campusProgramOfferingList.filter((row) => row && typeof row === 'object') as CurriculumProgram['campusProgramOfferingList'])
      : [],
    graduationStandard: typeof p.graduationStandard === 'string' ? p.graduationStandard : null,
    isActive: typeof p.isActive === 'string' ? p.isActive : null,
  };
}

function normalizeCurriculum(curriculum: Curriculum & Record<string, unknown>): Curriculum {
  const legacyMethod = curriculum.methodLearning;
  const methodLearningList = Array.isArray(curriculum.methodLearningList)
    ? curriculum.methodLearningList.filter((m): m is string => typeof m === 'string')
    : typeof legacyMethod === 'string'
      ? [legacyMethod]
      : [];

  const applicationYear =
    typeof curriculum.applicationYear === 'number' && Number.isFinite(curriculum.applicationYear)
      ? curriculum.applicationYear
      : typeof curriculum.enrollmentYear === 'number' && Number.isFinite(curriculum.enrollmentYear)
        ? curriculum.enrollmentYear
        : 0;

  const programList = Array.isArray(curriculum.programList)
    ? curriculum.programList.map((row) => normalizeCurriculumProgram(row))
    : [];

  return {
    curriculumStatus: curriculum.curriculumStatus,
    methodLearningList,
    applicationYear,
    name: curriculum.name,
    description: curriculum.description ?? null,
    programList,
    subjectsJsonb: Array.isArray(curriculum.subjectsJsonb) ? curriculum.subjectsJsonb : [],
    curriculumType: curriculum.curriculumType,
    groupCode: curriculum.groupCode,
  };
}

function normalizeSchoolDetail(school: SchoolDetail): SchoolDetail {
  const campusList = normalizeCampusList(school);
  const curriculumList = Array.isArray(school.curriculumList)
    ? school.curriculumList.map((curriculum) => normalizeCurriculum(curriculum as Curriculum & Record<string, unknown>))
    : [];

  return {
    ...normalizeSchoolSummary(school),
    campusList,
    campustList: campusList,
    curriculumList,
  };
}

/**
 * GET /api/v1/school/public/list
 * BE không phân trang: trả về toàn bộ danh sách trong một response.
 * Filter / search / “lazy load” UI (slice theo batch) xử lý phía mobile.
 */
export async function fetchSchoolPublicList(): Promise<SchoolListResponse> {
  const response = await apiRequest<SchoolListResponse>('/api/v1/school/public/list', {
    method: 'GET',
  });
  return {
    ...response,
    body: Array.isArray(response.body) ? response.body.map(normalizeSchoolSummary) : [],
  };
}

export async function fetchSchoolPublicDetail(
  schoolId: number
): Promise<SchoolDetailResponse> {
  const response = await apiRequest<SchoolDetailResponse>(`/api/v1/school/${schoolId}/public/detail`, {
    method: 'GET',
  });
  return {
    ...response,
    body: response.body ? normalizeSchoolDetail(response.body) : response.body,
  };
}

function pickNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizeNearbyCampusSearchItem(item: Record<string, unknown>): NearbyCampusSearchItem | null {
  const id = pickNumber(item.id);
  const distance = pickNumber(item.distance);
  const latitude = pickNumber(item.latitude);
  const longitude = pickNumber(item.longitude);
  if (id == null || distance == null || latitude == null || longitude == null) return null;
  const emails = Array.isArray(item.consultantEmails)
    ? item.consultantEmails.filter((e): e is string => typeof e === 'string')
    : [];
  return {
    id,
    distance,
    latitude,
    longitude,
    name: pickString(item.name) ?? 'Cơ sở',
    address: pickString(item.address),
    city: pickString(item.city),
    district: pickString(item.district),
    ward: pickString(item.ward),
    imageJson: pickString(item.imageJson),
    policyDetail: pickString(item.policyDetail),
    consultantEmails: emails,
    boardingType: pickString(item.boardingType),
    phoneNumber: pickString(item.phoneNumber),
    facility: pickString(item.facility),
    status: pickString(item.status),
  };
}

/**
 * GET /api/v1/school/campus/search/nearby?lat=&lng=&radius=
 * Trả về campus trong bán kính; client có thể lọc theo `id` campus của một trường (vd. trong SchoolDetailModal).
 */
export async function searchNearbyCampus(
  lat: number,
  lng: number,
  radius = 10
): Promise<NearbyCampusSearchResponse> {
  const query = `lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&radius=${encodeURIComponent(String(radius))}`;
  const response = await apiRequest<{ message: string; body: unknown }>(
    `/api/v1/school/campus/search/nearby?${query}`,
    { method: 'GET' }
  );
  const rawBody = response.body;
  const body = Array.isArray(rawBody)
    ? rawBody
        .map((row) =>
          row && typeof row === 'object' ? normalizeNearbyCampusSearchItem(row as Record<string, unknown>) : null
        )
        .filter((row): row is NearbyCampusSearchItem => row != null)
    : [];
  return { message: response.message, body };
}

function normalizeAdmissionStep(step: unknown): AdmissionProcessStep | null {
  if (!step || typeof step !== 'object') return null;
  const s = step as Record<string, unknown>;
  if (typeof s.stepName !== 'string' || typeof s.stepOrder !== 'number') return null;
  return {
    stepName: s.stepName,
    stepOrder: s.stepOrder,
    description: typeof s.description === 'string' ? s.description : null,
  };
}

function normalizeAdmissionDoc(doc: unknown): AdmissionDocumentRequirement | null {
  if (!doc || typeof doc !== 'object') return null;
  const d = doc as Record<string, unknown>;
  if (typeof d.code !== 'string' || typeof d.name !== 'string') return null;
  return {
    code: d.code,
    name: d.name,
    required: Boolean(d.required),
  };
}

function normalizeDateParts(parts: unknown): number[] {
  if (!Array.isArray(parts)) return [];
  return parts.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
}

function normalizeAdmissionMethodDetail(method: unknown): AdmissionMethodDetail | null {
  if (!method || typeof method !== 'object') return null;
  const m = method as Record<string, unknown>;
  if (typeof m.methodCode !== 'string' || typeof m.displayName !== 'string') return null;
  return {
    endDate: normalizeDateParts(m.endDate),
    startDate: normalizeDateParts(m.startDate),
    methodCode: m.methodCode,
    description: typeof m.description === 'string' ? m.description : null,
    displayName: m.displayName,
    allowReservationSubmission: Boolean(m.allowReservationSubmission),
    admissionProcessSteps: Array.isArray(m.admissionProcessSteps)
      ? m.admissionProcessSteps
          .map((s) => normalizeAdmissionStep(s))
          .filter((s): s is AdmissionProcessStep => s != null)
      : [],
    methodDocumentRequirements: Array.isArray(m.methodDocumentRequirements)
      ? m.methodDocumentRequirements
          .map((d) => normalizeAdmissionDoc(d))
          .filter((d): d is AdmissionDocumentRequirement => d != null)
      : [],
  };
}

function normalizeCampaignTemplate(item: unknown): SchoolCampaignTemplate | null {
  if (!item || typeof item !== 'object') return null;
  const c = item as Record<string, unknown>;
  if (typeof c.id !== 'number' || typeof c.schoolId !== 'number' || typeof c.name !== 'string') return null;
  return {
    id: c.id,
    schoolId: c.schoolId,
    year: typeof c.year === 'number' ? c.year : new Date().getFullYear(),
    name: c.name,
    description: typeof c.description === 'string' ? c.description : null,
    startDate: typeof c.startDate === 'string' ? c.startDate : null,
    endDate: typeof c.endDate === 'string' ? c.endDate : null,
    status: typeof c.status === 'string' ? c.status : 'UNKNOWN',
    admissionMethodDetails: Array.isArray(c.admissionMethodDetails)
      ? c.admissionMethodDetails
          .map((m) => normalizeAdmissionMethodDetail(m))
          .filter((m): m is AdmissionMethodDetail => m != null)
      : [],
    admissionMethodTimelines: [],
    mandatoryAll: Array.isArray(c.mandatoryAll)
      ? c.mandatoryAll
          .map((d) => normalizeAdmissionDoc(d))
          .filter((d): d is AdmissionDocumentRequirement => d != null)
      : [],
    campusProgramOfferings: Array.isArray(c.campusProgramOfferings)
      ? c.campusProgramOfferings.filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      : [],
  };
}

export async function fetchSchoolCampaignTemplates(
  schoolId: number,
  year: number
): Promise<SchoolCampaignTemplateResponse> {
  const query = `year=${encodeURIComponent(String(year))}`;
  const response = await apiRequest<{ message: string; body: unknown }>(
    `/api/v1/school/${schoolId}/campaign/template/public?${query}`,
    { method: 'GET' }
  );
  const body = Array.isArray(response.body)
    ? response.body
        .map((row) => normalizeCampaignTemplate(row))
        .filter((row): row is SchoolCampaignTemplate => row != null)
    : [];
  return { message: response.message, body };
}
