import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  getCustomerOrders,
  updateCustomerStatus,
} from './adminCustomer.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// All admin customer endpoints require an authenticated administrator session
router.use(authenticate, requireRole('ADMIN'));

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.get('/:id/orders', getCustomerOrders);
router.patch('/:id/status', updateCustomerStatus);

export default router;
