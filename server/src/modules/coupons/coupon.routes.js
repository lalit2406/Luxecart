import { Router } from 'express';
import { validateCustomerCoupon } from './coupon.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Customer coupon validation endpoint (requires authentication)
router.post('/validate', authenticate, validateCustomerCoupon);

export default router;
