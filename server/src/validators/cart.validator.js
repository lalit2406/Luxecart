import mongoose from 'mongoose';

/**
 * Validate Add Item to Cart payload
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[], sanitized: { productId: mongoose.Types.ObjectId, variantId: mongoose.Types.ObjectId, quantity: number } }}
 */
export const validateAddToCart = (data = {}) => {
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

/**
 * Validate Update Cart Item Quantity payload
 * @param {string} itemId
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[], sanitized: { itemId: string, quantity: number } }}
 */
export const validateUpdateCartItem = (itemId, data = {}) => {
  const errors = [];
  const { quantity } = data;

  if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
    errors.push('Valid cart itemId is required');
  }

  const parsedQty = Number(quantity);
  if (quantity === undefined || quantity === null || !Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 10) {
    errors.push('Quantity must be an integer between 1 and 10');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      itemId: String(itemId),
      quantity: parsedQty,
    },
  };
};

/**
 * Validate Cart Item ID parameter
 * @param {string} itemId
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export const validateCartItemId = (itemId) => {
  const errors = [];
  if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
    errors.push('Valid cart itemId is required');
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate Guest Cart Merge payload
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[], sanitized: { items: Array<{ productId: mongoose.Types.ObjectId, variantId: mongoose.Types.ObjectId, quantity: number }> } }}
 */
export const validateMergeCart = (data = {}) => {
  const errors = [];
  const { items } = data;

  if (!items || !Array.isArray(items)) {
    errors.push('Items array is required for cart merge');
    return {
      isValid: false,
      errors,
      sanitized: { items: [] },
    };
  }

  if (items.length > 20) {
    errors.push('Cannot merge more than 20 items at once');
    return {
      isValid: false,
      errors,
      sanitized: { items: [] },
    };
  }

  const sanitizedItems = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    if (!item || typeof item !== 'object') {
      errors.push(`Item at index ${idx} must be a valid object`);
      continue;
    }

    const { productId, variantId, quantity } = item;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      errors.push(`Item at index ${idx} has an invalid productId`);
    }

    if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
      errors.push(`Item at index ${idx} has an invalid variantId`);
    }

    let parsedQty = 1;
    if (quantity !== undefined && quantity !== null) {
      parsedQty = Number(quantity);
      if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 10) {
        errors.push(`Item at index ${idx} quantity must be an integer between 1 and 10`);
      }
    }

    if (errors.length === 0) {
      sanitizedItems.push({
        productId: new mongoose.Types.ObjectId(productId),
        variantId: new mongoose.Types.ObjectId(variantId),
        quantity: parsedQty,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      items: sanitizedItems,
    },
  };
};
