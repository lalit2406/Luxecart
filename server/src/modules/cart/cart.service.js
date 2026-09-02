import Cart from './cart.model.js';
import Product from '../products/product.model.js';

class CartService {
  /**
   * Helper to retrieve or initialize an empty cart document for a user
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @returns {Promise<Cart>}
   */
  async getOrCreateCart(userId) {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
      await cart.save();
    }
    return cart;
  }

  /**
   * Dynamically hydrate raw cart items from live Product documents
   * @param {Cart} cart
   * @returns {Promise<object>}
   */
  async hydrateCart(cart) {
    if (!cart || !cart.items || cart.items.length === 0) {
      return {
        items: [],
        summary: {
          itemCount: 0,
          totalUnits: 0,
          subtotal: 0,
          totalMrp: 0,
          totalSavings: 0,
          estimatedTax: 0,
          estimatedShipping: 0,
          grandTotal: 0,
          canCheckout: false,
        },
      };
    }

    // Extract product IDs
    const productIds = cart.items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const hydratedItems = [];
    let cartSubtotalPaise = 0;
    let cartMrpSubtotalPaise = 0;
    let totalUnits = 0;
    let allItemsPurchasable = true;

    for (const item of cart.items) {
      const product = productMap.get(item.productId.toString());
      const itemId = item._id.toString();

      // Case 1: Product missing or not active
      if (!product || product.status !== 'ACTIVE') {
        allItemsPurchasable = false;
        hydratedItems.push({
          itemId,
          productId: item.productId.toString(),
          variantId: item.variantId.toString(),
          name: product?.name || 'Unavailable Product',
          slug: product?.slug || '',
          brand: product?.brand || '',
          sku: 'UNKNOWN',
          selectedAttributes: {},
          price: 0,
          mrp: 0,
          discountPercent: 0,
          quantity: item.quantity,
          itemSubtotal: 0,
          image: product?.images?.[0]?.url || '',
          availableStock: 0,
          isAvailable: false,
          reason: 'PRODUCT_ARCHIVED',
          warnings: ['This product is no longer available.'],
        });
        continue;
      }

      // Case 2: Variant missing or inactive within product
      const variant = (product.variants || []).find(
        (v) => v._id?.toString() === item.variantId.toString()
      );

      if (!variant || variant.isActive === false) {
        allItemsPurchasable = false;
        hydratedItems.push({
          itemId,
          productId: product._id.toString(),
          variantId: item.variantId.toString(),
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          sku: variant?.sku || 'UNKNOWN',
          selectedAttributes: variant?.attributes || {},
          price: 0,
          mrp: 0,
          discountPercent: 0,
          quantity: item.quantity,
          itemSubtotal: 0,
          image: product.images?.[0]?.url || '',
          availableStock: 0,
          isAvailable: false,
          reason: 'VARIANT_UNAVAILABLE',
          warnings: ['The selected variant is no longer available.'],
        });
        continue;
      }

      // Case 3: Variant is active -> check stock and calculate prices
      const currentStock = variant.inventory?.stock || 0;
      const price = variant.price;
      const mrp = variant.mrp || price;
      const discountPercent = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

      // Price calculation in integer paise
      const pricePaise = Math.round(price * 100);
      const mrpPaise = Math.round(mrp * 100);
      const itemSubtotalPaise = pricePaise * item.quantity;
      const itemMrpSubtotalPaise = mrpPaise * item.quantity;

      const warnings = [];
      let isAvailable = true;
      let reason = null;

      if (currentStock === 0) {
        isAvailable = false;
        reason = 'OUT_OF_STOCK';
        warnings.push('This item is currently out of stock.');
        allItemsPurchasable = false;
      } else if (currentStock < item.quantity) {
        isAvailable = true; // Still exists, but insufficient quantity
        warnings.push(`Only ${currentStock} units available in stock. Please adjust quantity.`);
        allItemsPurchasable = false;
      }

      if (isAvailable && currentStock >= item.quantity) {
        cartSubtotalPaise += itemSubtotalPaise;
        cartMrpSubtotalPaise += itemMrpSubtotalPaise;
        totalUnits += item.quantity;
      }

      // Determine appropriate image (variant-specific or primary product image)
      const primaryImage =
        product.images?.find((img) => img.isPrimary)?.url ||
        product.images?.[0]?.url ||
        '';
      const variantImage = variant.images?.[0] || primaryImage;

      hydratedItems.push({
        itemId,
        productId: product._id.toString(),
        variantId: variant._id.toString(),
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        sku: variant.sku,
        selectedAttributes: {
          color: variant.attributes?.color || {},
          size: variant.attributes?.size || '',
          custom: variant.attributes?.custom || {},
        },
        price,
        mrp,
        discountPercent,
        quantity: item.quantity,
        itemSubtotal: itemSubtotalPaise / 100,
        image: variantImage,
        availableStock: currentStock,
        isAvailable,
        reason,
        warnings,
      });
    }

    const subtotal = cartSubtotalPaise / 100;
    const totalMrp = cartMrpSubtotalPaise / 100;
    const totalSavings = totalMrp > subtotal ? totalMrp - subtotal : 0;

    return {
      items: hydratedItems,
      summary: {
        itemCount: hydratedItems.length,
        totalUnits,
        subtotal,
        totalMrp,
        totalSavings,
        estimatedTax: 0,
        estimatedShipping: 0,
        grandTotal: subtotal,
        canCheckout: hydratedItems.length > 0 && allItemsPurchasable,
      },
    };
  }

  /**
   * Get customer cart
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @returns {Promise<object>}
   */
  async getCart(userId) {
    const cart = await this.getOrCreateCart(userId);
    return this.hydrateCart(cart);
  }

  /**
   * Add variant item to customer cart
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @param {string | import('mongoose').Types.ObjectId} productId
   * @param {string | import('mongoose').Types.ObjectId} variantId
   * @param {number} quantity
   * @returns {Promise<object>}
   */
  async addItem(userId, productId, variantId, quantity = 1) {
    // 1. Verify Product
    const product = await Product.findById(productId);
    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      error.code = 'PRODUCT_NOT_FOUND';
      throw error;
    }

    if (product.status !== 'ACTIVE') {
      const error = new Error('This product is not currently active or available for purchase');
      error.statusCode = 400;
      error.code = 'PRODUCT_NOT_AVAILABLE';
      throw error;
    }

    // 2. Verify Variant
    const variant = product.variants.id(variantId);
    if (!variant) {
      const error = new Error('Variant not found within selected product');
      error.statusCode = 404;
      error.code = 'VARIANT_NOT_FOUND';
      throw error;
    }

    if (variant.isActive === false) {
      const error = new Error('This product variant is currently unavailable');
      error.statusCode = 400;
      error.code = 'VARIANT_NOT_AVAILABLE';
      throw error;
    }

    // 3. Verify Stock
    const availableStock = variant.inventory?.stock || 0;
    if (availableStock <= 0) {
      const error = new Error('This item is currently out of stock');
      error.statusCode = 400;
      error.code = 'OUT_OF_STOCK';
      throw error;
    }

    // 4. Find or create Cart
    const cart = await this.getOrCreateCart(userId);

    // 5. Check if variant already exists in cart
    const existingItem = cart.items.find(
      (item) => item.variantId.toString() === variantId.toString()
    );

    if (existingItem) {
      const updatedQty = existingItem.quantity + quantity;

      if (updatedQty > 10) {
        const error = new Error('Cannot purchase more than 10 units of a single item');
        error.statusCode = 400;
        error.code = 'MAX_QUANTITY_EXCEEDED';
        throw error;
      }

      if (updatedQty > availableStock) {
        const error = new Error(`Cannot add ${quantity} more. Only ${availableStock} units available in stock.`);
        error.statusCode = 400;
        error.code = 'INSUFFICIENT_STOCK';
        throw error;
      }

      existingItem.quantity = updatedQty;
    } else {
      if (quantity > availableStock) {
        const error = new Error(`Requested quantity exceeds available stock (${availableStock} units).`);
        error.statusCode = 400;
        error.code = 'INSUFFICIENT_STOCK';
        throw error;
      }

      cart.items.push({
        productId,
        variantId,
        quantity,
      });
    }

    await cart.save();

    // Return hydrated cart
    return this.hydrateCart(cart);
  }

  /**
   * Update item quantity by cartItemId
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @param {string} itemId
   * @param {number} quantity
   * @returns {Promise<object>}
   */
  async updateItem(userId, itemId, quantity) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.id(itemId);

    if (!item) {
      const error = new Error('Cart item not found');
      error.statusCode = 404;
      error.code = 'CART_ITEM_NOT_FOUND';
      throw error;
    }

    // Validate referenced product & variant
    const product = await Product.findById(item.productId);
    if (!product || product.status !== 'ACTIVE') {
      const error = new Error('Referenced product is no longer active');
      error.statusCode = 400;
      error.code = 'PRODUCT_NOT_AVAILABLE';
      throw error;
    }

    const variant = product.variants.id(item.variantId);
    if (!variant || variant.isActive === false) {
      const error = new Error('Referenced variant is no longer active');
      error.statusCode = 400;
      error.code = 'VARIANT_NOT_AVAILABLE';
      throw error;
    }

    const availableStock = variant.inventory?.stock || 0;
    if (quantity > availableStock) {
      const error = new Error(`Only ${availableStock} units available in stock.`);
      error.statusCode = 400;
      error.code = 'INSUFFICIENT_STOCK';
      throw error;
    }

    item.quantity = quantity;
    await cart.save();

    return this.hydrateCart(cart);
  }

  /**
   * Remove item from cart by cartItemId
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @param {string} itemId
   * @returns {Promise<object>}
   */
  async removeItem(userId, itemId) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.id(itemId);

    if (!item) {
      const error = new Error('Cart item not found');
      error.statusCode = 404;
      error.code = 'CART_ITEM_NOT_FOUND';
      throw error;
    }

    cart.items.pull(itemId);
    await cart.save();

    return this.hydrateCart(cart);
  }

  /**
   * Clear all items from customer cart
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @returns {Promise<object>}
   */
  async clearCart(userId) {
    const cart = await this.getOrCreateCart(userId);
    cart.items = [];
    await cart.save();

    return this.hydrateCart(cart);
  }

  /**
   * Merge anonymous guest cart items into authenticated customer cart
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @param {Array<{ productId: import('mongoose').Types.ObjectId, variantId: import('mongoose').Types.ObjectId, quantity: number }>} guestItems
   * @returns {Promise<{ mergedCount: number, skippedCount: number, mergedItems: Array<object>, skippedItems: Array<object>, cart: object }>}
   */
  async mergeGuestCart(userId, guestItems = []) {
    const cart = await this.getOrCreateCart(userId);

    if (!guestItems || guestItems.length === 0) {
      return {
        mergedCount: 0,
        skippedCount: 0,
        mergedItems: [],
        skippedItems: [],
        cart: await this.hydrateCart(cart),
      };
    }

    // Batch load products
    const productIds = guestItems.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const mergedItems = [];
    const skippedItems = [];

    for (const item of guestItems) {
      const productIdStr = item.productId.toString();
      const variantIdStr = item.variantId.toString();
      const product = productMap.get(productIdStr);

      // Check 1: Product active
      if (!product || product.status !== 'ACTIVE') {
        skippedItems.push({
          productId: productIdStr,
          variantId: variantIdStr,
          reason: 'PRODUCT_NOT_AVAILABLE',
        });
        continue;
      }

      // Check 2: Variant active within product
      const variant = (product.variants || []).find(
        (v) => v._id?.toString() === variantIdStr
      );

      if (!variant || variant.isActive === false) {
        skippedItems.push({
          productId: productIdStr,
          variantId: variantIdStr,
          reason: 'VARIANT_UNAVAILABLE',
        });
        continue;
      }

      // Check 3: Current stock availability
      const currentStock = variant.inventory?.stock || 0;
      if (currentStock <= 0) {
        skippedItems.push({
          productId: productIdStr,
          variantId: variantIdStr,
          reason: 'OUT_OF_STOCK',
        });
        continue;
      }

      // Merge into customer's cart
      const existingItem = cart.items.find(
        (ci) => ci.variantId.toString() === variantIdStr
      );

      if (existingItem) {
        const combinedQty = existingItem.quantity + item.quantity;
        const cappedQty = Math.min(combinedQty, currentStock, 10);
        existingItem.quantity = cappedQty;

        mergedItems.push({
          productId: productIdStr,
          variantId: variantIdStr,
          quantity: cappedQty,
          isNew: false,
        });
      } else {
        const initialQty = Math.min(item.quantity, currentStock, 10);
        cart.items.push({
          productId: item.productId,
          variantId: item.variantId,
          quantity: initialQty,
        });

        mergedItems.push({
          productId: productIdStr,
          variantId: variantIdStr,
          quantity: initialQty,
          isNew: true,
        });
      }
    }

    await cart.save();

    const hydratedCart = await this.hydrateCart(cart);

    return {
      mergedCount: mergedItems.length,
      skippedCount: skippedItems.length,
      mergedItems,
      skippedItems,
      cart: hydratedCart,
    };
  }
}

export default new CartService();
