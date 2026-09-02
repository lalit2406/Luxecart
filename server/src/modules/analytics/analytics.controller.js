import analyticsService from './analytics.service.js';
import {
  validateAnalyticsQuery,
  validateProductAnalyticsQuery,
  validateCategoryAnalyticsQuery,
  validateCustomerAnalyticsQuery,
  validateOrderDistributionQuery,
  validateCustomerTrendsQuery,
  validateInventoryHealthQuery,
  validateLowStockQuery,
  validateOutOfStockQuery,
  validateInventoryConcentrationQuery,
} from '../../validators/adminAnalytics.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Retrieve high-level analytics summary metrics
 */
export const getSummary = async (req, res, next) => {
  try {
    const validation = validateAnalyticsQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await analyticsService.getAnalyticsSummary(validation.sanitized);

    return sendSuccess(res, 200, 'Analytics summary retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve time-series sales trend metrics
 */
export const getSalesTrends = async (req, res, next) => {
  try {
    const validation = validateAnalyticsQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await analyticsService.getSalesTrends(validation.sanitized);

    return sendSuccess(res, 200, 'Sales trends retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve product sales and performance analytics
 */
export const getProductPerformance = async (req, res, next) => {
  try {
    const validation = validateProductAnalyticsQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await analyticsService.getProductPerformance(validation.sanitized);

    return sendSuccess(res, 200, 'Product performance analytics retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve category sales and revenue contribution analytics
 */
export const getCategoryPerformance = async (req, res, next) => {
  try {
    const validation = validateCategoryAnalyticsQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await analyticsService.getCategoryPerformance(validation.sanitized);

    return sendSuccess(res, 200, 'Category performance analytics retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve customer cohort and performance analytics
 */
export const getCustomerPerformance = async (req, res, next) => {
  try {
    const validation = validateCustomerAnalyticsQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await analyticsService.getCustomerPerformance(validation.sanitized);

    return sendSuccess(res, 200, 'Customer cohort analytics retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve order value distribution buckets
 */
export const getOrderDistribution = async (req, res, next) => {
  try {
    const validation = validateOrderDistributionQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await analyticsService.getOrderDistribution(validation.sanitized);

    return sendSuccess(res, 200, 'Order value distribution retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve customer acquisition and retention trends
 */
export const getCustomerTrends = async (req, res, next) => {
  try {
    const validation = validateCustomerTrendsQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await analyticsService.getCustomerTrends(validation.sanitized);

    return sendSuccess(res, 200, 'Customer trends retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve high-level inventory health summary metrics
 */
export const getInventorySummary = async (req, res, next) => {
  try {
    const data = await analyticsService.getInventorySummary();
    return sendSuccess(res, 200, 'Inventory summary retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve variant-level inventory health records
 */
export const getInventoryHealth = async (req, res, next) => {
  try {
    const validation = validateInventoryHealthQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await analyticsService.getInventoryHealth(validation.sanitized);

    return sendSuccess(res, 200, 'Inventory health retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve operational low-stock variants
 */
export const getLowStock = async (req, res, next) => {
  try {
    const validation = validateLowStockQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await analyticsService.getLowStockVariants(validation.sanitized);

    return sendSuccess(res, 200, 'Low-stock inventory retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve operational out-of-stock variants
 */
export const getOutOfStock = async (req, res, next) => {
  try {
    const validation = validateOutOfStockQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await analyticsService.getOutOfStockVariants(validation.sanitized);

    return sendSuccess(res, 200, 'Out-of-stock inventory retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve category-level inventory concentration
 */
export const getInventoryConcentration = async (req, res, next) => {
  try {
    const validation = validateInventoryConcentrationQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await analyticsService.getInventoryConcentration(validation.sanitized);

    return sendSuccess(res, 200, 'Inventory concentration retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};
