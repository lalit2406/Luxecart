import Wishlist from './wishlist.model.js';
import Product from '../products/product.model.js';
import cartService from '../cart/cart.service.js';

class WishlistService {
  /**
   * Helper to retrieve or initialize an empty wishlist document for a user
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @returns {Promise<Wishlist>}
   */
  async getOrCreateWishlist(userId) {
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [] });
      await wishlist.save();
    }
    return wishlist;
  }

  /**
   * Dynamically hydrate raw wishlist items from live Product documents
   * @param {Wishlist} wishlist
   * @returns {Promise<object>}
   */
  async hydrateWishlist(wishlist) {
    if (!wishlist || !wishlist.items || wishlist.items.length === 0) {
      return {
        items: [],
        totalItems: 0,
      };
    }

    const productIds = wishlist.items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const hydratedItems = [];

    for (const item of wishlist.items) {
      const product = productMap.get(item.productId.toString());
      const itemId = item._id.toString();

      // Case 1: Product missing or not active
      if (!product || product.status !== 'ACTIVE') {
        hydratedItems.push({
          itemId,
          productId: item.productId.toString(),
          name: product?.name || 'Unavailable Product',
          slug: product?.slug || '',
          brand: product?.brand || '',
          image: product?.images?.[0]?.url || '',
          price: 0,
          mrp: 0,
          discountPercent: 0,
          isAvailable: false,
          reason: 'PRODUCT_ARCHIVED',
          preferredVariant: null,
          preferredVariantAvailable: false,
          availableVariants: [],
        });
        continue;
      }

      // Case 2: Product is active -> resolve preferred variant if present
      let preferredVariant = null;
      let preferredVariantAvailable = false;

      if (item.preferredVariantId) {
        const foundVariant = (product.variants || []).find(
          (v) => v._id?.toString() === item.preferredVariantId.toString()
        );

        if (foundVariant && foundVariant.isActive !== false) {
          preferredVariant = {
            id: foundVariant._id.toString(),
            sku: foundVariant.sku,
            attributes: foundVariant.attributes || {},
            price: foundVariant.price,
            mrp: foundVariant.mrp,
            inStock: (foundVariant.inventory?.stock || 0) > 0,
            stock: foundVariant.inventory?.stock || 0,
          };
          preferredVariantAvailable = true;
        }
      }

      // Live product pricing & thumbnail
      const minPrice = product.priceSummary?.minPrice || 0;
      const minMrp = product.priceSummary?.minMrp || minPrice;
      const discountPercent = product.priceSummary?.maxDiscountPercent || 0;
      const primaryImage =
        product.images?.find((img) => img.isPrimary)?.url ||
        product.images?.[0]?.url ||
        '';

      const availableVariants = (product.variants || [])
        .filter((v) => v.isActive !== false)
        .map((v) => ({
          id: v._id.toString(),
          sku: v.sku,
          attributes: v.attributes || {},
          price: v.price,
          mrp: v.mrp,
          inStock: (v.inventory?.stock || 0) > 0,
          stock: v.inventory?.stock || 0,
        }));

      hydratedItems.push({
        itemId,
        productId: product._id.toString(),
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        image: primaryImage,
        price: preferredVariant ? preferredVariant.price : minPrice,
        mrp: preferredVariant ? preferredVariant.mrp : minMrp,
        discountPercent,
        isAvailable: true,
        reason: null,
        preferredVariant,
        preferredVariantAvailable,
        availableVariants,
        inStock: product.priceSummary?.hasStock || false,
        addedAt: item.addedAt,
      });
    }

    return {
      items: hydratedItems,
      totalItems: hydratedItems.length,
    };
  }

  /**
   * Get customer wishlist
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @returns {Promise<object>}
   */
  async getWishlist(userId) {
    const wishlist = await this.getOrCreateWishlist(userId);
    return this.hydrateWishlist(wishlist);
  }

  /**
   * Add a product to customer wishlist
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @param {string | import('mongoose').Types.ObjectId} productId
   * @param {string | import('mongoose').Types.ObjectId | null} [preferredVariantId=null]
   * @returns {Promise<object>}
   */
  async addItem(userId, productId, preferredVariantId = null) {
    const product = await Product.findById(productId);
    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      error.code = 'PRODUCT_NOT_FOUND';
      throw error;
    }

    if (product.status !== 'ACTIVE') {
      const error = new Error('Cannot wishlist an unavailable or draft product');
      error.statusCode = 400;
      error.code = 'PRODUCT_NOT_AVAILABLE';
      throw error;
    }

    // If preferredVariantId provided, verify it belongs to this product
    if (preferredVariantId) {
      const variantExists = (product.variants || []).some(
        (v) => v._id?.toString() === preferredVariantId.toString()
      );
      if (!variantExists) {
        const error = new Error('Selected preferred variant does not belong to this product');
        error.statusCode = 404;
        error.code = 'INVALID_PREFERRED_VARIANT';
        throw error;
      }
    }

    const wishlist = await this.getOrCreateWishlist(userId);

    // Duplicate check
    const isDuplicate = wishlist.items.some(
      (item) => item.productId.toString() === productId.toString()
    );

    if (isDuplicate) {
      const error = new Error('This product is already in your wishlist');
      error.statusCode = 409;
      error.code = 'PRODUCT_ALREADY_WISHLISTED';
      throw error;
    }

    wishlist.items.push({
      productId,
      preferredVariantId,
    });

    await wishlist.save();
    return this.hydrateWishlist(wishlist);
  }

  /**
   * Remove a product from customer wishlist
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @param {string} productId
   * @returns {Promise<object>}
   */
  async removeItem(userId, productId) {
    const wishlist = await this.getOrCreateWishlist(userId);

    const itemIndex = wishlist.items.findIndex(
      (item) => item.productId.toString() === productId.toString()
    );

    if (itemIndex === -1) {
      const error = new Error('Product not found in wishlist');
      error.statusCode = 404;
      error.code = 'WISHLIST_ITEM_NOT_FOUND';
      throw error;
    }

    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();

    return this.hydrateWishlist(wishlist);
  }

  /**
   * Clear all items from customer wishlist
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @returns {Promise<object>}
   */
  async clearWishlist(userId) {
    const wishlist = await this.getOrCreateWishlist(userId);
    wishlist.items = [];
    await wishlist.save();

    return this.hydrateWishlist(wishlist);
  }

  /**
   * Move wishlist product variant to shopping cart
   * @param {string | import('mongoose').Types.ObjectId} userId
   * @param {string | import('mongoose').Types.ObjectId} productId
   * @param {string | import('mongoose').Types.ObjectId} variantId
   * @param {number} [quantity=1]
   * @returns {Promise<object>}
   */
  async moveToCart(userId, productId, variantId, quantity = 1) {
    const wishlist = await this.getOrCreateWishlist(userId);

    // 1. Verify wishlist ownership of product
    const wishlistItem = wishlist.items.find(
      (item) => item.productId.toString() === productId.toString()
    );

    if (!wishlistItem) {
      const error = new Error('Product not found in wishlist');
      error.statusCode = 404;
      error.code = 'WISHLIST_ITEM_NOT_FOUND';
      throw error;
    }

    // 2. Verify Product & Variant ownership
    const product = await Product.findById(productId);
    if (!product || product.status !== 'ACTIVE') {
      const error = new Error('This product is not currently available for purchase');
      error.statusCode = 400;
      error.code = 'PRODUCT_NOT_AVAILABLE';
      throw error;
    }

    const variant = (product.variants || []).find(
      (v) => v._id?.toString() === variantId.toString()
    );

    if (!variant) {
      const error = new Error('Selected variant does not belong to this product');
      error.statusCode = 404;
      error.code = 'VARIANT_NOT_FOUND';
      throw error;
    }

    if (variant.isActive === false) {
      const error = new Error('Selected variant is currently unavailable');
      error.statusCode = 400;
      error.code = 'VARIANT_NOT_AVAILABLE';
      throw error;
    }

    // 3. Delegate to CartService (Atomic operation: only removes from wishlist if cart addition succeeds)
    const cart = await cartService.addItem(userId, productId, variantId, quantity);

    // 4. Remove from wishlist
    wishlist.items = wishlist.items.filter(
      (item) => item.productId.toString() !== productId.toString()
    );
    await wishlist.save();

    const updatedWishlist = await this.hydrateWishlist(wishlist);

    return {
      cart,
      wishlist: updatedWishlist,
    };
  }
}

export default new WishlistService();
