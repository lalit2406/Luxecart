import productService from './product.service.js';
import {
  validateProductInput,
  validateVariantInput,
  validateCatalogQuery,
} from '../../validators/product.validator.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Public: Get paginated and filtered catalog products
 */
export const getProducts = async (req, res, next) => {
  try {
    const parsedQuery = validateCatalogQuery(req.query);
    const result = await productService.getProducts(parsedQuery);
    return sendSuccess(res, 200, 'Products fetched successfully', result.products, {
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get single product by slug
 */
export const getProductBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const product = await productService.getProductBySlug(slug);
    return sendSuccess(res, 200, 'Product details fetched successfully', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get featured products
 */
export const getFeaturedProducts = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '8', 10);
    const products = await productService.getFeaturedProducts(limit);
    return sendSuccess(res, 200, 'Featured products fetched successfully', { products });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get new arrivals
 */
export const getNewArrivals = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '8', 10);
    const products = await productService.getNewArrivals(limit);
    return sendSuccess(res, 200, 'New arrivals fetched successfully', { products });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a product
 */
export const createProduct = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateProductInput(req.body, req.body.status === 'ACTIVE');
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const product = await productService.createProduct(sanitized);
    return sendSuccess(res, 201, 'Product created successfully', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update product details
 */
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isValid, errors, sanitized } = validateProductInput(req.body, false, true);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const product = await productService.updateProduct(id, sanitized);
    return sendSuccess(res, 200, 'Product updated successfully', { product });
  } catch (error) {
    console.error(`[Admin Product Update Error] Product ID: ${req.params?.id} | Error:`, error.message);
    next(error);
  }
};

/**
 * Admin: Update product lifecycle status
 */
export const updateProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(status)) {
      const error = new Error('Invalid status. Must be DRAFT, ACTIVE, or ARCHIVED');
      error.statusCode = 400;
      error.code = 'INVALID_STATUS';
      throw error;
    }

    const product = await productService.updateProductStatus(id, status);
    return sendSuccess(res, 200, `Product status updated to ${status}`, { product });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Add variant to product
 */
export const addVariant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isValid, errors, sanitized } = validateVariantInput(req.body);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const product = await productService.addVariant(id, sanitized);
    return sendSuccess(res, 201, 'Variant added successfully', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update specific variant
 */
export const updateVariant = async (req, res, next) => {
  try {
    const { id, variantId } = req.params;
    const { isValid, errors, sanitized } = validateVariantInput(req.body);
    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const product = await productService.updateVariant(id, variantId, sanitized);
    return sendSuccess(res, 200, 'Variant updated successfully', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete variant
 */
export const deleteVariant = async (req, res, next) => {
  try {
    const { id, variantId } = req.params;
    const product = await productService.deleteVariant(id, variantId);
    return sendSuccess(res, 200, 'Variant removed successfully', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: List all products
 */
export const getAdminProducts = async (req, res, next) => {
  try {
    const result = await productService.getAdminProducts(req.query);
    return sendSuccess(res, 200, 'Admin products fetched successfully', result.products, {
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get product by ID
 */
export const getAdminProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id);
    return sendSuccess(res, 200, 'Product fetched successfully', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Upload media files for product
 */
export const uploadProductMedia = async (req, res, next) => {
  try {
    const { id } = req.params;
    const files = req.files || (req.file ? [req.file] : []);
    const product = await productService.uploadMedia(id, files, req.body);
    return sendSuccess(res, 201, 'Media uploaded successfully', { product });
  } catch (error) {
    console.error(`[Admin Product Media Upload Error] Product ID: ${req.params?.id} | Error:`, error.message);
    next(error);
  }
};

/**
 * Admin: Set primary media image
 */
export const setPrimaryProductMedia = async (req, res, next) => {
  try {
    const { id, mediaId } = req.params;
    const product = await productService.setPrimaryMedia(id, mediaId);
    return sendSuccess(res, 200, 'Primary image updated successfully', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Reorder product media gallery
 */
export const reorderProductMedia = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { images } = req.body;
    const product = await productService.reorderMedia(id, images);
    return sendSuccess(res, 200, 'Media order updated successfully', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete media image from product
 */
export const deleteProductMedia = async (req, res, next) => {
  try {
    const { id, mediaId } = req.params;
    const product = await productService.deleteMedia(id, mediaId);
    return sendSuccess(res, 200, 'Media image deleted successfully', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update media metadata (alt, color tag)
 */
export const updateProductMediaMetadata = async (req, res, next) => {
  try {
    const { id, mediaId } = req.params;
    const product = await productService.updateMediaMetadata(id, mediaId, req.body);
    return sendSuccess(res, 200, 'Media metadata updated successfully', { product });
  } catch (error) {
    next(error);
  }
};


