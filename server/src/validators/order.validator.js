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
  'orderNumber',
  'orderStatus',
  'status',
  'paymentStatus',
  'paid',
  'transactionId',
  'paymentAmount',
  'discount',
  'totalSavings',
  'items',
  'productName',
  'sku',
  'pricing',
];

/**
 * Validate Cash on Delivery order creation payload
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: { addressId?: string, paymentMethod: string, idempotencyKey?: string } }}
 */
export const validateCreateOrder = (body = {}) => {
  const errors = [];
  const sanitized = {
    paymentMethod: 'CASH_ON_DELIVERY',
  };

  // Check forbidden injected fields
  for (const field of FORBIDDEN_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' is not permitted in order creation payload`);
    }
  }

  // 1. Address ID
  if (body.addressId !== undefined && body.addressId !== null && body.addressId !== '') {
    if (typeof body.addressId !== 'string' || !mongoose.Types.ObjectId.isValid(body.addressId)) {
      errors.push('Invalid address ID format');
    } else {
      sanitized.addressId = body.addressId.trim();
    }
  }

  // 2. Payment Method (Must be CASH_ON_DELIVERY)
  if (body.paymentMethod !== undefined) {
    if (typeof body.paymentMethod !== 'string' || body.paymentMethod.toUpperCase() !== 'CASH_ON_DELIVERY') {
      errors.push('Only CASH_ON_DELIVERY payment method is currently supported');
    } else {
      sanitized.paymentMethod = 'CASH_ON_DELIVERY';
    }
  }

  // 3. Idempotency Key (Optional)
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== null) {
    if (typeof body.idempotencyKey !== 'string') {
      errors.push('Idempotency key must be a string');
    } else {
      const trimmed = body.idempotencyKey.trim();
      if (trimmed.length > 100) {
        errors.push('Idempotency key cannot exceed 100 characters');
      } else if (trimmed.length > 0) {
        sanitized.idempotencyKey = trimmed;
      }
    }
  }

  // 4. Coupon Code (Optional)
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
