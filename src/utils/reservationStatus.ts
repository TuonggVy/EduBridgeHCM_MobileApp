export type ReservationFormStatus =
  | 'RESERVATION_PENDING'
  | 'RESERVATION_APPROVAL'
  | 'RESERVATION_PAYMENT_PENDING'
  | 'RESERVATION_PAYMENT_REJECTED'
  | 'RESERVATION_DEPOSITED'
  | 'RESERVATION_DEPOSIT_EXPIRED'
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_GHOST'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_REJECTED'
  /** @deprecated backend cũ */
  | 'RESERVATION_APPROVED';

export type ReservationStatusUi = {
  label: string;
  icon: string;
  colors: readonly [string, string];
  text: string;
};

const STATUS_LABELS: Record<string, string> = {
  RESERVATION_PENDING: 'Chờ trường duyệt',
  RESERVATION_APPROVAL: 'Chờ thanh toán',
  RESERVATION_PAYMENT_PENDING: 'Chờ xác nhận thanh toán',
  RESERVATION_PAYMENT_REJECTED: 'Minh chứng bị từ chối',
  RESERVATION_DEPOSITED: 'Đã đặt cọc',
  RESERVATION_DEPOSIT_EXPIRED: 'Hết hạn đặt cọc',
  RESERVATION_CONFIRMED: 'Xác nhận nhập học',
  RESERVATION_GHOST: 'Hồ sơ không còn hiệu lực',
  RESERVATION_CANCELLED: 'Đã huỷ',
  RESERVATION_REJECTED: 'Trường từ chối',
  RESERVATION_APPROVED: 'Đã đặt cọc',
};

export function reservationStatusLabel(status?: string | null): string {
  const key = status?.trim();
  if (!key) return 'Không rõ';
  return STATUS_LABELS[key] ?? key;
}

export function reservationStatusUi(status: string): ReservationStatusUi {
  switch (status) {
    case 'RESERVATION_PENDING':
      return {
        label: STATUS_LABELS.RESERVATION_PENDING,
        icon: 'schedule',
        colors: ['#fff7ed', '#ffedd5'],
        text: '#c2410c',
      };
    case 'RESERVATION_APPROVAL':
      return {
        label: STATUS_LABELS.RESERVATION_APPROVAL,
        icon: 'payments',
        colors: ['#eff6ff', '#dbeafe'],
        text: '#1d4ed8',
      };
    case 'RESERVATION_PAYMENT_PENDING':
      return {
        label: STATUS_LABELS.RESERVATION_PAYMENT_PENDING,
        icon: 'hourglass-top',
        colors: ['#eff6ff', '#dbeafe'],
        text: '#1d4ed8',
      };
    case 'RESERVATION_PAYMENT_REJECTED':
      return {
        label: STATUS_LABELS.RESERVATION_PAYMENT_REJECTED,
        icon: 'error-outline',
        colors: ['#fff7ed', '#ffedd5'],
        text: '#c2410c',
      };
    case 'RESERVATION_DEPOSITED':
    case 'RESERVATION_APPROVED':
      return {
        label: STATUS_LABELS.RESERVATION_DEPOSITED,
        icon: 'check-circle',
        colors: ['#ecfdf5', '#dcfce7'],
        text: '#15803d',
      };
    case 'RESERVATION_DEPOSIT_EXPIRED':
      return {
        label: STATUS_LABELS.RESERVATION_DEPOSIT_EXPIRED,
        icon: 'timer-off',
        colors: ['#fef3c7', '#fde68a'],
        text: '#b45309',
      };
    case 'RESERVATION_CONFIRMED':
      return {
        label: STATUS_LABELS.RESERVATION_CONFIRMED,
        icon: 'verified',
        colors: ['#ecfdf5', '#bbf7d0'],
        text: '#15803d',
      };
    case 'RESERVATION_GHOST':
      return {
        label: STATUS_LABELS.RESERVATION_GHOST,
        icon: 'visibility-off',
        colors: ['#f8fafc', '#e2e8f0'],
        text: '#64748b',
      };
    case 'RESERVATION_REJECTED':
      return {
        label: STATUS_LABELS.RESERVATION_REJECTED,
        icon: 'cancel',
        colors: ['#fff1f2', '#ffe4e6'],
        text: '#be123c',
      };
    case 'RESERVATION_CANCELLED':
      return {
        label: STATUS_LABELS.RESERVATION_CANCELLED,
        icon: 'block',
        colors: ['#f8fafc', '#e2e8f0'],
        text: '#475569',
      };
    default:
      return {
        label: reservationStatusLabel(status),
        icon: 'help-outline',
        colors: ['#f8fafc', '#e2e8f0'],
        text: '#475569',
      };
  }
}

export const MAX_PAYMENT_RESUBMIT_ATTEMPTS = 3;

export function getPaymentResubmitCount(item?: { paymentResubmitCount?: number | null } | null): number {
  const count = item?.paymentResubmitCount;
  if (typeof count !== 'number' || !Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}

export function remainingPaymentResubmits(item?: { paymentResubmitCount?: number | null } | null): number {
  return Math.max(0, MAX_PAYMENT_RESUBMIT_ATTEMPTS - getPaymentResubmitCount(item));
}

/** Trạng thái cho phép PH nộp / nộp lại phí giữ chỗ */
export function canSubmitReservationPayment(
  item?: { status?: string | null; paymentResubmitCount?: number | null } | null
): boolean {
  const status = item?.status;
  if (status === 'RESERVATION_APPROVAL') return true;
  if (status === 'RESERVATION_PAYMENT_REJECTED') {
    return getPaymentResubmitCount(item) < MAX_PAYMENT_RESUBMIT_ATTEMPTS;
  }
  return false;
}

export function isReservationPaymentAgain(status?: string | null): boolean {
  return status === 'RESERVATION_PAYMENT_REJECTED';
}

export function canConfirmReservationEnrollment(status?: string | null): boolean {
  return status === 'RESERVATION_DEPOSITED';
}

export function shouldHideRejectReason(status?: string | null): boolean {
  return status === 'RESERVATION_DEPOSITED' || status === 'RESERVATION_CONFIRMED';
}

export function reservationDisplayReason(item?: {
  status?: string | null;
  rejectReason?: string | null;
  cancelReason?: string | null;
} | null): string | null {
  if (!item) return null;
  const cancel = item.cancelReason?.trim();
  if (shouldHideRejectReason(item.status)) {
    return cancel || null;
  }
  return item.rejectReason?.trim() || cancel || null;
}

export function reservationReasonTitle(status?: string | null): string {
  switch (status) {
    case 'RESERVATION_CANCELLED':
      return 'Lý do huỷ';
    case 'RESERVATION_REJECTED':
      return 'Lý do từ chối';
    case 'RESERVATION_PAYMENT_REJECTED':
      return 'Lý do từ chối minh chứng';
    default:
      return 'Ghi chú';
  }
}
