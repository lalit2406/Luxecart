import { Router } from 'express';
import {
  getAdminOrders,
  getAdminOrderByNumber,
  updateOrderStatus,
} from './adminOrder.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// All admin order endpoints require an authenticated administrator session
router.use(authenticate, requireRole('ADMIN'));

router.get('/', getAdminOrders);
router.get('/:orderNumber', getAdminOrderByNumber);
router.patch('/:orderNumber/status', updateOrderStatus);

export default router;
