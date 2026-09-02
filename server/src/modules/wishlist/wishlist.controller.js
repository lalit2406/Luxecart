import wishlistService from './wishlist.service.js';
import {
  validateAddToWishlist,
  validateProductIdParam,
  validateMoveToCart,
} from '../../validators/wishlist.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Get current customer's hydrated wishlist
 */
export const getWishlist = async (req, res, next) => {
  try {
    const wishlist = await wishlistService.getWishlist(req.user.id);
    return sendSuccess(res, 200, 'Wishlist fetched successfully', wishlist);
  } catch (error) {
    next(error);
  }
};

/**
 * Add a product to customer's wishlist
 */
export const addItem = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateAddToWishlist(req.body);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const wishlist = await wishlistService.addItem(
      req.user.id,
      sanitized.productId,
      sanitized.preferredVariantId
    );

    return sendSuccess(res, 200, 'Product added to wishlist successfully', wishlist);
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a product from wishlist
 */
export const removeItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { isValid, errors } = validateProductIdParam(productId);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const wishlist = await wishlistService.removeItem(req.user.id, productId);
    return sendSuccess(res, 200, 'Product removed from wishlist successfully', wishlist);
  } catch (error) {
    next(error);
  }
};

/**
 * Clear customer's wishlist
 */
export const clearWishlist = async (req, res, next) => {
  try {
    const wishlist = await wishlistService.clearWishlist(req.user.id);
    return sendSuccess(res, 200, 'Wishlist cleared successfully', wishlist);
  } catch (error) {
    next(error);
  }
};

/**
 * Move a wishlist item to shopping cart
 */
export const moveToCart = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateMoveToCart(req.body);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const result = await wishlistService.moveToCart(
      req.user.id,
      sanitized.productId,
      sanitized.variantId,
      sanitized.quantity
    );

    return sendSuccess(res, 200, 'Item moved to cart successfully', result);
  } catch (error) {
    next(error);
  }
};
