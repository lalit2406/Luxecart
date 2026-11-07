import adminExportService, { formatToIstString } from './adminExport.service.js';
import {
  validateOrdersExportQuery,
  validateCustomersExportQuery,
  validateProductsExportQuery,
  validateCouponsExportQuery,
  validateReturnsExportQuery,
  validateSalesSummaryExportQuery,
} from '../../validators/adminExport.validator.js';

/**
 * Generate a clean, filesystem-safe filename with IST timestamp
 * e.g. "luxecart_orders_summary_20261101_111530.csv"
 */
const generateFilename = (category, subType, format) => {
  const istFormatted = formatToIstString(new Date())
    .replace(/-/g, '')
    .replace(/:/g, '')
    .replace(' ', '_');
  const typePart = subType ? `_${subType}` : '';
  return `luxecart_${category}${typePart}_${istFormatted}.${format}`;
};

/**
 * Helper to set standard download headers
 */
const setDownloadHeaders = (res, filename, format) => {
  const contentType =
    format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv; charset=utf-8';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
};

/**
 * Controller: Export Orders & Sales (Summary or Itemized)
 */
export const exportOrders = async (req, res, next) => {
  try {
    const validation = validateOrdersExportQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    // Preflight count check BEFORE setting headers
    await adminExportService.assertOrdersLimit(validation.sanitized);

    const { format, type } = validation.sanitized;
    const filename = generateFilename('orders', type, format);

    setDownloadHeaders(res, filename, format);
    await adminExportService.exportOrders(validation.sanitized, res);

    if (format === 'csv') {
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    } else {
      res.destroy(error);
    }
  }
};

/**
 * Controller: Export Customers Directory & Lifetime Stats
 */
export const exportCustomers = async (req, res, next) => {
  try {
    const validation = validateCustomersExportQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    await adminExportService.assertCustomersLimit(validation.sanitized);

    const { format } = validation.sanitized;
    const filename = generateFilename('customers', null, format);

    setDownloadHeaders(res, filename, format);
    await adminExportService.exportCustomers(validation.sanitized, res);

    if (format === 'csv') {
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    } else {
      res.destroy(error);
    }
  }
};

/**
 * Controller: Export Products Catalog & Variant Inventory
 */
export const exportProducts = async (req, res, next) => {
  try {
    const validation = validateProductsExportQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    await adminExportService.assertProductsLimit(validation.sanitized);

    const { format } = validation.sanitized;
    const filename = generateFilename('products', null, format);

    setDownloadHeaders(res, filename, format);
    await adminExportService.exportProducts(validation.sanitized, res);

    if (format === 'csv') {
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    } else {
      res.destroy(error);
    }
  }
};

/**
 * Controller: Export Coupons & Promotions
 */
export const exportCoupons = async (req, res, next) => {
  try {
    const validation = validateCouponsExportQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    await adminExportService.assertCouponsLimit(validation.sanitized);

    const { format } = validation.sanitized;
    const filename = generateFilename('coupons', null, format);

    setDownloadHeaders(res, filename, format);
    await adminExportService.exportCoupons(validation.sanitized, res);

    if (format === 'csv') {
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    } else {
      res.destroy(error);
    }
  }
};

/**
 * Controller: Export Returns & Refunds
 */
export const exportReturns = async (req, res, next) => {
  try {
    const validation = validateReturnsExportQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    await adminExportService.assertReturnsLimit(validation.sanitized);

    const { format } = validation.sanitized;
    const filename = generateFilename('returns', null, format);

    setDownloadHeaders(res, filename, format);
    await adminExportService.exportReturns(validation.sanitized, res);

    if (format === 'csv') {
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    } else {
      res.destroy(error);
    }
  }
};

/**
 * Controller: Export Aggregated Sales Summary
 */
export const exportSalesSummary = async (req, res, next) => {
  try {
    const validation = validateSalesSummaryExportQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const records = await adminExportService.assertSalesSummaryLimit(validation.sanitized);

    const { format, groupBy } = validation.sanitized;
    const filename = generateFilename('sales_summary', groupBy, format);

    setDownloadHeaders(res, filename, format);
    await adminExportService.exportSalesSummary(validation.sanitized, res, records);

    if (format === 'csv') {
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    } else {
      res.destroy(error);
    }
  }
};
