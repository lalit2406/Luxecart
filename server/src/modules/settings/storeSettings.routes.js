import { Router } from 'express';
import {
  getPublicSettings,
  getAdminSettings,
  updateSettings,
} from './storeSettings.controller.js';
import { authenticate, requireRole } from '../../middlewares/auth.middleware.js';

const publicRouter = Router();
const adminRouter = Router();

// Public endpoints (no authentication required)
publicRouter.get('/public', getPublicSettings);

// Admin endpoints (strictly guarded by authenticate & requireRole('ADMIN'))
adminRouter.use(authenticate, requireRole('ADMIN'));
adminRouter.get('/', getAdminSettings);
adminRouter.patch('/', updateSettings);

export { adminRouter as adminStoreSettingsRouter };
export default publicRouter;
