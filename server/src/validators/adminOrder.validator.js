const ALLOWED_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'orderNumber'];
const ALLOWED_SORT_ORDERS = ['asc', 'desc'];
const ALLOWED_ORDER_TYPES = ['ALL', 'LIVE', 'DEMO'];

const PROHIBITED_STATUS_MUTATION_FIELDS = [
  'userId',
  'changedBy',
  'items',
  'pricing',
  'stock',
  'reserved',
  'payment',
  'paymentStatus',
  'shippingAddress',
  'orderNumber',
  '_id',
  'id',
];

const PROHIBITED_DEMO_ORDER_FIELDS = [
  'userId',
  '_id',
  'id',
  'isDemo',
  'stock',
  'reserved',
  'coupon',
  'couponCode',
  'couponDiscount',
  'discount',
  'transactionId',
  'paymentStatus',
  'paid',
];

const ALLOWED_DEMO_INITIAL_STATUSES = ['PROCESSING', 'PLACED', 'CONFIRMED'];

/**
 * Validate query parameters for admin order listing
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: { page: number, limit: number, status?: string, search?: string, sortBy: string, sortOrder: string, orderType: string } }}
 */
export const validateAdminOrderQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    orderType: 'ALL',
  };

  // 1. Pagination Page
  if (query.page !== undefined) {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('Page must be a positive integer');
    } else {
      sanitized.page = pageNum;
    }
  }

  // 2. Pagination Limit
  if (query.limit !== undefined) {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('Limit must be a positive integer between 1 and 100');
    } else {
      sanitized.limit = limitNum;
    }
  }

  // 3. Status Filter (Optional)
  if (query.status !== undefined && query.status !== '' && query.status !== 'ALL') {
    const upperStatus = String(query.status).trim().toUpperCase();
    if (!ALLOWED_STATUSES.includes(upperStatus)) {
      errors.push(`Invalid status filter. Allowed values: ${ALLOWED_STATUSES.join(', ')}`);
    } else {
      sanitized.status = upperStatus;
    }
  }

  // 4. Order Type Filter (Optional: ALL, LIVE, DEMO)
  if (query.orderType !== undefined && query.orderType !== '' && query.orderType !== 'ALL') {
    const upperType = String(query.orderType).trim().toUpperCase();
    if (!ALLOWED_ORDER_TYPES.includes(upperType)) {
      errors.push(`Invalid orderType filter. Allowed values: ${ALLOWED_ORDER_TYPES.join(', ')}`);
    } else {
      sanitized.orderType = upperType;
    }
  }

  // 5. Search Filter (Optional)
  if (query.search !== undefined && typeof query.search === 'string') {
    const trimmed = query.search.trim();
    if (trimmed.length > 0) {
      sanitized.search = trimmed;
    }
  }

  // 6. Sort By (Optional)
  if (query.sortBy !== undefined && query.sortBy !== '') {
    const field = String(query.sortBy).trim();
    if (!ALLOWED_SORT_FIELDS.includes(field)) {
      errors.push(`Invalid sortBy field. Allowed fields: ${ALLOWED_SORT_FIELDS.join(', ')}`);
    } else {
      sanitized.sortBy = field;
    }
  }

  // 7. Sort Order (Optional)
  if (query.sortOrder !== undefined && query.sortOrder !== '') {
    const order = String(query.sortOrder).trim().toLowerCase();
    if (!ALLOWED_SORT_ORDERS.includes(order)) {
      errors.push(`Invalid sortOrder. Allowed values: ${ALLOWED_SORT_ORDERS.join(', ')}`);
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
 * Validate body payload for admin order status transition
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: { status: string, note?: string } }}
 */
export const validateUpdateOrderStatus = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  // Reject prohibited injection fields
  for (const field of PROHIBITED_STATUS_MUTATION_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Modifying '${field}' is not permitted in status transition requests`);
    }
  }

  // 1. Status (Required)
  if (!body.status || typeof body.status !== 'string' || body.status.trim() === '') {
    errors.push('Order status is required');
  } else {
    const upperStatus = body.status.trim().toUpperCase();
    if (!ALLOWED_STATUSES.includes(upperStatus)) {
      errors.push(`Invalid status '${body.status}'. Allowed values: ${ALLOWED_STATUSES.join(', ')}`);
    } else {
      sanitized.status = upperStatus;
    }
  }

  // 2. Note (Optional)
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') {
      errors.push('Note must be a string');
    } else {
      const trimmedNote = body.note.trim();
      if (trimmedNote.length > 500) {
        errors.push('Note cannot exceed 500 characters');
      } else {
        sanitized.note = trimmedNote;
      }
    }
  } else {
    sanitized.note = '';
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate body payload for explicit admin demo order creation
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCreateDemoOrder = (body = {}) => {
  const errors = [];
  const sanitized = {
    status: 'PROCESSING',
  };

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  // Reject prohibited / customer-contaminating fields
  for (const field of PROHIBITED_DEMO_ORDER_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' is not permitted in demo order creation`);
    }
  }

  // 1. Order Number (Optional, but if provided MUST strictly start with DEMO-)
  if (body.orderNumber !== undefined && body.orderNumber !== null) {
    if (typeof body.orderNumber !== 'string') {
      errors.push('Order number must be a string');
    } else {
      const cleanNum = body.orderNumber.trim().toUpperCase();
      if (!cleanNum.startsWith('DEMO-')) {
        errors.push("Custom demo order number must strictly begin with 'DEMO-' prefix");
      } else if (!/^DEMO-[A-Z0-9-]+$/.test(cleanNum)) {
        errors.push('Demo order number may only contain uppercase alphanumeric characters and hyphens');
      } else if (cleanNum.length > 50) {
        errors.push('Demo order number cannot exceed 50 characters');
      } else {
        sanitized.orderNumber = cleanNum;
      }
    }
  }

  // 2. Status (Optional, must be PROCESSING, PLACED, or CONFIRMED)
  if (body.status !== undefined && body.status !== null) {
    const cleanStatus = String(body.status).trim().toUpperCase();
    if (!ALLOWED_DEMO_INITIAL_STATUSES.includes(cleanStatus)) {
      errors.push(
        `Invalid demo order initial status '${body.status}'. Allowed: ${ALLOWED_DEMO_INITIAL_STATUSES.join(', ')}`
      );
    } else {
      sanitized.status = cleanStatus;
    }
  }

  // 3. Shipping Address (Optional)
  if (body.shippingAddress !== undefined && body.shippingAddress !== null) {
    if (typeof body.shippingAddress !== 'object' || Array.isArray(body.shippingAddress)) {
      errors.push('shippingAddress must be an object');
    } else {
      const addr = body.shippingAddress;
      sanitized.shippingAddress = {
        fullName: typeof addr.fullName === 'string' && addr.fullName.trim() ? addr.fullName.trim() : 'Demo Customer',
        phone: typeof addr.phone === 'string' && addr.phone.trim() ? addr.phone.trim() : '9876543210',
        addressLine1:
          typeof addr.addressLine1 === 'string' && addr.addressLine1.trim()
            ? addr.addressLine1.trim()
            : 'Demo Luxury Suite 101',
        city: typeof addr.city === 'string' && addr.city.trim() ? addr.city.trim() : 'Delhi',
        state: typeof addr.state === 'string' && addr.state.trim() ? addr.state.trim() : 'Delhi',
        postalCode:
          typeof addr.postalCode === 'string' && addr.postalCode.trim() ? addr.postalCode.trim() : '110001',
        country: 'India',
        addressType: 'HOME',
      };
    }
  }

  // 4. Staging Note (Optional)
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string') {
      errors.push('notes must be a string');
    } else {
      sanitized.notes = body.notes.trim().slice(0, 300);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};
