import { apiRequest } from './client';
import type {
  BookOfflineConsultationRequest,
  BookOfflineConsultationResponse,
  ConsultationOfflineRequestSummary,
  ParentConsultationSlot,
  ParentConsultationSlotsResponse,
  ParentOfflineConsultationItem,
  ParentOfflineConsultationListBody,
  ParentOfflineConsultationListResponse,
} from '../types/consultation';

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeConsultationOfflineRequest(raw: unknown): ConsultationOfflineRequestSummary | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = asNumber(o.id);
  const status = typeof o.status === 'string' ? o.status.trim() : '';
  if (status === '') return null;
  return {
    id: id ?? 0,
    status,
  };
}

function normalizeSlot(slot: unknown): ParentConsultationSlot | null {
  if (!slot || typeof slot !== 'object') return null;
  const row = slot as Record<string, unknown>;
  const templateId = asNumber(row.campusScheduleTemplateId);
  const campaignId = asNumber(row.admissionCampaignId);
  if (
    typeof row.date !== 'string' ||
    typeof row.dayOfWeek !== 'string' ||
    templateId == null ||
    typeof row.startTime !== 'string' ||
    typeof row.endTime !== 'string'
  ) {
    return null;
  }
  const maxBooking = asNumber(row.maxBookingPerSlot);
  const totalReq = asNumber(row.totalRequests);
  const allowBefore = asNumber(row.allowBookingBeforeHours);
  return {
    date: row.date,
    dayOfWeek: row.dayOfWeek,
    campusScheduleTemplateId: templateId,
    admissionCampaignId: campaignId ?? 0,
    startTime: row.startTime,
    endTime: row.endTime,
    statusLabel: typeof row.statusLabel === 'string' ? row.statusLabel : '',
    status: typeof row.status === 'string' ? row.status : 'UPCOMING',
    consultationOfflineRequest: normalizeConsultationOfflineRequest(row.consultationOfflineRequest),
    maxBookingPerSlot: maxBooking != null && maxBooking > 0 ? maxBooking : 1,
    allowBookingBeforeHours: allowBefore != null && allowBefore >= 0 ? allowBefore : 0,
    totalRequests: totalReq != null && totalReq >= 0 ? totalReq : 0,
  };
}

export async function fetchParentConsultationSlots(
  campusId: number,
  startDate: string,
  endDate: string
): Promise<ParentConsultationSlotsResponse> {
  const query = `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  const response = await apiRequest<{ message: string; body: unknown }>(
    `/api/v1/parent/slots/${encodeURIComponent(String(campusId))}?${query}`,
    { method: 'GET' }
  );
  const body = Array.isArray(response.body)
    ? response.body
        .map((row) => normalizeSlot(row))
        .filter((row): row is ParentConsultationSlot => row != null)
    : [];
  return { message: response.message, body };
}

export async function bookOfflineConsultation(
  payload: BookOfflineConsultationRequest
): Promise<BookOfflineConsultationResponse> {
  return apiRequest<BookOfflineConsultationResponse>('/api/v1/parent/book/consultation/offline', {
    method: 'POST',
    body: payload,
  });
}

function normalizeOfflineItem(row: unknown): ParentOfflineConsultationItem | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  const id = asNumber(o.id);
  if (id == null) return null;
  if (typeof o.appointmentDate !== 'string' || typeof o.appointmentTime !== 'string') return null;
  return {
    id,
    question: typeof o.question === 'string' ? o.question : '',
    appointmentTime: o.appointmentTime,
    appointmentDate: o.appointmentDate,
    phone: typeof o.phone === 'string' ? o.phone : '',
    status: typeof o.status === 'string' ? o.status : 'pending',
  };
}

function normalizeOfflineListBody(raw: unknown): ParentOfflineConsultationListBody {
  if (!raw || typeof raw !== 'object') {
    return {
      items: [],
      currentPage: 0,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    };
  }
  const b = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(b.items) ? b.items : [];
  const items = itemsRaw.map((row) => normalizeOfflineItem(row)).filter((x): x is ParentOfflineConsultationItem => x != null);
  return {
    items,
    currentPage: asNumber(b.currentPage) ?? 0,
    pageSize: asNumber(b.pageSize) ?? 10,
    totalItems: asNumber(b.totalItems) ?? 0,
    totalPages: asNumber(b.totalPages) ?? 0,
    hasNext: Boolean(b.hasNext),
    hasPrevious: Boolean(b.hasPrevious),
  };
}

export type FetchParentOfflineConsultationsParams = {
  status?: string | null;
  page: number;
  pageSize: number;
};

export async function fetchParentOfflineConsultations(
  params: FetchParentOfflineConsultationsParams
): Promise<ParentOfflineConsultationListResponse> {
  const q = new URLSearchParams();
  q.set('page', String(params.page));
  q.set('pageSize', String(params.pageSize));
  if (params.status != null && params.status !== '') {
    q.set('status', params.status);
  }
  const response = await apiRequest<{ message: string; body: unknown }>(
    `/api/v1/parent/consultation/offline?${q.toString()}`,
    { method: 'GET' }
  );
  return {
    message: response.message,
    body: normalizeOfflineListBody(response.body),
  };
}
