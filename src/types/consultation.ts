export type ParentConsultationSlotStatus = 'PAST' | 'UPCOMING' | string;

export type ConsultationOfflineRequestStatus =
  | 'CONSULTATION_PENDING'
  | 'CONSULTATION_CONFIRMED'
  | 'CONSULTATION_APPROVED'
  | 'CONSULTATION_REJECTED'
  | 'CONSULTATION_CANCELLED'
  | 'CONSULTATION_COMPLETED'
  | 'CONSULTATION_NO_SHOW'
  | string;

export type ConsultationOfflineRequestSummary = {
  id: number;
  status: ConsultationOfflineRequestStatus;
};

/** Nhãn tiếng Việt cho `consultationOfflineRequest.status` (API). */
export const OFFLINE_CONSULT_REQUEST_STATUS_LABEL: Record<string, string> = {
  CONSULTATION_PENDING: 'Chờ tư vấn',
  CONSULTATION_CONFIRMED: 'Đã xác nhận',
  CONSULTATION_APPROVED: 'Đã duyệt',
  CONSULTATION_REJECTED: 'Không được duyệt',
  CONSULTATION_CANCELLED: 'Đã hủy',
  CONSULTATION_COMPLETED: 'Đã hoàn thành',
  CONSULTATION_NO_SHOW: 'Không đến',
};

export function offlineConsultRequestStatusVi(status: string): string {
  const key = status.trim().toUpperCase();
  return OFFLINE_CONSULT_REQUEST_STATUS_LABEL[key] ?? status;
}

export type ParentConsultationSlot = {
  date: string;
  dayOfWeek: string;
  campusScheduleTemplateId: number;
  admissionCampaignId: number;
  startTime: string;
  endTime: string;
  statusLabel: string;
  status: ParentConsultationSlotStatus;
  /** Yêu cầu tư vấn offline đã gắn với slot (nếu có). */
  consultationOfflineRequest: ConsultationOfflineRequestSummary | null;
  maxBookingPerSlot: number;
  allowBookingBeforeHours: number;
  totalRequests: number;
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
  const max = slot.maxBookingPerSlot ?? 0;
  const used = slot.totalRequests ?? 0;
  if (max > 0 && used >= max) return false;
  return true;
}

/** Trong danh sách slot cùng một ngày đã có lịch của phụ huynh (theo API). */
export function parentConsultationDayHasUserBooking(slots: ParentConsultationSlot[]): boolean {
  return slots.some((s) => s.consultationOfflineRequest != null);
}

/**
 * Slot có thể nhấn để chọn trên UI.
 * Nếu đã đặt một slot trong ngày, chỉ slot có `consultationOfflineRequest` là nhấn được (xem lịch đã đặt); các slot khác bị khóa.
 */
export function isParentConsultationSlotPressable(
  slot: ParentConsultationSlot,
  sameDaySlots: ParentConsultationSlot[]
): boolean {
  if (parentConsultationDayHasUserBooking(sameDaySlots)) {
    return slot.consultationOfflineRequest != null;
  }
  return isParentConsultationSlotSelectable(slot);
}

/** Slot dùng được cho luồng đặt lịch mới (mở form / POST). */
export function isParentConsultationSlotBookable(
  slot: ParentConsultationSlot,
  sameDaySlots: ParentConsultationSlot[]
): boolean {
  if (slot.consultationOfflineRequest != null) return false;
  if (parentConsultationDayHasUserBooking(sameDaySlots)) return false;
  return isParentConsultationSlotSelectable(slot);
}

/** Dòng trạng thái dưới khung giờ: “Còn n chỗ” / “Đã hết chỗ” thay cho nhãn kiểu “Sắp diễn ra”. */
export function parentConsultationSlotDisplayLine(slot: ParentConsultationSlot): string {
  if (slot.consultationOfflineRequest != null) {
    return offlineConsultRequestStatusVi(slot.consultationOfflineRequest.status);
  }
  const s = String(slot.status).toUpperCase();
  if (s === 'PAST') return slot.statusLabel?.trim() || 'Đã qua';
  if (s === 'CANCELLED') return slot.statusLabel?.trim() || 'Đã hủy';
  const max = Math.max(0, slot.maxBookingPerSlot ?? 0);
  const used = Math.max(0, slot.totalRequests ?? 0);
  if (max <= 0) return slot.statusLabel?.trim() || s;
  const remaining = Math.max(0, max - used);
  if (remaining === 0) return 'Đã hết chỗ';
  return `Còn ${remaining} chỗ`;
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
