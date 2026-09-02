const GUEST_CART_KEY = 'luxecart_guest_cart';

/**
 * Sanitize raw items array from localStorage
 * Supports both new snapshot format and backwards-compatible minimalist format.
 * @param {any} rawItems
 * @returns {Array<object>}
 */
const sanitizeItems = (rawItems) => {
  if (!Array.isArray(rawItems)) return [];

  const validMap = new Map();

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;

    const productId = typeof item.productId === 'string' ? item.productId.trim() : null;
    const variantId = typeof item.variantId === 'string' ? item.variantId.trim() : null;
    let quantity = Number(item.quantity);

    if (!productId || !variantId || !Number.isInteger(quantity) || quantity < 1) {
      continue;
    }

    quantity = Math.min(quantity, 10);
    const key = `${productId}_${variantId}`;

    const price = typeof item.price === 'number' && item.price >= 0 ? item.price : 0;
    const mrp = typeof item.mrp === 'number' && item.mrp >= 0 ? item.mrp : price;
    const discountPercent =
      typeof item.discountPercent === 'number'
        ? item.discountPercent
        : mrp > price
        ? Math.round(((mrp - price) / mrp) * 100)
        : 0;

    const sanitizedItem = {
      productId,
      variantId,
      quantity,
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'LuxeCart Piece',
      slug: typeof item.slug === 'string' ? item.slug.trim() : '',
      brand: typeof item.brand === 'string' && item.brand.trim() ? item.brand.trim() : 'LuxeCart',
      sku: typeof item.sku === 'string' && item.sku.trim() ? item.sku.trim() : 'UNKNOWN',
      image: typeof item.image === 'string' ? item.image.trim() : '',
      price,
      mrp,
      discountPercent,
      selectedAttributes: item.selectedAttributes && typeof item.selectedAttributes === 'object' ? item.selectedAttributes : {},
      isAvailable: item.isAvailable !== false,
      itemSubtotal: price * quantity,
      warnings: Array.isArray(item.warnings) ? item.warnings : [],
      reason: item.reason || null,
    };

    if (validMap.has(key)) {
      const existing = validMap.get(key);
      existing.quantity = Math.min(existing.quantity + quantity, 10);
      existing.itemSubtotal = existing.price * existing.quantity;
    } else {
      validMap.set(key, sanitizedItem);
    }
  }

  return Array.from(validMap.values());
};

/**
 * Retrieve sanitized guest cart from localStorage
 * @returns {Array<object>}
 */
export const getGuestCart = () => {
  try {
    const data = localStorage.getItem(GUEST_CART_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return sanitizeItems(parsed);
  } catch {
    return [];
  }
};

/**
 * Save sanitized guest cart to localStorage
 * @param {Array<object>} items
 */
export const saveGuestCart = (items) => {
  try {
    const sanitized = sanitizeItems(items);
    if (sanitized.length === 0) {
      localStorage.removeItem(GUEST_CART_KEY);
    } else {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch {
    return [];
  }
};

/**
 * Add or increment item in guest cart with display snapshot
 * @param {string} productId
 * @param {string} variantId
 * @param {number} [quantity=1]
 * @param {object} [metadata={}]
 * @returns {Array<object>}
 */
export const addGuestCartItem = (productId, variantId, quantity = 1, metadata = {}) => {
  const current = getGuestCart();
  const validQty = Number.isInteger(Number(quantity)) && Number(quantity) >= 1 ? Number(quantity) : 1;

  const existing = current.find(
    (item) => item.productId === productId && item.variantId === variantId
  );

  if (existing) {
    existing.quantity = Math.min(existing.quantity + validQty, 10);
    existing.itemSubtotal = existing.price * existing.quantity;
    if (metadata && typeof metadata === 'object') {
      if (metadata.name) existing.name = metadata.name;
      if (metadata.image) existing.image = metadata.image;
      if (metadata.price !== undefined) existing.price = metadata.price;
      if (metadata.mrp !== undefined) existing.mrp = metadata.mrp;
      if (metadata.sku) existing.sku = metadata.sku;
      if (metadata.selectedAttributes) existing.selectedAttributes = metadata.selectedAttributes;
    }
  } else {
    const price = typeof metadata.price === 'number' ? metadata.price : 0;
    const mrp = typeof metadata.mrp === 'number' ? metadata.mrp : price;
    const discountPercent =
      typeof metadata.discountPercent === 'number'
        ? metadata.discountPercent
        : mrp > price
        ? Math.round(((mrp - price) / mrp) * 100)
        : 0;

    current.push({
      productId,
      variantId,
      quantity: Math.min(validQty, 10),
      name: metadata.name || 'LuxeCart Piece',
      slug: metadata.slug || '',
      brand: metadata.brand || 'LuxeCart',
      sku: metadata.sku || 'UNKNOWN',
      image: metadata.image || '',
      price,
      mrp,
      discountPercent,
      selectedAttributes: metadata.selectedAttributes || {},
      isAvailable: true,
      itemSubtotal: price * Math.min(validQty, 10),
      warnings: [],
      reason: null,
    });
  }

  return saveGuestCart(current);
};

/**
 * Update quantity for specific variant in guest cart
 * @param {string} variantId
 * @param {number} quantity
 * @returns {Array<object>}
 */
export const updateGuestCartItem = (variantId, quantity) => {
  const current = getGuestCart();
  const validQty = Number.isInteger(Number(quantity)) ? Number(quantity) : 1;

  if (validQty <= 0) {
    return removeGuestCartItem(variantId);
  }

  const existing = current.find((item) => item.variantId === variantId);
  if (existing) {
    existing.quantity = Math.min(validQty, 10);
    existing.itemSubtotal = existing.price * existing.quantity;
  }

  return saveGuestCart(current);
};

/**
 * Remove specific variant from guest cart
 * @param {string} variantId
 * @returns {Array<object>}
 */
export const removeGuestCartItem = (variantId) => {
  const current = getGuestCart();
  const filtered = current.filter((item) => item.variantId !== variantId);
  return saveGuestCart(filtered);
};

/**
 * Clear guest cart from localStorage
 */
export const clearGuestCart = () => {
  try {
    localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    // Ignore storage errors
  }
};

