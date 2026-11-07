import { Router } from 'express';
import {
  exportOrders,
  exportCustomers,
  exportProducts,
  exportCoupons,
  exportReturns,
  exportSalesSummary,
} from './adminExport.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// All export endpoints require an authenticated administrator session
router.use(authenticate, requireRole('ADMIN'));

router.get('/orders', exportOrders);
router.get('/customers', exportCustomers);
router.get('/products', exportProducts);
router.get('/coupons', exportCoupons);
router.get('/returns', exportReturns);
router.get('/sales-summary', exportSalesSummary);

export default router;
