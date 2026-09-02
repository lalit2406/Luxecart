const ALLOWED_REVIEW_STATUSES = ['APPROVED', 'HIDDEN', 'REJECTED'];
const ALLOWED_PUBLIC_SORT_FIELDS = ['createdAt', 'rating', 'helpfulVotes'];
const ALLOWED_ADMIN_SORT_FIELDS = ['createdAt', 'rating', 'status'];
const ALLOWED_SORT_ORDERS = ['asc', 'desc'];

const PROHIBITED_CREATE_FIELDS = [
  'userId',
  'isVerifiedPurchase',
  'status',
  'helpfulVotes',
  '_id',
  'id',
  'createdAt',
  'updatedAt',
];

/**
 * Validate customer review submission
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: { rating: number, title: string, comment: string } }}
 */
export const validateCreateReview = (body = {}) => {
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
  for (const field of PROHIBITED_CREATE_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be provided by the client`);
    }
  }

  // 1. Rating (Required integer 1-5)
  if (body.rating === undefined || body.rating === null) {
    errors.push('Rating is required');
  } else {
    const num = Number(body.rating);
    if (isNaN(num) || !Number.isInteger(num) || num < 1 || num > 5) {
      errors.push('Rating must be an integer between 1 and 5');
    } else {
      sanitized.rating = num;
    }
  }

  // 2. Title (Required string, max 100)
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    errors.push('Review title is required');
  } else {
    const trimmedTitle = body.title.trim();
    if (trimmedTitle.length > 100) {
      errors.push('Review title cannot exceed 100 characters');
    } else {
      sanitized.title = trimmedTitle;
    }
  }

  // 3. Comment (Required string, max 2000)
  if (!body.comment || typeof body.comment !== 'string' || body.comment.trim() === '') {
    errors.push('Review comment is required');
  } else {
    const trimmedComment = body.comment.trim();
    if (trimmedComment.length > 2000) {
      errors.push('Review comment cannot exceed 2000 characters');
    } else {
      sanitized.comment = trimmedComment;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate customer review update
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: { rating?: number, title?: string, comment?: string } }}
 */
export const validateUpdateReview = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  for (const field of PROHIBITED_CREATE_FIELDS) {
    if (body[field] !== undefined) {
      errors.push(`Field '${field}' cannot be modified by the client`);
    }
  }

  let hasUpdate = false;

  // 1. Rating (Optional integer 1-5)
  if (body.rating !== undefined && body.rating !== null) {
    const num = Number(body.rating);
    if (isNaN(num) || !Number.isInteger(num) || num < 1 || num > 5) {
      errors.push('Rating must be an integer between 1 and 5');
    } else {
      sanitized.rating = num;
      hasUpdate = true;
    }
  }

  // 2. Title (Optional string, max 100)
  if (body.title !== undefined && body.title !== null) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      errors.push('Review title cannot be empty');
    } else {
      const trimmedTitle = body.title.trim();
      if (trimmedTitle.length > 100) {
        errors.push('Review title cannot exceed 100 characters');
      } else {
        sanitized.title = trimmedTitle;
        hasUpdate = true;
      }
    }
  }

  // 3. Comment (Optional string, max 2000)
  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== 'string' || body.comment.trim() === '') {
      errors.push('Review comment cannot be empty');
    } else {
      const trimmedComment = body.comment.trim();
      if (trimmedComment.length > 2000) {
        errors.push('Review comment cannot exceed 2000 characters');
      } else {
        sanitized.comment = trimmedComment;
        hasUpdate = true;
      }
    }
  }

  if (!hasUpdate && errors.length === 0) {
    errors.push('At least one field (rating, title, comment) must be provided to update');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate query parameters for public product reviews listing
 * @param {object} query
 */
export const validatePublicReviewQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 10,
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
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      errors.push('Limit must be a positive integer between 1 and 50');
    } else {
      sanitized.limit = limitNum;
    }
  }

  if (query.rating !== undefined && query.rating !== '' && query.rating !== 'ALL') {
    const r = parseInt(query.rating, 10);
    if (isNaN(r) || r < 1 || r > 5) {
      errors.push('Rating filter must be an integer between 1 and 5');
    } else {
      sanitized.rating = r;
    }
  }

  if (query.sortBy !== undefined && query.sortBy !== '') {
    const field = String(query.sortBy).trim();
    if (!ALLOWED_PUBLIC_SORT_FIELDS.includes(field)) {
      errors.push(`Invalid sortBy. Allowed: ${ALLOWED_PUBLIC_SORT_FIELDS.join(', ')}`);
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
 * Validate query parameters for admin reviews moderation listing
 * @param {object} query
 */
export const validateAdminReviewQuery = (query = {}) => {
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
    if (!ALLOWED_REVIEW_STATUSES.includes(statusUpper)) {
      errors.push(`Invalid status filter. Allowed: ${ALLOWED_REVIEW_STATUSES.join(', ')}`);
    } else {
      sanitized.status = statusUpper;
    }
  }

  if (query.productId !== undefined && query.productId !== '') {
    sanitized.productId = String(query.productId).trim();
  }

  if (query.search !== undefined && typeof query.search === 'string') {
    const trimmed = query.search.trim();
    if (trimmed.length > 0) {
      sanitized.search = trimmed;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate review moderation status change
 * @param {object} body
 */
export const validateModerateReviewStatus = (body = {}) => {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
      sanitized: {},
    };
  }

  if (!body.status || typeof body.status !== 'string' || body.status.trim() === '') {
    errors.push('Review status is required');
  } else {
    const statusUpper = body.status.trim().toUpperCase();
    if (!ALLOWED_REVIEW_STATUSES.includes(statusUpper)) {
      errors.push(`Invalid review status. Allowed: ${ALLOWED_REVIEW_STATUSES.join(', ')}`);
    } else {
      sanitized.status = statusUpper;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};
