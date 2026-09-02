import { Router } from 'express';
import {
  createReturn,
  getMyReturns,
  getReturnByNumber,
} from './return.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// All customer return routes require authentication
router.use(authenticate);

// Create a return request (with orderNumber in body or param)
router.post('/', createReturn);
router.post('/orders/:orderNumber', createReturn);

// List customer returns
router.get('/', getMyReturns);

// Get customer return details by returnNumber
router.get('/:returnNumber', getReturnByNumber);

export default router;
