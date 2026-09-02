import { Router } from 'express';
import {
  placeCodOrder,
  getOrderByNumber,
  getMyOrders,
} from './order.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// All order endpoints require authenticated customer session
router.use(authenticate);

router.post('/', placeCodOrder);
router.get('/', getMyOrders);
router.get('/:orderNumber', getOrderByNumber);

export default router;
