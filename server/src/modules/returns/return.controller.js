import returnService from './return.service.js';
import { validateCreateReturn } from '../../validators/return.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Customer creates a return request for a delivered order
 */
export const createReturn = async (req, res, next) => {
  try {
    const validation = validateCreateReturn(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const orderIdentifier = req.params.orderNumber || validation.sanitized.orderNumber;
    if (!orderIdentifier) {
      const error = new Error('Order number is required to create a return');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const returnDoc = await returnService.createReturn(
      req.user.id,
      orderIdentifier,
      validation.sanitized
    );

    return sendSuccess(res, 201, 'Return request created successfully', {
      return: returnDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer retrieves their list of return requests
 */
export const getMyReturns = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const result = await returnService.getCustomerReturns(req.user.id, {
      page,
      limit,
      status,
    });

    return sendSuccess(res, 200, 'Returns retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Customer retrieves a single return by returnNumber
 */
export const getReturnByNumber = async (req, res, next) => {
  try {
    const { returnNumber } = req.params;
    const returnDoc = await returnService.getCustomerReturnByNumber(
      req.user.id,
      returnNumber
    );

    return sendSuccess(res, 200, 'Return details retrieved successfully', {
      return: returnDoc,
    });
  } catch (error) {
    next(error);
  }
};
