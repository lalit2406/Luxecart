import { Router } from 'express';
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  archiveCategory,
} from './category.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// Public Routes
router.get('/', getCategories);
router.get('/:slug', getCategoryBySlug);

// Admin Routes (Can be mounted directly or under /admin/categories)
export const adminCategoryRouter = Router();
adminCategoryRouter.use(authenticate, requireRole('ADMIN'));
adminCategoryRouter.post('/', createCategory);
adminCategoryRouter.patch('/:id', updateCategory);
adminCategoryRouter.delete('/:id', archiveCategory);

export default router;
