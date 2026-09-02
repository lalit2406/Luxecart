import couponService from './coupon.service.js';
import { validateCustomerValidateCoupon } from '../../validators/coupon.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Customer: Validate coupon code against active cart
 */
export const validateCustomerCoupon = async (req, res, next) => {
  try {
    const validation = validateCustomerValidateCoupon(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const result = await couponService.validateAndCalculateCoupon(validation.sanitized.code, {
      userId: req.user.id,
    });

    return sendSuccess(res, 200, 'Coupon validated successfully', result);
  } catch (error) {
    next(error);
  }
};
