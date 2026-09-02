import couponService from './coupon.service.js';
import {
  validateCreateCoupon,
  validateUpdateCoupon,
  validateAdminCouponQuery,
  validateToggleCouponStatus,
} from '../../validators/coupon.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Admin: List coupons with filters and usage metrics
 */
export const getAdminCoupons = async (req, res, next) => {
  try {
    const validation = validateAdminCouponQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const result = await couponService.getAdminCoupons(validation.sanitized);
    return sendSuccess(res, 200, 'Admin coupons retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new promotional coupon
 */
export const createAdminCoupon = async (req, res, next) => {
  try {
    const validation = validateCreateCoupon(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const coupon = await couponService.createCoupon(validation.sanitized);
    return sendSuccess(res, 201, 'Coupon created successfully', { coupon });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get coupon by ID
 */
export const getAdminCouponById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const coupon = await couponService.getCouponById(id);
    return sendSuccess(res, 200, 'Coupon retrieved successfully', { coupon });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update existing coupon
 */
export const updateAdminCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validation = validateUpdateCoupon(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const coupon = await couponService.updateCoupon(id, validation.sanitized);
    return sendSuccess(res, 200, 'Coupon updated successfully', { coupon });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Toggle coupon active/inactive status
 */
export const toggleAdminCouponStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validation = validateToggleCouponStatus(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const coupon = await couponService.toggleCouponStatus(id, validation.sanitized.isActive);
    return sendSuccess(res, 200, 'Coupon status updated successfully', { coupon });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete coupon
 */
export const deleteAdminCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    await couponService.deleteCoupon(id);
    return sendSuccess(res, 200, 'Coupon deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
