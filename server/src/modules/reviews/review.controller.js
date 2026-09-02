import reviewService from './review.service.js';
import {
  validateCreateReview,
  validateUpdateReview,
  validatePublicReviewQuery,
} from '../../validators/review.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Public: Get reviews for a specific product
 */
export const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const validation = validatePublicReviewQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const result = await reviewService.getProductReviews(productId, validation.sanitized);
    return sendSuccess(res, 200, 'Product reviews retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Get customer's own review for a specific product
 */
export const getMyReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const result = await reviewService.getMyReview(productId, req.user.id);
    return sendSuccess(res, 200, 'Customer review status retrieved', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Submit review for a product
 */
export const createReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const validation = validateCreateReview(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const review = await reviewService.createReview(
      productId,
      validation.sanitized,
      req.user.id
    );

    return sendSuccess(res, 201, 'Review submitted successfully', { review });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Update customer's own review
 */
export const updateMyReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const validation = validateUpdateReview(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const review = await reviewService.updateMyReview(
      productId,
      validation.sanitized,
      req.user.id
    );

    return sendSuccess(res, 200, 'Review updated successfully', { review });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: Delete customer's own review
 */
export const deleteMyReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    await reviewService.deleteMyReview(productId, req.user.id);
    return sendSuccess(res, 200, 'Review deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
