import checkoutService from './checkout.service.js';
import { validatePrepareCheckout } from '../../validators/checkout.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Prepare checkout snapshot and validate live items for authenticated customer
 */
export const prepareCheckout = async (req, res, next) => {
  try {
    const validation = validatePrepareCheckout(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const checkout = await checkoutService.prepareCheckout(req.user.id, validation.sanitized);
    return sendSuccess(res, 200, 'Checkout prepared successfully', { checkout });
  } catch (error) {
    next(error);
  }
};
