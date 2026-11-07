import { Router } from 'express';
import { validateCustomerCoupon } from './coupon.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { couponValidationRateLimiter } from '../../middlewares/rateLimiter.middleware.js';

const router = Router();

// Customer coupon validation endpoint (requires rate limiting & authentication)
router.post('/validate', couponValidationRateLimiter, authenticate, validateCustomerCoupon);

export default router;
