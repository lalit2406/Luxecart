import { Router } from 'express';
import {
  getRateQuotes,
  manifestShipment,
  advanceMilestone,
  simulateException,
} from './logistics.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// All admin logistics endpoints require authenticated administrator session
router.use(authenticate, requireRole('ADMIN'));

router.get('/rates/:orderNumber', getRateQuotes);
router.post('/manifest/:orderNumber', manifestShipment);
router.post('/advance-milestone/:orderNumber', advanceMilestone);
router.post('/simulate-exception/:orderNumber', simulateException);

export default router;
