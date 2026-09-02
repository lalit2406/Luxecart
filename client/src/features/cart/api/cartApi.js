import api from '../../../services/api';

export const cartApi = {
  /**
   * Fetch current customer's hydrated cart
   */
  getCart: async () => {
    return api.get('/cart');
  },

  /**
   * Add a product variant to cart
   * @param {string} productId
   * @param {string} variantId
   * @param {number} [quantity=1]
   */
  addToCart: async (productId, variantId, quantity = 1) => {
    return api.post('/cart/items', { productId, variantId, quantity });
  },

  /**
   * Update cart item quantity by cartItemId
   * @param {string} itemId
   * @param {number} quantity
   */
  updateCartItem: async (itemId, quantity) => {
    return api.patch(`/cart/items/${itemId}`, { quantity });
  },

  /**
   * Remove cart item by cartItemId
   * @param {string} itemId
   */
  removeCartItem: async (itemId) => {
    return api.delete(`/cart/items/${itemId}`);
  },

  /**
   * Clear all items from customer cart
   */
  clearCart: async () => {
    return api.delete('/cart');
  },

  /**
   * Merge anonymous guest cart items into customer cart
   * Explicitly strips local display snapshot fields and sends only { productId, variantId, quantity }
   * @param {Array<object>} items
   */
  mergeGuestCart: async (items = []) => {
    const sanitizedItems = (items || []).map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }));
    return api.post('/cart/merge', { items: sanitizedItems });
  },
};

