import reviewService from './review.service.js';
import {
  validateAdminReviewQuery,
  validateModerateReviewStatus,
} from '../../validators/review.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Admin: List reviews across catalog with moderation filters and metrics
 */
export const getAdminReviews = async (req, res, next) => {
  try {
    const validation = validateAdminReviewQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const result = await reviewService.getAdminReviews(validation.sanitized);
    return sendSuccess(res, 200, 'Admin reviews retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update review moderation status (APPROVED, HIDDEN, REJECTED)
 */
export const updateReviewStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validation = validateModerateReviewStatus(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const review = await reviewService.updateReviewStatus(id, validation.sanitized.status);
    return sendSuccess(res, 200, 'Review status updated successfully', { review });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Hard delete review
 */
export const deleteReviewByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    await reviewService.deleteReviewByAdmin(id);
    return sendSuccess(res, 200, 'Review deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
