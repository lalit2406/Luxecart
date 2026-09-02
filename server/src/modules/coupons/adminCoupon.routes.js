import { Router } from 'express';
import {
  getAdminCoupons,
  createAdminCoupon,
  getAdminCouponById,
  updateAdminCoupon,
  toggleAdminCouponStatus,
  deleteAdminCoupon,
} from './adminCoupon.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all admin coupon endpoints
router.use(authenticate, requireRole('ADMIN'));

router.get('/', getAdminCoupons);
router.post('/', createAdminCoupon);
router.get('/:id', getAdminCouponById);
router.put('/:id', updateAdminCoupon);
router.patch('/:id/status', toggleAdminCouponStatus);
router.delete('/:id', deleteAdminCoupon);

export default router;
