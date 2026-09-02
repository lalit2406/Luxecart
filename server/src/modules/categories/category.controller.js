import categoryService from './category.service.js';
import { validateCategoryCreate, validateCategoryUpdate } from '../../validators/category.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Public: Get full active category tree
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.getCategoryTree(false);
    return sendSuccess(res, 200, 'Categories fetched successfully', { categories });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get single category by slug with children
 */
export const getCategoryBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const category = await categoryService.getCategoryBySlug(slug);
    return sendSuccess(res, 200, 'Category fetched successfully', { category });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create category
 */
export const createCategory = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateCategoryCreate(req.body);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const category = await categoryService.createCategory(sanitized);
    return sendSuccess(res, 201, 'Category created successfully', { category });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update category
 */
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isValid, errors, sanitized } = validateCategoryUpdate(req.body);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const category = await categoryService.updateCategory(id, sanitized);
    return sendSuccess(res, 200, 'Category updated successfully', { category });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Archive category (soft delete)
 */
export const archiveCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await categoryService.archiveCategory(id);
    return sendSuccess(res, 200, 'Category archived successfully', { category });
  } catch (error) {
    next(error);
  }
};
