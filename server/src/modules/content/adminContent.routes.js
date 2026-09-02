import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import {
  getAdminContentList,
  getContentById,
  createContent,
  updateContent,
  toggleContentStatus,
  deleteContent,
  reorderContent,
} from './content.controller.js';

const router = Router();

// All Admin Content routes require authentication & ADMIN role
router.use(authenticate, requireRole('ADMIN'));

router.get('/', getAdminContentList);
router.post('/', createContent);
router.put('/reorder', reorderContent);
router.get('/:id', getContentById);
router.put('/:id', updateContent);
router.patch('/:id/toggle', toggleContentStatus);
router.delete('/:id', deleteContent);

export default router;
