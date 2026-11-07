/**
 * Authoritative classification helper for demo vs non-demo orders.
 *
 * Invariants:
 * 1. An order is strictly non-demo if isDemo is explicitly false.
 * 2. An order is only a demo order if isDemo === true, or (for legacy test fixtures lacking isDemo)
 *    its order number strictly starts with DEMO- or TEST-.
 * 3. Ordinary prefixes like ORD-, LC-, or INVOICE- are NEVER classified as demo.
 *
 * @param {object} order
 * @returns {boolean}
 */
export const isDemoOrder = (order) => {
  if (!order || typeof order !== 'object') return false;

  // 1. Strict precedence: if explicitly marked false, it is NEVER a demo order
  if (order.isDemo === false) return false;

  // 2. Explicit true is authoritative
  if (order.isDemo === true) return true;

  // 3. Fallback strictly for test fixtures or unmigrated mock objects lacking isDemo
  if (typeof order.orderNumber === 'string') {
    const num = order.orderNumber.toUpperCase();
    return num.startsWith('DEMO-') || num.startsWith('TEST-');
  }

  return false;
};
