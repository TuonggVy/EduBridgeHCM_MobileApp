import { apiRequest } from './client';
import type {
  BookOfflineConsultationRequest,
  BookOfflineConsultationResponse,
  ParentConsultationSlot,
  ParentConsultationSlotsResponse,
} from '../types/consultation';

function normalizeSlot(slot: unknown): ParentConsultationSlot | null {
  if (!slot || typeof slot !== 'object') return null;
  const row = slot as Record<string, unknown>;
  if (
    typeof row.date !== 'string' ||
    typeof row.dayOfWeek !== 'string' ||
    typeof row.campusScheduleTemplateId !== 'number' ||
    typeof row.startTime !== 'string' ||
    typeof row.endTime !== 'string'
  ) {
    return null;
  }
  return {
    date: row.date,
    dayOfWeek: row.dayOfWeek,
    campusScheduleTemplateId: row.campusScheduleTemplateId,
    startTime: row.startTime,
    endTime: row.endTime,
    statusLabel: typeof row.statusLabel === 'string' ? row.statusLabel : '',
    status: typeof row.status === 'string' ? row.status : 'UPCOMING',
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
