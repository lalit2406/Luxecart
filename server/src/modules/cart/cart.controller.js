import cartService from './cart.service.js';
import {
  validateAddToCart,
  validateUpdateCartItem,
  validateCartItemId,
  validateMergeCart,
} from '../../validators/cart.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Get current customer's hydrated cart
 */
export const getCart = async (req, res, next) => {
  try {
    const cart = await cartService.getCart(req.user.id);
    return sendSuccess(res, 200, 'Cart fetched successfully', cart);
  } catch (error) {
    next(error);
  }
};

/**
 * Add a product variant to cart
 */
export const addItem = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateAddToCart(req.body);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const cart = await cartService.addItem(
      req.user.id,
      sanitized.productId,
      sanitized.variantId,
      sanitized.quantity
    );

    return sendSuccess(res, 200, 'Item added to cart successfully', cart);
  } catch (error) {
    next(error);
  }
};

/**
 * Update cart item quantity by cartItemId
 */
export const updateItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { isValid, errors, sanitized } = validateUpdateCartItem(itemId, req.body);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const cart = await cartService.updateItem(
      req.user.id,
      sanitized.itemId,
      sanitized.quantity
    );

    return sendSuccess(res, 200, 'Cart item updated successfully', cart);
  } catch (error) {
    next(error);
  }
};

/**
 * Remove cart item by cartItemId
 */
export const removeItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { isValid, errors } = validateCartItemId(itemId);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const cart = await cartService.removeItem(req.user.id, itemId);
    return sendSuccess(res, 200, 'Cart item removed successfully', cart);
  } catch (error) {
    next(error);
  }
};

/**
 * Clear all items from customer cart
 */
export const clearCart = async (req, res, next) => {
  try {
    const cart = await cartService.clearCart(req.user.id);
    return sendSuccess(res, 200, 'Cart cleared successfully', cart);
  } catch (error) {
    next(error);
  }
};

/**
 * Merge anonymous guest cart items into customer cart
 */
export const mergeCart = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateMergeCart(req.body);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const result = await cartService.mergeGuestCart(req.user.id, sanitized.items);
    return sendSuccess(res, 200, 'Guest cart merged successfully', result);
  } catch (error) {
    next(error);
  }
};
