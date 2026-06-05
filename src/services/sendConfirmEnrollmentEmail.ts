import type { ReservationFormItem } from '../api/admissionReservation';

const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

const SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID?.trim() ?? '';
const PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY?.trim() ?? '';
const PRIVATE_KEY = process.env.EXPO_PUBLIC_EMAILJS_PRIVATE_KEY?.trim() ?? '';
const CONFIRM_ENROLLMENT_TEMPLATE_ID =
  process.env.EXPO_PUBLIC_EMAILJS_CONFIRM_ENROLLMENT_TEMPLATE_ID?.trim() ?? '';

export type ConfirmEnrollmentEmailParams = {
  parentEmail: string;
  studentName: string;
  studentCode: string;
  schoolName: string;
  programName: string;
  confirmCode: string;
};

function dash(value: string): string {
  const t = value.trim();
  return t || '—';
}

/** Lấy mã xác nhận từ response BE (khớp cấu trúc web: data.data.confirmCode, …). */
export function extractConfirmCodeFromResponse(
  res: unknown,
  fallback?: string | null
): string {
  if (!res || typeof res !== 'object') {
    const fb = (fallback ?? '').trim();
    return fb || 'N/A';
  }

  const root = res as Record<string, unknown>;
  const read = (obj: unknown): string | undefined => {
    if (!obj || typeof obj !== 'object') return undefined;
    const code = (obj as Record<string, unknown>).confirmCode;
    return typeof code === 'string' && code.trim() ? code.trim() : undefined;
  };

  const body = root.body;
  const data = root.data;

  const code =
    read(body) ??
    read(data) ??
    (data && typeof data === 'object' ? read((data as Record<string, unknown>).data) : undefined) ??
    read(root);

  if (code) return code;
  const fb = (fallback ?? '').trim();
  return fb || 'N/A';
}

/**
 * Gửi email xác nhận nhập học cho phụ huynh sau khi parent confirm enrollment thành công.
 * Lỗi email không throw — không chặn flow chính.
 */
export async function sendConfirmEnrollmentEmail({
  parentEmail,
  studentName,
  studentCode,
  schoolName,
  programName,
  confirmCode,
}: ConfirmEnrollmentEmailParams): Promise<void> {
  if (!CONFIRM_ENROLLMENT_TEMPLATE_ID) {
    if (__DEV__) {
      console.warn(
        'Thiếu EXPO_PUBLIC_EMAILJS_CONFIRM_ENROLLMENT_TEMPLATE_ID — bỏ qua gửi email xác nhận nhập học.'
      );
    }
    return;
  }
  if (!SERVICE_ID || !PUBLIC_KEY || !PRIVATE_KEY) {
    if (__DEV__) {
      console.warn(
        'Thiếu EXPO_PUBLIC_EMAILJS_SERVICE_ID, EXPO_PUBLIC_EMAILJS_PUBLIC_KEY hoặc EXPO_PUBLIC_EMAILJS_PRIVATE_KEY — bỏ qua gửi email.'
      );
    }
    return;
  }

  const toEmail = (parentEmail || '').trim();
  if (!toEmail) {
    if (__DEV__) {
      console.warn('sendConfirmEnrollmentEmail: parentEmail rỗng — bỏ qua.');
    }
    return;
  }

  const templateParams: Record<string, string> = {
    to_email: toEmail,
    email: toEmail,
    user_email: toEmail,
    userEmail: toEmail,
    parentEmail: toEmail,
    studentName: dash(studentName),
    student_name: dash(studentName),
    studentCode: dash(studentCode),
    student_code: dash(studentCode),
    schoolName: dash(schoolName),
    school_name: dash(schoolName),
    programName: dash(programName),
    program_name: dash(programName),
    confirmCode: (confirmCode || '').trim() || 'N/A',
    confirm_code: (confirmCode || '').trim() || 'N/A',
  };

  try {
    const res = await fetch(EMAILJS_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: SERVICE_ID,
        template_id: CONFIRM_ENROLLMENT_TEMPLATE_ID,
        user_id: PUBLIC_KEY,
        accessToken: PRIVATE_KEY,
        template_params: templateParams,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('Send confirm enrollment email failed:', res.status, text);
      return;
    }
    if (__DEV__) {
      console.log('Send confirm enrollment email success:', text);
    }
  } catch (error) {
    console.error('Send confirm enrollment email failed:', error);
  }
}

/** Fire-and-forget: gửi email sau khi API confirm thành công. */
export function fireConfirmEnrollmentEmail(
  item: ReservationFormItem,
  confirmResponse: unknown,
  parentEmailFallback?: string | null
): void {
  const confirmCode = extractConfirmCodeFromResponse(confirmResponse, item.confirmCode);
  void sendConfirmEnrollmentEmail({
    parentEmail: (item.parentEmail ?? parentEmailFallback ?? '').trim(),
    studentName: item.studentName ?? '',
    studentCode: item.studentCode ?? '',
    schoolName: item.schoolName ?? '',
    programName: item.programName ?? '',
    confirmCode,
  });
}
