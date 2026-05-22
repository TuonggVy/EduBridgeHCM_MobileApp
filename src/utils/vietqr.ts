import type { QrCodeBankInfo } from '../api/reservationPayment';

type VietQrParams = {
  bankInfo: QrCodeBankInfo;
  amount: number;
  transferContent?: string | null;
};

/** Tạo URL ảnh QR VietQR (img.vietqr.io) từ thông tin ngân hàng. */
export function buildVietQrImageUrl({ bankInfo, amount, transferContent }: VietQrParams): string {
  const bankId = bankInfo.bankId.trim();
  const accountNo = bankInfo.accountNo.trim();
  const base = `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(accountNo)}-compact2.jpg`;
  const params = new URLSearchParams();
  if (amount > 0) params.set('amount', String(Math.round(amount)));
  const content = transferContent?.trim();
  if (content) params.set('addInfo', content);
  const accountName = bankInfo.accountName?.trim();
  if (accountName) params.set('accountName', accountName);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} VNĐ`;
}
