import { Router } from 'express';
import {
  getProductReviews,
  getMyReview,
  createReview,
  updateMyReview,
  deleteMyReview,
} from './review.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router({ mergeParams: true });

// Public: Get reviews for a specific product
router.get('/', getProductReviews);

// Authenticated Customer Review Endpoints
router.get('/my-review', authenticate, getMyReview);
router.post('/', authenticate, createReview);
router.put('/my-review', authenticate, updateMyReview);
router.delete('/my-review', authenticate, deleteMyReview);

export default router;
