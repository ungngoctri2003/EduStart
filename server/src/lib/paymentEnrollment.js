export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'momo', 'vnpay'];

/** @param {unknown} v */
export function normalizePaymentNote(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, 2000);
}

/**
 * @param {unknown} v
 * @returns {string | null} error message or null if ok
 */
export function paymentMethodError(v) {
  if (v == null || typeof v !== 'string') {
    return 'Vui lòng chọn hình thức thanh toán: tiền mặt, chuyển khoản, MoMo hoặc VNPay.';
  }
  if (!PAYMENT_METHODS.includes(v)) {
    return 'Hình thức thanh toán không hợp lệ. Chọn một trong: tiền mặt, chuyển khoản, MoMo, VNPay.';
  }
  return null;
}
