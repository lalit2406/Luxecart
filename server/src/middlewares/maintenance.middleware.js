import { storeSettingsService } from '../modules/settings/storeSettings.service.js';

/**
 * Maintenance mode middleware.
 * Strictly exempts:
 *  - /api/v1/admin/*
 *  - /api/v1/auth/*
 *  - /api/v1/settings/public
 *  - /api/v1/health
 *
 * When isMaintenanceMode is true, customer storefront mutations (POST, PUT, PATCH, DELETE)
 * and order/checkout operations receive HTTP 503 Service Unavailable with maintenanceMessage.
 */
export async function checkMaintenanceMode(req, res, next) {
  const url = req.originalUrl || req.url || '';

  // Exemption list: Admin panel, authentication, public settings, and health check
  if (
    url.includes('/admin') ||
    url.includes('/auth') ||
    url.includes('/settings/public') ||
    url.includes('/health')
  ) {
    return next();
  }

  try {
    const settings = await storeSettingsService.getPublicStoreSettings();
    if (settings?.maintenance?.isMaintenanceMode) {
      const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
      const isOrderOrCheckout = url.includes('/orders') || url.includes('/checkout');

      if (isMutation || isOrderOrCheckout) {
        return res.status(503).json({
          success: false,
          code: 'MAINTENANCE_MODE',
          message:
            settings.maintenance.maintenanceMessage ||
            'The store is currently undergoing scheduled maintenance. Please check back shortly.',
        });
      }
    }
  } catch (error) {
    // SEC-04: Fail closed for customer commerce mutations if settings cannot be authoritatively verified
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const isOrderOrCheckout = url.includes('/orders') || url.includes('/checkout');
    if (isMutation || isOrderOrCheckout) {
      return res.status(503).json({
        success: false,
        code: 'MAINTENANCE_MODE_CHECK_FAILED',
        message: 'Store service is temporarily unavailable. Please try again shortly.',
      });
    }
  }

  return next();
}
