const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in milliseconds

const ALLOWED_FORMATS = ['csv', 'xlsx'];
const ALLOWED_ORDER_EXPORT_TYPES = ['summary', 'itemized'];
const ALLOWED_ORDER_TYPES = ['LIVE', 'DEMO', 'ALL'];
const ALLOWED_ORDER_STATUSES = ['ALL', 'PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const ALLOWED_ORDER_PAYMENT_STATUSES = ['ALL', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'];
const ALLOWED_CUSTOMER_STATUSES = ['ALL', 'ACTIVE', 'INACTIVE', 'SUSPENDED'];
const ALLOWED_PRODUCT_STATUSES = ['ALL', 'ACTIVE', 'DRAFT', 'ARCHIVED'];
const ALLOWED_STOCK_STATUSES = ['ALL', 'LOW_STOCK', 'OUT_OF_STOCK'];
const ALLOWED_COUPON_STATUSES = ['ALL', 'ACTIVE', 'EXPIRED'];
const ALLOWED_RETURN_STATUSES = ['ALL', 'REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'RECEIVED', 'REFUNDED', 'REJECTED'];
const ALLOWED_SALES_GROUP_BY = ['day', 'week', 'month'];

/**
 * Validate a date string (YYYY-MM-DD) and ensure it corresponds to a real calendar date
 * @param {string} dateStr
 * @returns {boolean}
 */
export const isValidCalendarDate = (dateStr) => {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
};

/**
 * Convert YYYY-MM-DD date range into Indian Standard Time (IST, UTC+5:30) boundaries
 * Start: selected `from` at 00:00:00 IST (converted to UTC)
 * End: day after selected `to` at 00:00:00 IST (converted to UTC for exclusive $lt match)
 *
 * @param {string} fromStr
 * @param {string} toStr
 * @returns {{ startUtc: Date | null, endUtcExclusive: Date | null }}
 */
export const parseIstDateRange = (fromStr, toStr) => {
  let startUtc = null;
  let endUtcExclusive = null;

  if (fromStr) {
    const [year, month, day] = fromStr.split('-').map(Number);
    const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS;
    startUtc = new Date(startUtcMs);
  }

  if (toStr) {
    const [year, month, day] = toStr.split('-').map(Number);
    // Day after `to` at 00:00 IST
    const nextDayUtcMs = Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0) - IST_OFFSET_MS;
    endUtcExclusive = new Date(nextDayUtcMs);
  }

  return { startUtc, endUtcExclusive };
};

/**
 * Base validator for export query parameters
 */
export const validateBaseExportQuery = (query = {}) => {
  const errors = [];
  const sanitized = {
    format: 'csv',
    from: undefined,
    to: undefined,
    startUtc: null,
    endUtcExclusive: null,
  };

  // 1. Format
  if (query.format !== undefined && query.format !== '') {
    const fmt = String(query.format).trim().toLowerCase();
    if (!ALLOWED_FORMATS.includes(fmt)) {
      errors.push(`Invalid format '${query.format}'. Allowed formats: ${ALLOWED_FORMATS.join(', ')}`);
    } else {
      sanitized.format = fmt;
    }
  }

  // 2. 'from' date
  if (query.from !== undefined && query.from !== '') {
    const cleanFrom = String(query.from).trim();
    if (!isValidCalendarDate(cleanFrom)) {
      errors.push("Invalid 'from' date format or calendar date. Expected YYYY-MM-DD");
    } else {
      sanitized.from = cleanFrom;
    }
  }

  // 3. 'to' date
  if (query.to !== undefined && query.to !== '') {
    const cleanTo = String(query.to).trim();
    if (!isValidCalendarDate(cleanTo)) {
      errors.push("Invalid 'to' date format or calendar date. Expected YYYY-MM-DD");
    } else {
      sanitized.to = cleanTo;
    }
  }

  // 4. Date order check
  if (sanitized.from && sanitized.to) {
    if (sanitized.from > sanitized.to) {
      errors.push("'from' date cannot be after 'to' date");
    }
  }

  // 5. Compute IST UTC boundaries if dates provided
  if (sanitized.from || sanitized.to) {
    const { startUtc, endUtcExclusive } = parseIstDateRange(sanitized.from, sanitized.to);
    sanitized.startUtc = startUtc;
    sanitized.endUtcExclusive = endUtcExclusive;
  }

  return { errors, sanitized };
};

/**
 * Validate Orders Export Query
 */
export const validateOrdersExportQuery = (query = {}) => {
  const { errors, sanitized } = validateBaseExportQuery(query);

  // Export Type: SUMMARY (one row per order) vs ITEMIZED (one row per order item)
  sanitized.type = 'summary';
  if (query.type !== undefined && query.type !== '') {
    const exportType = String(query.type).trim().toLowerCase();
    if (!ALLOWED_ORDER_EXPORT_TYPES.includes(exportType)) {
      errors.push(`Invalid type '${query.type}'. Allowed types: ${ALLOWED_ORDER_EXPORT_TYPES.join(', ')}`);
    } else {
      sanitized.type = exportType;
    }
  }

  // Order Status
  sanitized.status = 'ALL';
  if (query.status !== undefined && query.status !== '') {
    const st = String(query.status).trim().toUpperCase();
    if (!ALLOWED_ORDER_STATUSES.includes(st)) {
      errors.push(`Invalid status '${query.status}'. Allowed values: ${ALLOWED_ORDER_STATUSES.join(', ')}`);
    } else {
      sanitized.status = st;
    }
  }

  // Payment Status
  sanitized.paymentStatus = 'ALL';
  if (query.paymentStatus !== undefined && query.paymentStatus !== '') {
    const ps = String(query.paymentStatus).trim().toUpperCase();
    if (!ALLOWED_ORDER_PAYMENT_STATUSES.includes(ps)) {
      errors.push(`Invalid paymentStatus '${query.paymentStatus}'. Allowed values: ${ALLOWED_ORDER_PAYMENT_STATUSES.join(', ')}`);
    } else {
      sanitized.paymentStatus = ps;
    }
  }

  // Order Type: LIVE (default), DEMO, ALL
  sanitized.orderType = 'LIVE';
  if (query.orderType !== undefined && query.orderType !== '') {
    const ot = String(query.orderType).trim().toUpperCase();
    if (!ALLOWED_ORDER_TYPES.includes(ot)) {
      errors.push(`Invalid orderType '${query.orderType}'. Allowed values: ${ALLOWED_ORDER_TYPES.join(', ')}`);
    } else {
      sanitized.orderType = ot;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate Customers Export Query
 */
export const validateCustomersExportQuery = (query = {}) => {
  const { errors, sanitized } = validateBaseExportQuery(query);

  sanitized.status = 'ALL';
  if (query.status !== undefined && query.status !== '') {
    const st = String(query.status).trim().toUpperCase();
    if (!ALLOWED_CUSTOMER_STATUSES.includes(st)) {
      errors.push(`Invalid status '${query.status}'. Allowed values: ${ALLOWED_CUSTOMER_STATUSES.join(', ')}`);
    } else {
      sanitized.status = st;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate Products Export Query
 */
export const validateProductsExportQuery = (query = {}) => {
  const { errors, sanitized } = validateBaseExportQuery(query);

  sanitized.status = 'ALL';
  if (query.status !== undefined && query.status !== '') {
    const st = String(query.status).trim().toUpperCase();
    if (!ALLOWED_PRODUCT_STATUSES.includes(st)) {
      errors.push(`Invalid status '${query.status}'. Allowed values: ${ALLOWED_PRODUCT_STATUSES.join(', ')}`);
    } else {
      sanitized.status = st;
    }
  }

  sanitized.stockStatus = 'ALL';
  if (query.stockStatus !== undefined && query.stockStatus !== '') {
    const ss = String(query.stockStatus).trim().toUpperCase();
    if (!ALLOWED_STOCK_STATUSES.includes(ss)) {
      errors.push(`Invalid stockStatus '${query.stockStatus}'. Allowed values: ${ALLOWED_STOCK_STATUSES.join(', ')}`);
    } else {
      sanitized.stockStatus = ss;
    }
  }

  if (query.category !== undefined && typeof query.category === 'string') {
    const cat = query.category.trim();
    if (cat.length > 0) {
      sanitized.category = cat;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate Coupons Export Query
 */
export const validateCouponsExportQuery = (query = {}) => {
  const { errors, sanitized } = validateBaseExportQuery(query);

  sanitized.status = 'ALL';
  if (query.status !== undefined && query.status !== '') {
    const st = String(query.status).trim().toUpperCase();
    if (!ALLOWED_COUPON_STATUSES.includes(st)) {
      errors.push(`Invalid status '${query.status}'. Allowed values: ${ALLOWED_COUPON_STATUSES.join(', ')}`);
    } else {
      sanitized.status = st;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate Returns Export Query
 */
export const validateReturnsExportQuery = (query = {}) => {
  const { errors, sanitized } = validateBaseExportQuery(query);

  sanitized.status = 'ALL';
  if (query.status !== undefined && query.status !== '') {
    const st = String(query.status).trim().toUpperCase();
    if (!ALLOWED_RETURN_STATUSES.includes(st)) {
      errors.push(`Invalid status '${query.status}'. Allowed values: ${ALLOWED_RETURN_STATUSES.join(', ')}`);
    } else {
      sanitized.status = st;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};

/**
 * Validate Sales Summary Export Query
 */
export const validateSalesSummaryExportQuery = (query = {}) => {
  const { errors, sanitized } = validateBaseExportQuery(query);

  sanitized.groupBy = 'day';
  if (query.groupBy !== undefined && query.groupBy !== '') {
    const gb = String(query.groupBy).trim().toLowerCase();
    if (!ALLOWED_SALES_GROUP_BY.includes(gb)) {
      errors.push(`Invalid groupBy '${query.groupBy}'. Allowed values: ${ALLOWED_SALES_GROUP_BY.join(', ')}`);
    } else {
      sanitized.groupBy = gb;
    }
  }

  // Order Type: LIVE (default), DEMO, ALL
  sanitized.orderType = 'LIVE';
  if (query.orderType !== undefined && query.orderType !== '') {
    const ot = String(query.orderType).trim().toUpperCase();
    if (!ALLOWED_ORDER_TYPES.includes(ot)) {
      errors.push(`Invalid orderType '${query.orderType}'. Allowed values: ${ALLOWED_ORDER_TYPES.join(', ')}`);
    } else {
      sanitized.orderType = ot;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};
