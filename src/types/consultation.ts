export type ParentConsultationSlotStatus = 'PAST' | 'UPCOMING' | string;

export type ParentConsultationSlot = {
  date: string;
  dayOfWeek: string;
  campusScheduleTemplateId: number;
  admissionCampaignId: number;
  startTime: string;
  endTime: string;
  statusLabel: string;
  status: ParentConsultationSlotStatus;
};

export type ParentConsultationSlotsResponse = {
  message: string;
  body: ParentConsultationSlot[];
};

export type BookOfflineConsultationRequest = {
  phone: string;
  question: string;
  appointmentTime: string;
  appointmentDate: string;
  campusId: number;
};

export type BookOfflineConsultationResponse = {
  message: string;
  body: unknown;
};

export type ParentOfflineConsultationStatus =
  | 'pending'
  | 'confirmed'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'no-show'
  | string;

export type ParentOfflineConsultationItem = {
  id: number;
  question: string;
  appointmentTime: string;
  appointmentDate: string;
  phone: string;
  status: ParentOfflineConsultationStatus;
};

export type ParentOfflineConsultationListBody = {
  items: ParentOfflineConsultationItem[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type ParentOfflineConsultationListResponse = {
  message: string;
  body: ParentOfflineConsultationListBody;
};

/** Slot có thể chọn để đặt lịch (không quá hạn / đầy / hủy). */
export function isParentConsultationSlotSelectable(slot: ParentConsultationSlot): boolean {
  const s = String(slot.status).toUpperCase();
  if (s === 'PAST' || s === 'FULL' || s === 'CANCELLED') return false;
  return true;
}

const OFFLINE_STATUS_VI: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  'in-progress': 'Đang diễn ra',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  'no-show': 'Không đến',
};

export function parentOfflineConsultationStatusVi(status: string): string {
  const key = status.trim().toLowerCase();
  return OFFLINE_STATUS_VI[key] ?? status;
}

export const PARENT_OFFLINE_CONSULTATION_STATUS_FILTERS: {
  param: ParentOfflineConsultationStatus | null;
  label: string;
}[] = [
  { param: null, label: 'Tất cả' },
  { param: 'pending', label: 'Chờ xác nhận' },
  { param: 'confirmed', label: 'Đã xác nhận' },
  { param: 'in-progress', label: 'Đang diễn ra' },
  { param: 'completed', label: 'Hoàn thành' },
  { param: 'cancelled', label: 'Đã hủy' },
  { param: 'no-show', label: 'Không đến' },
];
