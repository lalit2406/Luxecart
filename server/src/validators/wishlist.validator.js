import mongoose from 'mongoose';

/**
 * Validate Add Item to Wishlist payload
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[], sanitized: { productId: mongoose.Types.ObjectId, preferredVariantId: mongoose.Types.ObjectId | null } }}
 */
export const validateAddToWishlist = (data = {}) => {
  const errors = [];
  const { productId, preferredVariantId } = data;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    errors.push('Valid productId is required');
  }

  let sanitizedPreferredVariantId = null;
  if (preferredVariantId !== undefined && preferredVariantId !== null && preferredVariantId !== '') {
    if (!mongoose.Types.ObjectId.isValid(preferredVariantId)) {
      errors.push('Invalid preferredVariantId');
    } else {
      sanitizedPreferredVariantId = new mongoose.Types.ObjectId(preferredVariantId);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      productId: productId && mongoose.Types.ObjectId.isValid(productId) ? new mongoose.Types.ObjectId(productId) : null,
      preferredVariantId: sanitizedPreferredVariantId,
    },
  };
};

/**
 * Validate Product ID parameter
 * @param {string} productId
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export const validateProductIdParam = (productId) => {
  const errors = [];
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    errors.push('Valid productId is required');
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate Move to Cart payload
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[], sanitized: { productId: mongoose.Types.ObjectId, variantId: mongoose.Types.ObjectId, quantity: number } }}
 */
export const validateMoveToCart = (data = {}) => {
  const errors = [];
  const { productId, variantId, quantity } = data;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    errors.push('Valid productId is required');
  }

  if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
    errors.push('Valid variantId is required');
  }

  let sanitizedQty = 1;
  if (quantity !== undefined && quantity !== null) {
    const parsedQty = Number(quantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 10) {
      errors.push('Quantity must be an integer between 1 and 10');
    } else {
      sanitizedQty = parsedQty;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      productId: productId && mongoose.Types.ObjectId.isValid(productId) ? new mongoose.Types.ObjectId(productId) : null,
      variantId: variantId && mongoose.Types.ObjectId.isValid(variantId) ? new mongoose.Types.ObjectId(variantId) : null,
      quantity: sanitizedQty,
    },
  };
};
