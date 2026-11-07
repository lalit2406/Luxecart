import api from '../../../../services/api.js';

/**
 * Extract filename from Content-Disposition header with fallback
 * @param {string} contentDisposition
 * @param {string} fallbackFilename
 * @returns {string}
 */
export const extractFilenameFromHeader = (contentDisposition, fallbackFilename = 'luxecart_export.csv') => {
  if (!contentDisposition) return fallbackFilename;

  // 1. Try filename*=UTF-8''... (RFC 5987 / RFC 6266)
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch (_) {
      // Fall through on URI decode error
    }
  }

  // 2. Try standard filename="..."
  const standardMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (standardMatch && standardMatch[1]) {
    return standardMatch[1].trim();
  }

  return fallbackFilename;
};

/**
 * Trigger browser file download from Blob and revoke Object URL safely
 * @param {Blob} blob - Downloaded file blob
 * @param {string} filename - Target filename
 */
export const triggerBlobDownload = (blob, filename) => {
  if (typeof window === 'undefined') return;

  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.setAttribute('download', filename);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Clean up DOM and revoke object URL to prevent memory leaks
  document.body.removeChild(link);
  setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 100);
};

/**
 * Helper to parse Blob-based Axios error responses into readable Error objects
 * @param {any} error
 * @returns {Promise<Error>}
 */
export const parseBlobError = async (error) => {
  if (error?.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text();
      const parsed = JSON.parse(text);
      const enhancedError = new Error(parsed.message || error.message || 'Export request failed');
      enhancedError.code = parsed.code || 'EXPORT_ERROR';
      enhancedError.statusCode = error.response.status;
      enhancedError.details = parsed.details;
      return enhancedError;
    } catch (_) {
      // Body was not JSON
    }
  }
  return error instanceof Error ? error : new Error(error?.message || 'Export request failed');
};

/**
 * Clean query params by stripping empty strings, undefined, null, and 'ALL' values
 * @param {object} params
 * @returns {object}
 */
const sanitizeParams = (params = {}) => {
  const cleaned = {};
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      cleaned[key] = val;
    }
  }
  return cleaned;
};

export const adminExportApi = {
  /**
   * Export Orders & Sales (Summary or Itemized)
   * @param {object} params
   * @param {'csv'|'xlsx'} [params.format='csv']
   * @param {'summary'|'itemized'} [params.type='summary']
   * @param {string} [params.from] - YYYY-MM-DD
   * @param {string} [params.to] - YYYY-MM-DD
   * @param {string} [params.status]
   * @param {string} [params.paymentStatus]
   * @param {'LIVE'|'DEMO'|'ALL'} [params.orderType='LIVE']
   * @returns {Promise<{ data: Blob, headers: object, filename: string }>}
   */
  exportOrders: async (params = {}) => {
    const response = await api.get('/admin/exports/orders', {
      params: sanitizeParams(params),
      responseType: 'blob',
    });
    const contentDisposition = response.headers?.['content-disposition'];
    const ext = params.format === 'xlsx' ? 'xlsx' : 'csv';
    const fallbackFilename = `luxecart_orders_${params.type || 'summary'}_${Date.now()}.${ext}`;
    const filename = extractFilenameFromHeader(contentDisposition, fallbackFilename);

    return {
      data: response.data,
      headers: response.headers,
      filename,
    };
  },

  /**
   * Export Customer Directory & Lifetime Stats
   * @param {object} params
   * @param {'csv'|'xlsx'} [params.format='csv']
   * @param {string} [params.from] - YYYY-MM-DD
   * @param {string} [params.to] - YYYY-MM-DD
   * @param {'ALL'|'ACTIVE'|'SUSPENDED'|'INACTIVE'} [params.status]
   * @returns {Promise<{ data: Blob, headers: object, filename: string }>}
   */
  exportCustomers: async (params = {}) => {
    const response = await api.get('/admin/exports/customers', {
      params: sanitizeParams(params),
      responseType: 'blob',
    });
    const contentDisposition = response.headers?.['content-disposition'];
    const ext = params.format === 'xlsx' ? 'xlsx' : 'csv';
    const fallbackFilename = `luxecart_customers_${Date.now()}.${ext}`;
    const filename = extractFilenameFromHeader(contentDisposition, fallbackFilename);

    return {
      data: response.data,
      headers: response.headers,
      filename,
    };
  },

  /**
   * Export Products & Variant Inventory
   * @param {object} params
   * @param {'csv'|'xlsx'} [params.format='csv']
   * @param {string} [params.category]
   * @param {'ALL'|'ACTIVE'|'DRAFT'|'ARCHIVED'} [params.status]
   * @param {'ALL'|'LOW_STOCK'|'OUT_OF_STOCK'} [params.stockStatus]
   * @returns {Promise<{ data: Blob, headers: object, filename: string }>}
   */
  exportProducts: async (params = {}) => {
    const response = await api.get('/admin/exports/products', {
      params: sanitizeParams(params),
      responseType: 'blob',
    });
    const contentDisposition = response.headers?.['content-disposition'];
    const ext = params.format === 'xlsx' ? 'xlsx' : 'csv';
    const fallbackFilename = `luxecart_products_${Date.now()}.${ext}`;
    const filename = extractFilenameFromHeader(contentDisposition, fallbackFilename);

    return {
      data: response.data,
      headers: response.headers,
      filename,
    };
  },

  /**
   * Export Coupons & Promotions
   * @param {object} params
   * @param {'csv'|'xlsx'} [params.format='csv']
   * @param {'ALL'|'ACTIVE'|'EXPIRED'} [params.status]
   * @returns {Promise<{ data: Blob, headers: object, filename: string }>}
   */
  exportCoupons: async (params = {}) => {
    const response = await api.get('/admin/exports/coupons', {
      params: sanitizeParams(params),
      responseType: 'blob',
    });
    const contentDisposition = response.headers?.['content-disposition'];
    const ext = params.format === 'xlsx' ? 'xlsx' : 'csv';
    const fallbackFilename = `luxecart_coupons_${Date.now()}.${ext}`;
    const filename = extractFilenameFromHeader(contentDisposition, fallbackFilename);

    return {
      data: response.data,
      headers: response.headers,
      filename,
    };
  },

  /**
   * Export Returns & Refunds
   * @param {object} params
   * @param {'csv'|'xlsx'} [params.format='csv']
   * @param {string} [params.from] - YYYY-MM-DD
   * @param {string} [params.to] - YYYY-MM-DD
   * @param {string} [params.status]
   * @returns {Promise<{ data: Blob, headers: object, filename: string }>}
   */
  exportReturns: async (params = {}) => {
    const response = await api.get('/admin/exports/returns', {
      params: sanitizeParams(params),
      responseType: 'blob',
    });
    const contentDisposition = response.headers?.['content-disposition'];
    const ext = params.format === 'xlsx' ? 'xlsx' : 'csv';
    const fallbackFilename = `luxecart_returns_${Date.now()}.${ext}`;
    const filename = extractFilenameFromHeader(contentDisposition, fallbackFilename);

    return {
      data: response.data,
      headers: response.headers,
      filename,
    };
  },

  /**
   * Export Aggregated Sales Summary
   * @param {object} params
   * @param {'csv'|'xlsx'} [params.format='csv']
   * @param {'day'|'week'|'month'} [params.groupBy='day']
   * @param {'LIVE'|'DEMO'|'ALL'} [params.orderType='LIVE']
   * @param {string} [params.from] - YYYY-MM-DD
   * @param {string} [params.to] - YYYY-MM-DD
   * @returns {Promise<{ data: Blob, headers: object, filename: string }>}
   */
  exportSalesSummary: async (params = {}) => {
    const response = await api.get('/admin/exports/sales-summary', {
      params: sanitizeParams(params),
      responseType: 'blob',
    });
    const contentDisposition = response.headers?.['content-disposition'];
    const ext = params.format === 'xlsx' ? 'xlsx' : 'csv';
    const fallbackFilename = `luxecart_sales_summary_${params.groupBy || 'day'}_${Date.now()}.${ext}`;
    const filename = extractFilenameFromHeader(contentDisposition, fallbackFilename);

    return {
      data: response.data,
      headers: response.headers,
      filename,
    };
  },
};

export default adminExportApi;
