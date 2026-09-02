import { Router } from 'express';
import { sendSuccess } from '../utils/response.js';
import { getDBStatus } from '../config/database.js';
import { config } from '../config/env.js';
import authRoutes from '../modules/auth/auth.routes.js';
import categoryRoutes, { adminCategoryRouter } from '../modules/categories/category.routes.js';
import productRoutes, { adminProductRouter } from '../modules/products/product.routes.js';
import cartRoutes from '../modules/cart/cart.routes.js';
import wishlistRoutes from '../modules/wishlist/wishlist.routes.js';
import importRoutes from '../modules/import/import.routes.js';
import addressRoutes from '../modules/addresses/address.routes.js';
import checkoutRoutes from '../modules/checkout/checkout.routes.js';
import orderRoutes from '../modules/orders/order.routes.js';
import adminOrderRoutes from '../modules/orders/adminOrder.routes.js';
import reviewRoutes from '../modules/reviews/review.routes.js';
import adminReviewRoutes from '../modules/reviews/adminReview.routes.js';
import couponRoutes from '../modules/coupons/coupon.routes.js';
import adminCouponRoutes from '../modules/coupons/adminCoupon.routes.js';
import returnRoutes from '../modules/returns/return.routes.js';
import adminReturnRoutes from '../modules/returns/adminReturn.routes.js';
import supportRoutes from '../modules/support/support.routes.js';
import adminSupportRoutes from '../modules/support/adminSupport.routes.js';
import analyticsRoutes from '../modules/analytics/analytics.routes.js';
import contentRoutes from '../modules/content/content.routes.js';
import adminContentRoutes from '../modules/content/adminContent.routes.js';
import seoRoutes from '../modules/seo/seo.routes.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @route GET /api/v1/health
 * @desc  Backend & Database health check endpoint
 */
router.get('/health', (req, res) => {
  const db = getDBStatus();
  const isHealthy = db.isConnected;

  const payload = {
    status: isHealthy ? 'healthy' : 'degraded',
    database: db.status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  };

  if (isHealthy) {
    return sendSuccess(res, 200, 'LuxeCart API is operational', payload);
  }

  return res.status(503).json({
    success: false,
    message: `LuxeCart API is degraded: Database is ${db.status}`,
    data: payload,
  });
});

// Authentication routes
router.use('/auth', authRoutes);

// Public Category, Product Catalog, Reviews & Storefront Content routes
router.use('/categories', categoryRoutes);
router.use('/products/:productId/reviews', reviewRoutes);
router.use('/products', productRoutes);
router.use('/content', contentRoutes);
router.use('/seo', seoRoutes);

// Authenticated Customer Cart, Wishlist, Address, Checkout, Order, Coupon, Return & Support routes
router.use('/cart', cartRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/addresses', addressRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/orders', orderRoutes);
router.use('/coupons', couponRoutes);
router.use('/returns', returnRoutes);
router.use('/support', supportRoutes);

// Protected Admin routes
router.use('/admin/categories', adminCategoryRouter);
router.use('/admin/products/import', importRoutes);
router.use('/admin/products/imports', importRoutes);
router.use('/admin/products', adminProductRouter);
router.use('/admin/orders', adminOrderRoutes);
router.use('/admin/reviews', adminReviewRoutes);
router.use('/admin/coupons', adminCouponRoutes);
router.use('/admin/returns', adminReturnRoutes);
router.use('/admin/support', adminSupportRoutes);
router.use('/admin/analytics', analyticsRoutes);
router.use('/admin/content', adminContentRoutes);

// Phase 2 Admin-only authorization test route
router.get('/admin/test', authenticate, requireRole('ADMIN'), (req, res) => {
  return sendSuccess(res, 200, 'Admin authorized successfully', {
    user: req.user,
  });
});

export default router;
