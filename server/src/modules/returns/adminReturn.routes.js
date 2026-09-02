import { Router } from 'express';
import {
  getAdminReturns,
  getAdminReturnByNumber,
  updateReturnStatus,
} from './adminReturn.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all admin return routes
router.use(authenticate, requireRole('ADMIN'));

router.get('/', getAdminReturns);
router.get('/:returnNumber', getAdminReturnByNumber);
router.patch('/:returnNumber/status', updateReturnStatus);

export default router;
