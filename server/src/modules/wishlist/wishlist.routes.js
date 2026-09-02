import { Router } from 'express';
import {
  getWishlist,
  addItem,
  removeItem,
  clearWishlist,
  moveToCart,
} from './wishlist.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// All wishlist routes require customer authentication
router.use(authenticate);

router.get('/', getWishlist);
router.post('/items', addItem);
router.delete('/items/:productId', removeItem);
router.delete('/', clearWishlist);
router.post('/move-to-cart', moveToCart);

export default router;
