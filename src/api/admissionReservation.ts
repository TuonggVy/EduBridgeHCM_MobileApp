import { apiRequest } from './client';

export type ReservationDocumentOcrCriterion = {
  label: string;
  validations: string[];
};

export type ReservationDocumentItem = {
  code: string;
  name: string;
  required: boolean;
  ocrCriteria?: ReservationDocumentOcrCriterion[];
};

export type ParentDocumentsResponse = {
  message: string;
  body: {
    required: ReservationDocumentItem[];
    optional: ReservationDocumentItem[];
  };
};

/** GET /api/v1/parent/documents — danh mục hồ sơ (mẫu giữ chỗ). */
export type ParentDocumentCatalogResponse = {
  message: string;
  body: ReservationDocumentItem[];
};

export type ReservationSubmissionPayload = {
  submissionDocuments: Array<{
    imageUrl: string[];
    key: string;
  }>;
  admissionCampaignId: number;
  studentProfileId: number;
};

/** POST /api/v1/parent/admission/reservation/form — nộp hồ sơ hàng loạt theo trường. */
export type BulkReservationSubmissionPayload = {
  submissionDocuments: Array<{
    imageUrl: string[];
    key: string;
  }>;
  schoolIds: number[];
  studentProfileId: number;
};

export type SchoolAvailabilitySchool = {
  schoolId: number;
  schoolName: string;
};

export type SchoolUnavailableGroup = {
  reason: string;
  schools: SchoolAvailabilitySchool[];
};

export type SchoolAvailabilityBody = {
  available: SchoolAvailabilitySchool[];
  unavailable: SchoolUnavailableGroup[];
};

export type SchoolAvailabilityResponse = {
  message: string;
  body: SchoolAvailabilityBody;
};

export type ReservationSubmissionResponse = {
  message: string;
  body: unknown;
};

export type ReservationFormStatus =
  | 'RESERVATION_PENDING'
  | 'RESERVATION_APPROVAL'
  | 'RESERVATION_APPROVED'
  | 'RESERVATION_REJECTED'
  | 'RESERVATION_CANCELLED';

export type ReservationFormMetaItem = {
  key: string;
  imageUrl: string[];
};

export type ReservationFormTranscriptImage = {
  grade: string;
  imageUrl: string | null;
};

/** GET /api/v1/parent/admission/reservation/form — phần tử body */
export type ReservationFormItem = {
  id: number;
  admissionCampaignId?: number | null;
  studentProfileId?: number | null;
  parentProfileId?: number | null;
  schoolName: string | null;
  campusProgramOfferingId?: string | null;
  programName: string | null;
  studentName: string | null;
  studentCode?: string | null;
  identityCard?: string | null;
  gender: string | null;
  address?: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentEmail: string | null;
  transferCode?: string | null;
  paymentProofUrl?: string | null;
  createdTime: string | null;
  updatedTime: string | null;
  status: ReservationFormStatus | string;
  rejectReason: string | null;
  cancelReason: string | null;
  verifiedBy?: string | null;
  profileMetaData: ReservationFormMetaItem[];
  transcriptImages?: ReservationFormTranscriptImage[];
};

type ReservationFormItemApi = Omit<ReservationFormItem, 'profileMetaData'> & {
  profileMetaData?: ReservationFormMetaItem[];
  /** @deprecated backend cũ */
  profileMetadata?: ReservationFormMetaItem[];
};

export type ReservationFormListResponse = {
  message: string;
  body: ReservationFormItem[];
};

function mapReservationFormItem(raw: ReservationFormItemApi): ReservationFormItem {
  const profileMetaData = Array.isArray(raw.profileMetaData)
    ? raw.profileMetaData
    : Array.isArray(raw.profileMetadata)
      ? raw.profileMetadata
      : [];
  return {
    ...raw,
    profileMetaData,
    transcriptImages: Array.isArray(raw.transcriptImages) ? raw.transcriptImages : [],
  };
}

export async function fetchParentDocumentCatalog(): Promise<ParentDocumentCatalogResponse> {
  return apiRequest<ParentDocumentCatalogResponse>('/api/v1/parent/documents', { method: 'GET' });
}

export async function fetchParentDocuments(
  admissionCampaignId: number
): Promise<ParentDocumentsResponse> {
  const query = `admissionCampaignId=${encodeURIComponent(String(admissionCampaignId))}`;
  return apiRequest<ParentDocumentsResponse>(`/api/v1/parent/documents?${query}`, { method: 'GET' });
}

export async function submitAdmissionReservationForm(
  payload: ReservationSubmissionPayload
): Promise<ReservationSubmissionResponse> {
  return apiRequest<ReservationSubmissionResponse>('/api/v1/parent/admission/reservation/form', {
    method: 'POST',
    body: payload,
  });
}

export async function submitBulkAdmissionReservation(
  payload: BulkReservationSubmissionPayload
): Promise<ReservationSubmissionResponse> {
  return apiRequest<ReservationSubmissionResponse>('/api/v1/parent/admission/reservation/form', {
    method: 'POST',
    body: payload,
  });
}

export async function checkSchoolsAdmissionAvailability(
  studentProfileId: number,
  schoolIds: number[]
): Promise<SchoolAvailabilityResponse> {
  const query = `studentProfileId=${encodeURIComponent(String(studentProfileId))}`;
  return apiRequest<SchoolAvailabilityResponse>(
    `/api/v1/parent/admission/schools/availability?${query}`,
    { method: 'PUT', body: schoolIds }
  );
}

/** GET /api/v1/parent/admission/reservation/form?status= */
export async function fetchAdmissionReservationForms(
  status?: ReservationFormStatus | 'ALL'
): Promise<ReservationFormListResponse> {
  const query = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
  const res = await apiRequest<{ message: string; body: ReservationFormItemApi[] }>(
    `/api/v1/parent/admission/reservation/form${query}`,
    { method: 'GET' }
  );
  const body = Array.isArray(res.body) ? res.body.map(mapReservationFormItem) : [];
  return { message: res.message, body };
}

export type ReservationTemplateMetaItem = {
  key: string;
  imageUrl: string[];
};

export type ReservationTemplateTranscriptImage = {
  grade: string;
  imageUrl: string | null;
};

export type ReservationTemplate = {
  id: number;
  studentProfileId: number;
  parentProfileId?: number;
  studentName: string;
  studentCode?: string | null;
  gender?: string | null;
  identityCard?: string | null;
  address?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
  profileMetaData: ReservationTemplateMetaItem[];
  transcriptImages?: ReservationTemplateTranscriptImage[];
  isApplied?: boolean;
  createdTime?: string | null;
  updatedTime?: string | null;
};

export type ReservationTemplateResponse = {
  message: string;
  body: ReservationTemplate | null;
};

export type ReservationTemplatePayload = {
  submissionDocuments: Array<{
    imageUrl: string[];
    key: string;
  }>;
  studentProfileId: number;
};

/** GET /api/v1/parent/admission/reservation/form/template?studentProfileId= */
export async function fetchReservationFormTemplate(
  studentProfileId: number
): Promise<ReservationTemplateResponse> {
  const query = `?studentProfileId=${encodeURIComponent(String(studentProfileId))}`;
  return apiRequest<ReservationTemplateResponse>(
    `/api/v1/parent/admission/reservation/form/template${query}`,
    { method: 'GET' }
  );
}

export async function saveReservationFormTemplate(
  payload: ReservationTemplatePayload
): Promise<ReservationTemplateResponse> {
  return apiRequest<ReservationTemplateResponse>('/api/v1/parent/admission/reservation/form/template', {
    method: 'POST',
    body: payload,
  });
}
