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
    return 'payment_method required: cash, bank_transfer, momo, vnpay';
  }
  if (!PAYMENT_METHODS.includes(v)) {
    return 'payment_method must be one of: cash, bank_transfer, momo, vnpay';
  }
  return null;
}
