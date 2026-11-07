import { Router } from 'express';
import {
  placeCodOrder,
  getOrderByNumber,
  getMyOrders,
  cancelMyOrder,
} from './order.controller.js';
import {
  getOrderTracking,
  getOrderNotifications,
} from '../logistics/logistics.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { checkoutRateLimiter } from '../../middlewares/rateLimiter.middleware.js';

const router = Router();

// All order endpoints require authenticated customer session
router.use(authenticate);

// Dedicated rate limiter applied only to COD order placement
router.post('/', checkoutRateLimiter, placeCodOrder);
router.get('/', getMyOrders);

// Read-only customer order tracking and simulated notification endpoints
router.get('/:orderNumber/tracking', getOrderTracking);
router.get('/:orderNumber/notifications', getOrderNotifications);

// Customer self-service order cancellation
router.post('/:id/cancel', cancelMyOrder);

router.get('/:orderNumber', getOrderByNumber);

export default router;
