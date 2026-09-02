import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';
import {
  getSummary,
  getSalesTrends,
  getProductPerformance,
  getCategoryPerformance,
  getCustomerPerformance,
  getOrderDistribution,
  getCustomerTrends,
  getInventorySummary,
  getInventoryHealth,
  getLowStock,
  getOutOfStock,
  getInventoryConcentration,
} from './analytics.controller.js';

const router = Router();

// All analytics endpoints are strictly admin-only and read-only
router.use(authenticate, requireRole('ADMIN'));

router.get('/summary', getSummary);
router.get('/sales-trends', getSalesTrends);
router.get('/products', getProductPerformance);
router.get('/categories', getCategoryPerformance);
router.get('/customers', getCustomerPerformance);
router.get('/order-distribution', getOrderDistribution);
router.get('/customer-trends', getCustomerTrends);

router.get('/inventory-summary', getInventorySummary);
router.get('/inventory-health', getInventoryHealth);
router.get('/low-stock', getLowStock);
router.get('/out-of-stock', getOutOfStock);
router.get('/inventory-concentration', getInventoryConcentration);

export default router;
