import contentService from './content.service.js';
import {
  validateCreateContent,
  validateUpdateContent,
  validateToggleContent,
  validateReorderContent,
  validateAdminContentQuery,
} from '../../validators/content.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Public: Retrieve active, scheduled storefront homepage sections
 */
export const getPublicHomepageContent = async (req, res, next) => {
  try {
    const data = await contentService.getPublicHomepageContent();
    return sendSuccess(res, 200, 'Homepage content retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Retrieve paginated list of all content items
 */
export const getAdminContentList = async (req, res, next) => {
  try {
    const validation = validateAdminContentQuery(req.query);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await contentService.getAdminContentList(validation.sanitized);
    return sendSuccess(res, 200, 'Admin content list retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Retrieve a single content item by ID
 */
export const getContentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await contentService.getContentById(id);
    return sendSuccess(res, 200, 'Content retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new content item
 */
export const createContent = async (req, res, next) => {
  try {
    const validation = validateCreateContent(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await contentService.createContent(validation.sanitized, req.user);
    return sendSuccess(res, 201, 'Content created successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update an existing content item
 */
export const updateContent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validation = validateUpdateContent(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await contentService.updateContent(id, validation.sanitized, req.user);
    return sendSuccess(res, 200, 'Content updated successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Toggle active state of a content item
 */
export const toggleContentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validation = validateToggleContent(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await contentService.toggleContentStatus(id, validation.sanitized.isActive, req.user);
    return sendSuccess(res, 200, 'Content status updated successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete a content item
 */
export const deleteContent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await contentService.deleteContent(id);
    return sendSuccess(res, 200, 'Content deleted successfully', data);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Reorder content items sequentially
 */
export const reorderContent = async (req, res, next) => {
  try {
    const validation = validateReorderContent(req.body);
    if (!validation.isValid) {
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = validation.errors;
      throw error;
    }

    const data = await contentService.reorderContent(
      validation.sanitized.orderedIds,
      validation.sanitized.type,
      req.user
    );
    return sendSuccess(res, 200, 'Content reordered successfully', data);
  } catch (error) {
    next(error);
  }
};
