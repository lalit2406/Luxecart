const ALLOWED_STATUSES = ['ALL', 'ACTIVE', 'INACTIVE', 'SUSPENDED'];
const ALLOWED_TARGET_STATUSES = ['ACTIVE', 'SUSPENDED'];
const ALLOWED_SORT_FIELDS = ['createdAt', 'name', 'email'];
const ALLOWED_SORT_ORDERS = ['asc', 'desc'];

const PROHIBITED_STATUS_MUTATION_FIELDS = [
  'role',
  'password',
  'passwordHash',
  'email',
  '_id',
  'id',
  'refreshTokens',
  'googleId',
  'resetPasswordTokenHash',
  'resetPasswordExpires',
  'phone',
  'name',
  'avatar',
  'statusHistory',
];

/**
 * Validate query parameters for admin customer directory listing
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: { page: number, limit: number, status: string, search?: string, sortBy: string, sortOrder: string } }}
 */
export const validateAdminCustomerQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 20,
    status: 'ALL',
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
      errors.push('Limit must be an integer between 1 and 100');
    } else {
      sanitized.limit = limitNum;
    }
  }

  // 3. Status Filter (Optional)
  if (query.status !== undefined && query.status !== '') {
    const statusVal = String(query.status).trim().toUpperCase();
    if (!ALLOWED_STATUSES.includes(statusVal)) {
      errors.push(`Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`);
    } else {
      sanitized.status = statusVal;
    }
  }

  // 4. Search Query (Optional)
  if (query.search !== undefined && typeof query.search === 'string') {
    const trimmed = query.search.trim();
    if (trimmed.length > 100) {
      errors.push('Search query cannot exceed 100 characters');
    } else if (trimmed.length > 0) {
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
 * Validate query parameters for customer orders listing
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: { page: number, limit: number } }}
 */
export const validateCustomerOrdersQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 10,
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
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      errors.push('Limit must be an integer between 1 and 50');
    } else {
      sanitized.limit = limitNum;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate body payload for customer status modification
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: { status: string, reason?: string } }}
 */
export const validateUpdateCustomerStatus = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  // Reject prohibited fields
  for (const field of PROHIBITED_STATUS_MUTATION_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Modifying '${field}' is not permitted in customer status update requests`);
    }
  }

  // Validate status
  if (!body.status || typeof body.status !== 'string') {
    errors.push(`Status is required and must be either ${ALLOWED_TARGET_STATUSES.join(' or ')}`);
  } else {
    const upperStatus = body.status.trim().toUpperCase();
    if (!ALLOWED_TARGET_STATUSES.includes(upperStatus)) {
      errors.push(`Invalid status '${body.status}'. Allowed values: ${ALLOWED_TARGET_STATUSES.join(', ')}`);
    } else {
      sanitized.status = upperStatus;
    }
  }

  // Validate reason (optional note)
  if (body.reason !== undefined && body.reason !== null) {
    if (typeof body.reason !== 'string') {
      errors.push('Reason must be a string');
    } else {
      const trimmedReason = body.reason.trim();
      if (trimmedReason.length > 500) {
        errors.push('Reason cannot exceed 500 characters');
      } else {
        sanitized.reason = trimmedReason;
      }
    }
  } else {
    sanitized.reason = '';
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};
