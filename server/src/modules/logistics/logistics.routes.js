import { Router } from 'express';
import {
  getOrderTracking,
  getOrderNotifications,
} from './logistics.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Customer tracking and simulated notification routes
router.use(authenticate);

router.get('/:orderNumber/tracking', getOrderTracking);
router.get('/:orderNumber/notifications', getOrderNotifications);

export default router;
