import { ANALYTICS_RANGES, CUSTOMER_SEGMENTS } from '../modules/analytics/analytics.constants.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate analytics query parameters
 * @param {object} query - { range, from, to }
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateAnalyticsQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    range: ANALYTICS_RANGES.THIRTY_DAYS,
    startDate: null,
    endDate: null,
  };

  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return {
      isValid: false,
      errors: ['Query parameters must be an object'],
      sanitized: {},
    };
  }

  const { range, from, to } = query;

  if (range !== undefined && range !== null && range !== '') {
    const cleanRange = String(range).trim().toLowerCase();
    const allowedRanges = Object.values(ANALYTICS_RANGES);
    if (!allowedRanges.includes(cleanRange)) {
      errors.push(`Invalid range '${range}'. Allowed ranges: ${allowedRanges.join(', ')}`);
    } else {
      sanitized.range = cleanRange;
    }
  }

  // Handle custom date filters if provided
  if (from !== undefined && from !== null && from !== '') {
    const cleanFrom = String(from).trim();
    if (!DATE_REGEX.test(cleanFrom)) {
      errors.push("Invalid 'from' date format. Expected YYYY-MM-DD");
    } else {
      const fromDate = new Date(`${cleanFrom}T00:00:00.000Z`);
      if (isNaN(fromDate.getTime()) || fromDate.toISOString().slice(0, 10) !== cleanFrom) {
        errors.push("Invalid 'from' date value");
      } else {
        sanitized.startDate = fromDate;
      }
    }
  }

  if (to !== undefined && to !== null && to !== '') {
    const cleanTo = String(to).trim();
    if (!DATE_REGEX.test(cleanTo)) {
      errors.push("Invalid 'to' date format. Expected YYYY-MM-DD");
    } else {
      const toDate = new Date(`${cleanTo}T23:59:59.999Z`);
      if (isNaN(toDate.getTime()) || toDate.toISOString().slice(0, 10) !== cleanTo) {
        errors.push("Invalid 'to' date value");
      } else {
        sanitized.endDate = toDate;
      }
    }
  }

  // If explicit dates provided, set range to CUSTOM
  if (sanitized.startDate || sanitized.endDate) {
    sanitized.range = ANALYTICS_RANGES.CUSTOM;

    if (sanitized.startDate && sanitized.endDate) {
      if (sanitized.startDate.getTime() > sanitized.endDate.getTime()) {
        errors.push("'from' date cannot be after 'to' date");
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate product-level analytics query parameters
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateProductAnalyticsQuery = (query = {}) => {
  const baseValidation = validateAnalyticsQuery(query);
  const errors = [...baseValidation.errors];
  const sanitized = {
    ...baseValidation.sanitized,
    page: 1,
    limit: 10,
    sortBy: 'revenue',
    sortOrder: 'desc',
    search: '',
    categoryId: null,
  };

  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('page must be a positive integer');
    } else {
      sanitized.page = pageNum;
    }
  }

  if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('limit must be an integer between 1 and 100');
    } else {
      sanitized.limit = limitNum;
    }
  }

  if (query.sortBy) {
    const cleanSort = String(query.sortBy).trim().toLowerCase();
    const allowedSort = ['revenue', 'units', 'orders', 'net_sales', 'returns'];
    if (!allowedSort.includes(cleanSort)) {
      errors.push(`sortBy must be one of: ${allowedSort.join(', ')}`);
    } else {
      sanitized.sortBy = cleanSort;
    }
  }

  if (query.sortOrder) {
    const cleanOrder = String(query.sortOrder).trim().toLowerCase();
    if (!['asc', 'desc'].includes(cleanOrder)) {
      errors.push("sortOrder must be 'asc' or 'desc'");
    } else {
      sanitized.sortOrder = cleanOrder;
    }
  }

  if (query.search && typeof query.search === 'string') {
    const cleanSearch = query.search.trim();
    if (cleanSearch.length > 100) {
      errors.push('search cannot exceed 100 characters');
    } else if (cleanSearch.length > 0) {
      sanitized.search = cleanSearch;
    }
  }

  if (query.categoryId && typeof query.categoryId === 'string') {
    const cleanCat = query.categoryId.trim();
    if (!/^[0-9a-fA-F]{24}$/.test(cleanCat)) {
      errors.push('categoryId must be a valid 24-character hexadecimal ObjectId');
    } else {
      sanitized.categoryId = cleanCat;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate category-level analytics query parameters
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCategoryAnalyticsQuery = (query = {}) => {
  const baseValidation = validateAnalyticsQuery(query);
  const errors = [...baseValidation.errors];
  const sanitized = {
    ...baseValidation.sanitized,
    page: 1,
    limit: 20,
    sortBy: 'revenue',
    sortOrder: 'desc',
    search: '',
  };

  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('page must be a positive integer');
    } else {
      sanitized.page = pageNum;
    }
  }

  if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('limit must be an integer between 1 and 100');
    } else {
      sanitized.limit = limitNum;
    }
  }

  if (query.sortBy) {
    const cleanSort = String(query.sortBy).trim().toLowerCase();
    const allowedSort = ['revenue', 'units', 'orders', 'net_sales', 'returns'];
    if (!allowedSort.includes(cleanSort)) {
      errors.push(`sortBy must be one of: ${allowedSort.join(', ')}`);
    } else {
      sanitized.sortBy = cleanSort;
    }
  }

  if (query.sortOrder) {
    const cleanOrder = String(query.sortOrder).trim().toLowerCase();
    if (!['asc', 'desc'].includes(cleanOrder)) {
      errors.push("sortOrder must be 'asc' or 'desc'");
    } else {
      sanitized.sortOrder = cleanOrder;
    }
  }

  if (query.search && typeof query.search === 'string') {
    const cleanSearch = query.search.trim();
    if (cleanSearch.length > 100) {
      errors.push('search cannot exceed 100 characters');
    } else if (cleanSearch.length > 0) {
      sanitized.search = cleanSearch;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate customer cohort analytics query parameters
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCustomerAnalyticsQuery = (query = {}) => {
  const baseValidation = validateAnalyticsQuery(query);
  const errors = [...baseValidation.errors];
  const sanitized = {
    ...baseValidation.sanitized,
    page: 1,
    limit: 10,
    sortBy: 'revenue',
    sortOrder: 'desc',
    search: '',
    segment: null,
  };

  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('page must be a positive integer');
    } else {
      sanitized.page = pageNum;
    }
  }

  if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('limit must be an integer between 1 and 100');
    } else {
      sanitized.limit = limitNum;
    }
  }

  if (query.sortBy) {
    const cleanSort = String(query.sortBy).trim().toLowerCase();
    const allowedSort = ['revenue', 'net_sales', 'orders', 'units', 'aov', 'latest_order'];
    if (!allowedSort.includes(cleanSort)) {
      errors.push(`sortBy must be one of: ${allowedSort.join(', ')}`);
    } else {
      sanitized.sortBy = cleanSort;
    }
  }

  if (query.sortOrder) {
    const cleanOrder = String(query.sortOrder).trim().toLowerCase();
    if (!['asc', 'desc'].includes(cleanOrder)) {
      errors.push("sortOrder must be 'asc' or 'desc'");
    } else {
      sanitized.sortOrder = cleanOrder;
    }
  }

  if (query.search && typeof query.search === 'string') {
    const cleanSearch = query.search.trim();
    if (cleanSearch.length > 100) {
      errors.push('search cannot exceed 100 characters');
    } else if (cleanSearch.length > 0) {
      sanitized.search = cleanSearch;
    }
  }

  if (query.segment) {
    const cleanSeg = String(query.segment).trim().toUpperCase();
    const allowedSegments = Object.values(CUSTOMER_SEGMENTS);
    if (!allowedSegments.includes(cleanSeg)) {
      errors.push(`segment must be one of: ${allowedSegments.join(', ')}`);
    } else {
      sanitized.segment = cleanSeg;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate order distribution query parameters
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateOrderDistributionQuery = (query = {}) => {
  return validateAnalyticsQuery(query);
};

/**
 * Validate customer trends query parameters
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCustomerTrendsQuery = (query = {}) => {
  return validateAnalyticsQuery(query);
};

/**
 * Validate inventory health query parameters
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateInventoryHealthQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 20,
    search: '',
    status: 'ALL',
    categoryId: null,
    sortBy: 'available',
    sortOrder: 'asc',
  };

  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return {
      isValid: false,
      errors: ['Query parameters must be an object'],
      sanitized: {},
    };
  }

  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const pageNum = parseInt(query.page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('page must be a positive integer');
    } else {
      sanitized.page = pageNum;
    }
  }

  if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
    const limitNum = parseInt(query.limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('limit must be an integer between 1 and 100');
    } else {
      sanitized.limit = limitNum;
    }
  }

  if (query.status) {
    const cleanStatus = String(query.status).trim().toUpperCase();
    const allowedStatuses = ['ALL', 'HEALTHY', 'LOW_STOCK', 'OUT_OF_STOCK'];
    if (!allowedStatuses.includes(cleanStatus)) {
      errors.push(`status must be one of: ${allowedStatuses.join(', ')}`);
    } else {
      sanitized.status = cleanStatus;
    }
  }

  if (query.sortBy) {
    const cleanSort = String(query.sortBy).trim().toLowerCase();
    const allowedSort = ['stock', 'available', 'reserved', 'inventory_value', 'threshold', 'updated_at'];
    if (!allowedSort.includes(cleanSort)) {
      errors.push(`sortBy must be one of: ${allowedSort.join(', ')}`);
    } else {
      sanitized.sortBy = cleanSort;
    }
  }

  if (query.sortOrder) {
    const cleanOrder = String(query.sortOrder).trim().toLowerCase();
    if (!['asc', 'desc'].includes(cleanOrder)) {
      errors.push("sortOrder must be 'asc' or 'desc'");
    } else {
      sanitized.sortOrder = cleanOrder;
    }
  }

  if (query.search && typeof query.search === 'string') {
    const cleanSearch = query.search.trim();
    if (cleanSearch.length > 100) {
      errors.push('search cannot exceed 100 characters');
    } else if (cleanSearch.length > 0) {
      sanitized.search = cleanSearch;
    }
  }

  if (query.categoryId && typeof query.categoryId === 'string') {
    const cleanCat = query.categoryId.trim();
    if (!/^[0-9a-fA-F]{24}$/.test(cleanCat)) {
      errors.push('categoryId must be a valid 24-character hexadecimal ObjectId');
    } else {
      sanitized.categoryId = cleanCat;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

/**
 * Validate low-stock query parameters
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateLowStockQuery = (query = {}) => {
  return validateInventoryHealthQuery({ ...query, status: 'LOW_STOCK' });
};

/**
 * Validate out-of-stock query parameters
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateOutOfStockQuery = (query = {}) => {
  return validateInventoryHealthQuery({ ...query, status: 'OUT_OF_STOCK' });
};

/**
 * Validate inventory concentration query parameters
 * @param {object} query
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateInventoryConcentrationQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    search: '',
    sortBy: 'stock',
    sortOrder: 'desc',
  };

  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return {
      isValid: false,
      errors: ['Query parameters must be an object'],
      sanitized: {},
    };
  }

  if (query.search && typeof query.search === 'string') {
    const cleanSearch = query.search.trim();
    if (cleanSearch.length > 100) {
      errors.push('search cannot exceed 100 characters');
    } else if (cleanSearch.length > 0) {
      sanitized.search = cleanSearch;
    }
  }

  if (query.sortBy) {
    const cleanSort = String(query.sortBy).trim().toLowerCase();
    const allowedSort = ['stock', 'available', 'inventory_value', 'variants', 'name'];
    if (!allowedSort.includes(cleanSort)) {
      errors.push(`sortBy must be one of: ${allowedSort.join(', ')}`);
    } else {
      sanitized.sortBy = cleanSort;
    }
  }

  if (query.sortOrder) {
    const cleanOrder = String(query.sortOrder).trim().toLowerCase();
    if (!['asc', 'desc'].includes(cleanOrder)) {
      errors.push("sortOrder must be 'asc' or 'desc'");
    } else {
      sanitized.sortOrder = cleanOrder;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : {},
  };
};

