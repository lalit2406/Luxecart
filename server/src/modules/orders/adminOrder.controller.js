import orderService from './order.service.js';
import {
  validateAdminOrderQuery,
  validateUpdateOrderStatus,
} from '../../validators/adminOrder.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * List all customer orders with search, status filtering, and metrics for the admin dashboard
 */
export const getAdminOrders = async (req, res, next) => {
  try {
    const validation = validateAdminOrderQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const result = await orderService.getAdminOrders(validation.sanitized);
    return sendSuccess(res, 200, 'Admin orders retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get full order detail snapshot by orderNumber for the admin dashboard
 */
export const getAdminOrderByNumber = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const order = await orderService.getAdminOrderByNumber(orderNumber);
    return sendSuccess(res, 200, 'Admin order retrieved successfully', { order });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status with server-authoritative state machine validation
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const validation = validateUpdateOrderStatus(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const order = await orderService.updateOrderStatus(
      orderNumber,
      validation.sanitized,
      req.user.id
    );

    return sendSuccess(res, 200, 'Order status updated successfully', { order });
  } catch (error) {
    next(error);
  }
};
