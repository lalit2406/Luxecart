/**
 * LuxeCart Client Shipping Calculation Helpers
 * Matches authoritative backend calculation in server/src/constants/shipping.constants.js
 */

/**
 * Calculates estimated shipping fee in Rupees for display and guest cart summary.
 * Evaluates against merchandise subtotal before coupon discounts.
 *
 * @param {number} subtotalRupees - Cart merchandise subtotal in Rupees
 * @param {object} [shippingConfig] - Dynamic shipping configuration from StoreSettings
 * @param {number} [itemCount=0] - Number of items in cart
 * @returns {number} Estimated shipping fee in Rupees
 */
export function calculateEstimatedShippingRupees(subtotalRupees, shippingConfig = {}, itemCount = 0) {
  if (itemCount === 0 || !subtotalRupees || subtotalRupees <= 0) {
    return 0;
  }

  const standardFeeRupees =
    typeof shippingConfig?.standardFeeRupees === 'number' && shippingConfig.standardFeeRupees >= 0
      ? shippingConfig.standardFeeRupees
      : typeof shippingConfig?.standardFeePaise === 'number' && shippingConfig.standardFeePaise >= 0
        ? shippingConfig.standardFeePaise / 100
        : 200;

  if (shippingConfig?.enableFreeShippingThreshold) {
    const thresholdRupees =
      typeof shippingConfig?.freeShippingThresholdRupees === 'number' &&
      shippingConfig.freeShippingThresholdRupees >= 0
        ? shippingConfig.freeShippingThresholdRupees
        : typeof shippingConfig?.freeShippingThresholdPaise === 'number' &&
            shippingConfig.freeShippingThresholdPaise >= 0
          ? shippingConfig.freeShippingThresholdPaise / 100
          : 5000;

    if (subtotalRupees >= thresholdRupees) {
      return 0;
    }
  }

  return standardFeeRupees;
}

/**
 * Resolves free shipping progress details.
 *
 * @param {number} subtotalRupees
 * @param {object} [shippingConfig]
 * @returns {{ isEnabled: boolean, thresholdRupees: number, qualifies: boolean, remainingRupees: number, percent: number }}
 */
export function getFreeShippingProgress(subtotalRupees, shippingConfig = {}) {
  const isEnabled = Boolean(shippingConfig?.enableFreeShippingThreshold);

  if (!isEnabled) {
    return {
      isEnabled: false,
      thresholdRupees: 0,
      qualifies: false,
      remainingRupees: 0,
      percent: 0,
    };
  }

  const thresholdRupees =
    typeof shippingConfig?.freeShippingThresholdRupees === 'number' &&
    shippingConfig.freeShippingThresholdRupees >= 0
      ? shippingConfig.freeShippingThresholdRupees
      : typeof shippingConfig?.freeShippingThresholdPaise === 'number' &&
          shippingConfig.freeShippingThresholdPaise >= 0
        ? shippingConfig.freeShippingThresholdPaise / 100
        : 5000;

  const currentSubtotal = Math.max(0, Number(subtotalRupees) || 0);
  const qualifies = currentSubtotal >= thresholdRupees;
  const remainingRupees = qualifies ? 0 : Math.max(0, thresholdRupees - currentSubtotal);
  const percent = thresholdRupees > 0 ? Math.min(100, Math.round((currentSubtotal / thresholdRupees) * 100)) : 100;

  return {
    isEnabled: true,
    thresholdRupees,
    qualifies,
    remainingRupees,
    percent,
  };
}
