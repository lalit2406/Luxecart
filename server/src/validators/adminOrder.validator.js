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

/**
 * Validate query parameters for admin order listing
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: { page: number, limit: number, status?: string, search?: string, sortBy: string, sortOrder: string } }}
 */
export const validateAdminOrderQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
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

  // 4. Search Filter (Optional)
  if (query.search !== undefined && typeof query.search === 'string') {
    const trimmed = query.search.trim();
    if (trimmed.length > 0) {
      sanitized.search = trimmed;
    }
  }

  // 5. Sort By (Optional)
  if (query.sortBy !== undefined && query.sortBy !== '') {
    const field = String(query.sortBy).trim();
    if (!ALLOWED_SORT_FIELDS.includes(field)) {
      errors.push(`Invalid sortBy field. Allowed fields: ${ALLOWED_SORT_FIELDS.join(', ')}`);
    } else {
      sanitized.sortBy = field;
    }
  }

  // 6. Sort Order (Optional)
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
