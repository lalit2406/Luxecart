import crypto from 'crypto';
import Order from '../modules/orders/order.model.js';

/**
 * Generate collision-safe human-readable order number (e.g. LC-20260830-109283)
 * @returns {Promise<string>}
 */
export const generateOrderNumber = async () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

  let orderNumber;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    orderNumber = `LC-${dateStr}-${randomHex}`;
    
    const existing = await Order.findOne({ orderNumber }).select('_id').lean();
    if (!existing) {
      exists = false;
    }
    attempts++;
  }

  if (exists) {
    // High collision fallback with timestamp suffix
    const nanoSuffix = Date.now().toString().slice(-6);
    orderNumber = `LC-${dateStr}-${nanoSuffix}`;
  }

  return orderNumber;
};
