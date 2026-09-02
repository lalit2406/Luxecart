import { Router } from 'express';
import {
  getAdminReviews,
  updateReviewStatus,
  deleteReviewByAdmin,
} from './adminReview.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// All admin review endpoints require an authenticated administrator session
router.use(authenticate, requireRole('ADMIN'));

router.get('/', getAdminReviews);
router.patch('/:id/status', updateReviewStatus);
router.delete('/:id', deleteReviewByAdmin);

export default router;
