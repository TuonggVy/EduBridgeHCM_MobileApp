import { apiRequest } from './client';

export type ReservationDocumentItem = {
  code: string;
  name: string;
  required: boolean;
};

export type ParentDocumentsResponse = {
  message: string;
  body: {
    required: ReservationDocumentItem[];
    optional: ReservationDocumentItem[];
  };
};

export type ReservationSubmissionPayload = {
  submissionDocuments: Array<{
    imageUrl: string[];
    key: string;
  }>;
  campusProgramOfferingId: number;
  studentProfileId: number;
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

export type ReservationFormItem = {
  id: number;
  schoolName: string | null;
  campusName: string | null;
  programName: string | null;
  studentName: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentEmail: string | null;
  gender: string | null;
  createdTime: string | null;
  updatedTime: string | null;
  status: ReservationFormStatus | string;
  rejectReason: string | null;
  cancelReason: string | null;
  verifiedBy: string | null;
  profileMetadata: Array<{
    key: string;
    imageUrl: string[];
  }>;
};

export type ReservationFormListResponse = {
  message: string;
  body: ReservationFormItem[];
};

export async function fetchParentDocuments(
  campusProgramOfferingId: number
): Promise<ParentDocumentsResponse> {
  const query = `campusProgramOfferingId=${encodeURIComponent(String(campusProgramOfferingId))}`;
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

export async function fetchAdmissionReservationForms(
  status?: ReservationFormStatus | 'ALL'
): Promise<ReservationFormListResponse> {
  const query = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<ReservationFormListResponse>(`/api/v1/parent/admission/reservation/form${query}`, {
    method: 'GET',
  });
}
