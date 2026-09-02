import api from '../../../services/api';

export const wishlistApi = {
  /**
   * Fetch current customer's hydrated wishlist
   */
  getWishlist: async () => {
    return api.get('/wishlist');
  },

  /**
   * Add a product to customer's wishlist
   * @param {string} productId
   * @param {string} [preferredVariantId=null]
   */
  addToWishlist: async (productId, preferredVariantId = null) => {
    return api.post('/wishlist/items', { productId, preferredVariantId });
  },

  /**
   * Remove a product from wishlist
   * @param {string} productId
   */
  removeFromWishlist: async (productId) => {
    return api.delete(`/wishlist/items/${productId}`);
  },

  /**
   * Clear all items from customer's wishlist
   */
  clearWishlist: async () => {
    return api.delete('/wishlist');
  },

  /**
   * Move a wishlist item to shopping cart
   * @param {string} productId
   * @param {string} variantId
   * @param {number} [quantity=1]
   */
  moveWishlistItemToCart: async (productId, variantId, quantity = 1) => {
    return api.post('/wishlist/move-to-cart', { productId, variantId, quantity });
  },
};
