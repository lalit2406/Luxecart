import { Router } from 'express';
import {
  getProducts,
  getProductBySlug,
  getFeaturedProducts,
  getNewArrivals,
  createProduct,
  updateProduct,
  updateProductStatus,
  addVariant,
  updateVariant,
  deleteVariant,
  getAdminProducts,
  getAdminProductById,
  uploadProductMedia,
  setPrimaryProductMedia,
  reorderProductMedia,
  deleteProductMedia,
} from './product.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import { handleMediaUpload } from '../../middlewares/upload.middleware.js';

const router = Router();

// Public Catalog Routes
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/new-arrivals', getNewArrivals);
router.get('/:slug', getProductBySlug);

// Admin Product Routes
export const adminProductRouter = Router();
adminProductRouter.use(authenticate, requireRole('ADMIN'));
adminProductRouter.get('/', getAdminProducts);
adminProductRouter.get('/:id', getAdminProductById);
adminProductRouter.post('/', createProduct);
adminProductRouter.patch('/:id', updateProduct);
adminProductRouter.patch('/:id/status', updateProductStatus);
adminProductRouter.post('/:id/variants', addVariant);
adminProductRouter.patch('/:id/variants/:variantId', updateVariant);
adminProductRouter.delete('/:id/variants/:variantId', deleteVariant);

// Media Management Routes (Phase 5B)
adminProductRouter.post('/:id/media', handleMediaUpload('images', 10), uploadProductMedia);
adminProductRouter.patch('/:id/media/:mediaId/primary', setPrimaryProductMedia);
adminProductRouter.patch('/:id/media/order', reorderProductMedia);
adminProductRouter.delete('/:id/media/:mediaId', deleteProductMedia);

export default router;
