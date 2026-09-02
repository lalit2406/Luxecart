import { Router } from 'express';
import {
  getAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} from './address.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// All customer address routes require authentication
router.use(authenticate);

router.get('/', getAddresses);
router.post('/', createAddress);
router.patch('/:id/default', setDefaultAddress);
router.patch('/:id', updateAddress);
router.delete('/:id', deleteAddress);

export default router;
