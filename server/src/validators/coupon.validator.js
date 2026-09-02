import mongoose from 'mongoose';

const PROHIBITED_FIELDS = [
  'usedCount',
  'userId',
  'discountAmount',
  'calculatedDiscount',
  'subtotal',
  'grandTotal',
  'pricing',
  'items',
  'inventory',
  '_id',
  'id',
  'createdAt',
  'updatedAt',
];

const ALLOWED_DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'];
const ALLOWED_SORT_FIELDS = ['createdAt', 'code', 'usedCount', 'expirationDate', 'discountValue'];
const ALLOWED_SORT_ORDERS = ['asc', 'desc'];

/**
 * Validate Admin Coupon Creation
 * @param {object} body
 */
export const validateCreateCoupon = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  // Reject prohibited injected fields
  for (const field of PROHIBITED_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be supplied by client`);
    }
  }

  // 1. Code (Required string, uppercase, 3-30 chars, alphanumeric + hyphens)
  if (!body.code || typeof body.code !== 'string' || body.code.trim() === '') {
    errors.push('Coupon code is required');
  } else {
    const trimmedCode = body.code.trim().toUpperCase();
    if (trimmedCode.length < 2 || trimmedCode.length > 30) {
      errors.push('Coupon code must be between 2 and 30 characters');
    } else if (!/^[A-Z0-9_-]+$/.test(trimmedCode)) {
      errors.push('Coupon code may only contain alphanumeric characters, underscores, and dashes');
    } else {
      sanitized.code = trimmedCode;
    }
  }

  // 2. Description (Optional string, max 250)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push('Description must be a string');
    } else {
      const trimmedDesc = body.description.trim();
      if (trimmedDesc.length > 250) {
        errors.push('Description cannot exceed 250 characters');
      } else {
        sanitized.description = trimmedDesc;
      }
    }
  } else {
    sanitized.description = '';
  }

  // 3. Discount Type (PERCENTAGE or FIXED)
  if (!body.discountType || !ALLOWED_DISCOUNT_TYPES.includes(String(body.discountType).trim().toUpperCase())) {
    errors.push(`Discount type must be one of: ${ALLOWED_DISCOUNT_TYPES.join(', ')}`);
  } else {
    sanitized.discountType = String(body.discountType).trim().toUpperCase();
  }

  // 4. Discount Value (Required Number)
  if (body.discountValue === undefined || body.discountValue === null) {
    errors.push('Discount value is required');
  } else {
    const val = Number(body.discountValue);
    if (isNaN(val) || val <= 0) {
      errors.push('Discount value must be a positive number');
    } else if (sanitized.discountType === 'PERCENTAGE' && (val < 1 || val > 100)) {
      errors.push('Percentage discount value must be between 1 and 100');
    } else {
      sanitized.discountValue = Math.round(val);
    }
  }

  // 5. Min Order Value (Optional Number in Paise)
  if (body.minOrderValue !== undefined && body.minOrderValue !== null) {
    const mov = Number(body.minOrderValue);
    if (isNaN(mov) || mov < 0) {
      errors.push('Minimum order value cannot be negative');
    } else {
      sanitized.minOrderValue = Math.round(mov);
    }
  } else {
    sanitized.minOrderValue = 0;
  }

  // 6. Max Discount Amount (Optional Number in Paise for PERCENTAGE)
  if (body.maxDiscountAmount !== undefined && body.maxDiscountAmount !== null && body.maxDiscountAmount !== '') {
    const maxD = Number(body.maxDiscountAmount);
    if (isNaN(maxD) || maxD <= 0) {
      errors.push('Maximum discount amount must be a positive number');
    } else {
      sanitized.maxDiscountAmount = Math.round(maxD);
    }
  } else {
    sanitized.maxDiscountAmount = null;
  }

  // 7. Start Date (Optional, default now)
  if (body.startDate !== undefined && body.startDate !== null && body.startDate !== '') {
    const sDate = new Date(body.startDate);
    if (isNaN(sDate.getTime())) {
      errors.push('Start date must be a valid ISO date');
    } else {
      sanitized.startDate = sDate;
    }
  } else {
    sanitized.startDate = new Date();
  }

  // 8. Expiration Date (Required, must be after start date)
  if (!body.expirationDate || body.expirationDate === '') {
    errors.push('Expiration date is required');
  } else {
    const eDate = new Date(body.expirationDate);
    if (isNaN(eDate.getTime())) {
      errors.push('Expiration date must be a valid ISO date');
    } else if (sanitized.startDate && eDate <= sanitized.startDate) {
      errors.push('Expiration date must be after the start date');
    } else {
      sanitized.expirationDate = eDate;
    }
  }

  // 9. Total Usage Limit (Optional integer)
  if (body.totalUsageLimit !== undefined && body.totalUsageLimit !== null && body.totalUsageLimit !== '') {
    const limit = Number(body.totalUsageLimit);
    if (isNaN(limit) || !Number.isInteger(limit) || limit < 1) {
      errors.push('Total usage limit must be a positive integer');
    } else {
      sanitized.totalUsageLimit = limit;
    }
  } else {
    sanitized.totalUsageLimit = null;
  }

  // 10. Per User Limit (Optional integer, default 1)
  if (body.perUserLimit !== undefined && body.perUserLimit !== null && body.perUserLimit !== '') {
    const uLimit = Number(body.perUserLimit);
    if (isNaN(uLimit) || !Number.isInteger(uLimit) || uLimit < 1) {
      errors.push('Per user limit must be a positive integer');
    } else {
      sanitized.perUserLimit = uLimit;
    }
  } else {
    sanitized.perUserLimit = 1;
  }

  // 11. Eligible Categories (Optional array of ObjectIds)
  if (body.eligibleCategories !== undefined && body.eligibleCategories !== null) {
    if (!Array.isArray(body.eligibleCategories)) {
      errors.push('Eligible categories must be an array of IDs');
    } else {
      const validIds = [];
      for (const id of body.eligibleCategories) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          errors.push(`Invalid category ID: ${id}`);
        } else {
          validIds.push(new mongoose.Types.ObjectId(id));
        }
      }
      sanitized.eligibleCategories = validIds;
    }
  } else {
    sanitized.eligibleCategories = [];
  }

  // 12. Eligible Products (Optional array of ObjectIds)
  if (body.eligibleProducts !== undefined && body.eligibleProducts !== null) {
    if (!Array.isArray(body.eligibleProducts)) {
      errors.push('Eligible products must be an array of IDs');
    } else {
      const validIds = [];
      for (const id of body.eligibleProducts) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          errors.push(`Invalid product ID: ${id}`);
        } else {
          validIds.push(new mongoose.Types.ObjectId(id));
        }
      }
      sanitized.eligibleProducts = validIds;
    }
  } else {
    sanitized.eligibleProducts = [];
  }

  // 13. Active Flag
  if (body.isActive !== undefined) {
    sanitized.isActive = Boolean(body.isActive);
  } else {
    sanitized.isActive = true;
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate Admin Coupon Update
 * @param {object} body
 */
export const validateUpdateCoupon = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  for (const field of PROHIBITED_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be updated directly`);
    }
  }

  let hasUpdates = false;

  // Code
  if (body.code !== undefined) {
    const trimmedCode = String(body.code).trim().toUpperCase();
    if (trimmedCode.length < 2 || trimmedCode.length > 30) {
      errors.push('Coupon code must be between 2 and 30 characters');
    } else if (!/^[A-Z0-9_-]+$/.test(trimmedCode)) {
      errors.push('Coupon code may only contain alphanumeric characters, underscores, and dashes');
    } else {
      sanitized.code = trimmedCode;
      hasUpdates = true;
    }
  }

  // Description
  if (body.description !== undefined) {
    const trimmedDesc = String(body.description || '').trim();
    if (trimmedDesc.length > 250) {
      errors.push('Description cannot exceed 250 characters');
    } else {
      sanitized.description = trimmedDesc;
      hasUpdates = true;
    }
  }

  // Discount Type
  if (body.discountType !== undefined) {
    const dt = String(body.discountType).trim().toUpperCase();
    if (!ALLOWED_DISCOUNT_TYPES.includes(dt)) {
      errors.push(`Discount type must be one of: ${ALLOWED_DISCOUNT_TYPES.join(', ')}`);
    } else {
      sanitized.discountType = dt;
      hasUpdates = true;
    }
  }

  // Discount Value
  if (body.discountValue !== undefined) {
    const val = Number(body.discountValue);
    if (isNaN(val) || val <= 0) {
      errors.push('Discount value must be a positive number');
    } else {
      sanitized.discountValue = Math.round(val);
      hasUpdates = true;
    }
  }

  // Min Order Value
  if (body.minOrderValue !== undefined) {
    const mov = Number(body.minOrderValue);
    if (isNaN(mov) || mov < 0) {
      errors.push('Minimum order value cannot be negative');
    } else {
      sanitized.minOrderValue = Math.round(mov);
      hasUpdates = true;
    }
  }

  // Max Discount Amount
  if (body.maxDiscountAmount !== undefined) {
    if (body.maxDiscountAmount === null || body.maxDiscountAmount === '') {
      sanitized.maxDiscountAmount = null;
      hasUpdates = true;
    } else {
      const maxD = Number(body.maxDiscountAmount);
      if (isNaN(maxD) || maxD <= 0) {
        errors.push('Maximum discount amount must be a positive number');
      } else {
        sanitized.maxDiscountAmount = Math.round(maxD);
        hasUpdates = true;
      }
    }
  }

  // Start Date
  if (body.startDate !== undefined) {
    const sDate = new Date(body.startDate);
    if (isNaN(sDate.getTime())) {
      errors.push('Start date must be a valid ISO date');
    } else {
      sanitized.startDate = sDate;
      hasUpdates = true;
    }
  }

  // Expiration Date
  if (body.expirationDate !== undefined) {
    const eDate = new Date(body.expirationDate);
    if (isNaN(eDate.getTime())) {
      errors.push('Expiration date must be a valid ISO date');
    } else {
      sanitized.expirationDate = eDate;
      hasUpdates = true;
    }
  }

  // Total Usage Limit
  if (body.totalUsageLimit !== undefined) {
    if (body.totalUsageLimit === null || body.totalUsageLimit === '') {
      sanitized.totalUsageLimit = null;
      hasUpdates = true;
    } else {
      const limit = Number(body.totalUsageLimit);
      if (isNaN(limit) || !Number.isInteger(limit) || limit < 1) {
        errors.push('Total usage limit must be a positive integer');
      } else {
        sanitized.totalUsageLimit = limit;
        hasUpdates = true;
      }
    }
  }

  // Per User Limit
  if (body.perUserLimit !== undefined) {
    const uLimit = Number(body.perUserLimit);
    if (isNaN(uLimit) || !Number.isInteger(uLimit) || uLimit < 1) {
      errors.push('Per user limit must be a positive integer');
    } else {
      sanitized.perUserLimit = uLimit;
      hasUpdates = true;
    }
  }

  // Eligible Categories
  if (body.eligibleCategories !== undefined) {
    if (!Array.isArray(body.eligibleCategories)) {
      errors.push('Eligible categories must be an array of IDs');
    } else {
      const validIds = [];
      for (const id of body.eligibleCategories) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          errors.push(`Invalid category ID: ${id}`);
        } else {
          validIds.push(new mongoose.Types.ObjectId(id));
        }
      }
      sanitized.eligibleCategories = validIds;
      hasUpdates = true;
    }
  }

  // Eligible Products
  if (body.eligibleProducts !== undefined) {
    if (!Array.isArray(body.eligibleProducts)) {
      errors.push('Eligible products must be an array of IDs');
    } else {
      const validIds = [];
      for (const id of body.eligibleProducts) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          errors.push(`Invalid product ID: ${id}`);
        } else {
          validIds.push(new mongoose.Types.ObjectId(id));
        }
      }
      sanitized.eligibleProducts = validIds;
      hasUpdates = true;
    }
  }

  // Active Flag
  if (body.isActive !== undefined) {
    sanitized.isActive = Boolean(body.isActive);
    hasUpdates = true;
  }

  if (!hasUpdates && errors.length === 0) {
    errors.push('At least one field must be provided for update');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate Customer Coupon Validation Request
 * @param {object} body
 */
export const validateCustomerValidateCoupon = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  // Reject injected fields
  for (const field of PROHIBITED_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be provided by customer`);
    }
  }

  if (!body.code || typeof body.code !== 'string' || body.code.trim() === '') {
    errors.push('Coupon code is required');
  } else {
    sanitized.code = body.code.trim().toUpperCase();
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate Admin Query Params
 * @param {object} query
 */
export const validateAdminCouponQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  if (query.page !== undefined) {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('Page must be a positive integer');
    } else {
      sanitized.page = pageNum;
    }
  }

  if (query.limit !== undefined) {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('Limit must be a positive integer between 1 and 100');
    } else {
      sanitized.limit = limitNum;
    }
  }

  if (query.status !== undefined && query.status !== '' && query.status !== 'ALL') {
    const statusUpper = String(query.status).trim().toUpperCase();
    if (!['ACTIVE', 'INACTIVE', 'EXPIRED'].includes(statusUpper)) {
      errors.push('Status filter must be ACTIVE, INACTIVE, EXPIRED, or ALL');
    } else {
      sanitized.status = statusUpper;
    }
  }

  if (query.search !== undefined && typeof query.search === 'string') {
    const trimmed = query.search.trim();
    if (trimmed.length > 0) {
      sanitized.search = trimmed;
    }
  }

  if (query.sortBy !== undefined && query.sortBy !== '') {
    const field = String(query.sortBy).trim();
    if (!ALLOWED_SORT_FIELDS.includes(field)) {
      errors.push(`Invalid sortBy. Allowed: ${ALLOWED_SORT_FIELDS.join(', ')}`);
    } else {
      sanitized.sortBy = field;
    }
  }

  if (query.sortOrder !== undefined && query.sortOrder !== '') {
    const order = String(query.sortOrder).trim().toLowerCase();
    if (!ALLOWED_SORT_ORDERS.includes(order)) {
      errors.push(`Invalid sortOrder. Allowed: ${ALLOWED_SORT_ORDERS.join(', ')}`);
    } else {
      sanitized.sortOrder = order;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate Admin Toggle Coupon Status
 * @param {object} body
 */
export const validateToggleCouponStatus = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  if (body.isActive === undefined || typeof body.isActive !== 'boolean') {
    errors.push('isActive boolean field is required');
  } else {
    sanitized.isActive = body.isActive;
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};
