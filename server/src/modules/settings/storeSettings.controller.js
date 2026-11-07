import { storeSettingsService } from './storeSettings.service.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Public controller to retrieve customer-facing store settings
 */
export const getPublicSettings = async (req, res, next) => {
  try {
    const settings = await storeSettingsService.getPublicStoreSettings();
    return sendSuccess(res, 200, 'Store settings retrieved successfully', settings);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin controller to retrieve full store settings
 */
export const getAdminSettings = async (req, res, next) => {
  try {
    const settings = await storeSettingsService.getAdminStoreSettings();
    return sendSuccess(res, 200, 'Admin store settings retrieved successfully', settings);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin controller to update store settings
 */
export const updateSettings = async (req, res, next) => {
  try {
    const adminUserId = req.user?.id || req.user?._id;
    const updatedSettings = await storeSettingsService.updateStoreSettings(req.body, adminUserId);
    return sendSuccess(res, 200, 'Store settings updated successfully', updatedSettings);
  } catch (error) {
    next(error);
  }
};
