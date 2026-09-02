import mongoose from 'mongoose';

const FORBIDDEN_FIELDS = [
  'price',
  'mrp',
  'subtotal',
  'tax',
  'shipping',
  'grandTotal',
  'stock',
  'reserved',
  'userId',
  '_id',
  'id',
  'paymentAmount',
  'paymentStatus',
  'paid',
  'transactionId',
  'orderStatus',
  'discount',
  'totalSavings',
];

/**
 * Validate checkout preparation payload
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: { addressId?: string } }}
 */
export const validatePrepareCheckout = (body = {}) => {
  const errors = [];
  const sanitized = {};

  // Check forbidden injected fields
  for (const field of FORBIDDEN_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' is not permitted in checkout payload`);
    }
  }

  // Optional addressId validation
  if (body.addressId !== undefined && body.addressId !== null && body.addressId !== '') {
    if (typeof body.addressId !== 'string' || !mongoose.Types.ObjectId.isValid(body.addressId)) {
      errors.push('Invalid address ID format');
    } else {
      sanitized.addressId = body.addressId.trim();
    }
  }

  // Optional couponCode validation
  if (body.couponCode !== undefined && body.couponCode !== null && body.couponCode !== '') {
    if (typeof body.couponCode !== 'string') {
      errors.push('Coupon code must be a string');
    } else {
      sanitized.couponCode = body.couponCode.trim().toUpperCase();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};
