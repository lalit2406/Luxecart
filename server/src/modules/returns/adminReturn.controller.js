import returnService from './return.service.js';
import {
  validateAdminReturnQuery,
  validateAdminReturnStatusUpdate,
} from '../../validators/return.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * List all customer returns with search, status filtering, and metrics for the admin dashboard
 */
export const getAdminReturns = async (req, res, next) => {
  try {
    const validation = validateAdminReturnQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const result = await returnService.getAdminReturns(validation.sanitized);
    return sendSuccess(res, 200, 'Admin returns retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get full return detail record by returnNumber for the admin dashboard
 */
export const getAdminReturnByNumber = async (req, res, next) => {
  try {
    const { returnNumber } = req.params;
    const returnRecord = await returnService.getAdminReturnByNumber(returnNumber);
    return sendSuccess(res, 200, 'Admin return record retrieved successfully', {
      return: returnRecord,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update return status with server-authoritative state machine validation
 */
export const updateReturnStatus = async (req, res, next) => {
  try {
    const { returnNumber } = req.params;
    const validation = validateAdminReturnStatusUpdate(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const updatedReturn = await returnService.updateAdminReturnStatus(
      returnNumber,
      validation.sanitized,
      req.user.id
    );

    return sendSuccess(res, 200, 'Return status updated successfully', {
      return: updatedReturn,
    });
  } catch (error) {
    next(error);
  }
};
