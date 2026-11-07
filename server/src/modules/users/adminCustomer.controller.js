import adminCustomerService from './adminCustomer.service.js';
import {
  validateAdminCustomerQuery,
  validateCustomerOrdersQuery,
  validateUpdateCustomerStatus,
} from '../../validators/adminCustomer.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * List customers with pagination, search, status filtering, and order metrics
 */
export const getCustomers = async (req, res, next) => {
  try {
    const validation = validateAdminCustomerQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const result = await adminCustomerService.getCustomers(validation.sanitized);
    return sendSuccess(res, 200, 'Customers retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get customer profile, addresses, order summary metrics, and status history
 */
export const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminCustomerService.getCustomerById(id);
    return sendSuccess(res, 200, 'Customer retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get customer's paginated order history
 */
export const getCustomerOrders = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validation = validateCustomerOrdersQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const result = await adminCustomerService.getCustomerOrders(id, validation.sanitized);
    return sendSuccess(res, 200, 'Customer orders retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Update customer status (ACTIVE or SUSPENDED)
 */
export const updateCustomerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validation = validateUpdateCustomerStatus(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const customer = await adminCustomerService.updateCustomerStatus(
      id,
      validation.sanitized,
      req.user.id
    );

    return sendSuccess(res, 200, 'Customer status updated successfully', { customer });
  } catch (error) {
    next(error);
  }
};
