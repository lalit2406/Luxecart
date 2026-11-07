/**
 * LuxeCart Authoritative Shipping Constants
 * Defines fallback shipping fees, units, and shipping calculation logic.
 */

// Flat fallback shipping fee per order in minor currency units (paise) = ₹200
export const SHIPPING_FEE_PAISE = 20000;

// Flat fallback shipping fee in major currency units (Rupees), derived from paise
export const SHIPPING_FEE_RUPEES = SHIPPING_FEE_PAISE / 100;

/**
 * Calculates shipping fee in paise based on order subtotal and dynamic store settings.
 *
 * @param {number} subtotalPaise - Order subtotal in paise before coupons
 * @param {object} [shippingConfig] - Dynamic shipping configuration from StoreSettings
 * @returns {number} Shipping fee in paise
 */
export function calculateShippingFeePaise(subtotalPaise, shippingConfig = {}) {
  const standardFee =
    Number.isInteger(shippingConfig?.standardFeePaise) && shippingConfig.standardFeePaise >= 0
      ? shippingConfig.standardFeePaise
      : SHIPPING_FEE_PAISE;

  if (shippingConfig?.enableFreeShippingThreshold) {
    const threshold =
      Number.isInteger(shippingConfig?.freeShippingThresholdPaise) &&
      shippingConfig.freeShippingThresholdPaise >= 0
        ? shippingConfig.freeShippingThresholdPaise
        : 500000;

    if (subtotalPaise >= threshold) {
      return 0;
    }
  }

  return standardFee;
}
