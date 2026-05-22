import { apiRequest } from './client';

export type QrCodeBankInfo = {
  bankId: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};

export type QrCodeInfoBody = {
  bankInfo: QrCodeBankInfo;
  reservationFee: number;
};

export type QrCodeInfoResponse = {
  message: string;
  body: QrCodeInfoBody;
};

export type ProgramOfferingItem = {
  closeDate: string;
  unavailableReason: string | null;
  campusProgramOfferingId: number;
  programName: string;
  quota: number;
  admissionMethod: string;
  openDate: string;
  remainingQuota: number;
  canSubmit: boolean;
};

export type ProgramOfferingResponse = {
  message: string;
  body: ProgramOfferingItem[];
};

export type ReservationPaymentAction = 'payment' | 'payment-again';

export type ReservationPaymentPayload = {
  admissionFormId: number;
  action: ReservationPaymentAction;
  paymentUrl: string;
  campusProgramOfferingId: number;
};

export type ReservationPaymentResponse = {
  message: string;
  body: unknown;
};

/** GET /api/v1/parent/qrCodeInfo?admissionFormId= */
export async function fetchQrCodeInfo(admissionFormId: number): Promise<QrCodeInfoResponse> {
  const query = `?admissionFormId=${encodeURIComponent(String(admissionFormId))}`;
  return apiRequest<QrCodeInfoResponse>(`/api/v1/parent/qrCodeInfo${query}`, { method: 'GET' });
}

/** GET /api/v1/parent/programs/offering?admissionFormId= */
export async function fetchProgramOfferings(admissionFormId: number): Promise<ProgramOfferingResponse> {
  const query = `?admissionFormId=${encodeURIComponent(String(admissionFormId))}`;
  return apiRequest<ProgramOfferingResponse>(`/api/v1/parent/programs/offering${query}`, { method: 'GET' });
}

/** PUT /api/v1/parent/admission/reservation/form — xác nhận thanh toán phí giữ chỗ */
export async function submitReservationPayment(
  payload: ReservationPaymentPayload
): Promise<ReservationPaymentResponse> {
  return apiRequest<ReservationPaymentResponse>('/api/v1/parent/admission/reservation/form', {
    method: 'PUT',
    body: payload,
  });
}
