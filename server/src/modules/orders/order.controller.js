import orderService from './order.service.js';
import { validateCreateOrder } from '../../validators/order.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Place a Cash on Delivery order
 */
export const placeCodOrder = async (req, res, next) => {
  try {
    const validation = validateCreateOrder(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const order = await orderService.placeCodOrder(req.user.id, validation.sanitized);
    return sendSuccess(res, 201, 'Order placed successfully', { order });
  } catch (error) {
    next(error);
  }
};

/**
 * Get order details by orderNumber for authenticated customer
 */
export const getOrderByNumber = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const order = await orderService.getOrderByNumber(req.user.id, orderNumber);
    return sendSuccess(res, 200, 'Order retrieved successfully', { order });
  } catch (error) {
    next(error);
  }
};

/**
 * Get customer's order history
 */
export const getMyOrders = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await orderService.getMyOrders(req.user.id, { page, limit });
    return sendSuccess(res, 200, 'Orders retrieved successfully', {
      orders: result.orders,
      pagination: {
        total: result.total,
        page: result.page,
        pages: result.pages,
      },
    });
  } catch (error) {
    next(error);
  }
};
