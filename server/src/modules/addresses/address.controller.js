import addressService from './address.service.js';
import { validateCreateAddress, validateUpdateAddress } from '../../validators/address.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Get all addresses for the authenticated customer
 */
export const getAddresses = async (req, res, next) => {
  try {
    const addresses = await addressService.getAddresses(req.user.id);
    return sendSuccess(res, 200, 'Addresses retrieved successfully', { addresses });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new address for the authenticated customer
 */
export const createAddress = async (req, res, next) => {
  try {
    const validation = validateCreateAddress(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const address = await addressService.createAddress(req.user.id, validation.sanitized);
    return sendSuccess(res, 201, 'Address created successfully', { address });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing address
 */
export const updateAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validation = validateUpdateAddress(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const address = await addressService.updateAddress(req.user.id, id, validation.sanitized);
    return sendSuccess(res, 200, 'Address updated successfully', { address });
  } catch (error) {
    next(error);
  }
};

/**
 * Set address as default
 */
export const setDefaultAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const address = await addressService.setDefaultAddress(req.user.id, id);
    return sendSuccess(res, 200, 'Default address updated successfully', { address });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an address
 */
export const deleteAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await addressService.deleteAddress(req.user.id, id);
    return sendSuccess(res, 200, 'Address deleted successfully', result);
  } catch (error) {
    next(error);
  }
};
