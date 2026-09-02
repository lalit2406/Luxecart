import api from '../../../services/api';

export const reviewApi = {
  /**
   * Get public reviews for a product with pagination, filter, and breakdown
   * @param {string} productId
   * @param {object} [params]
   * @param {number} [params.page]
   * @param {number} [params.limit]
   * @param {number|string} [params.rating]
   * @param {string} [params.sortBy]
   * @param {string} [params.sortOrder]
   */
  getReviews: async (productId, params = {}) => {
    return api.get(`/products/${productId}/reviews`, { params });
  },

  /**
   * Get authenticated customer's review for a product
   * @param {string} productId
   */
  getMyReview: async (productId) => {
    return api.get(`/products/${productId}/reviews/my-review`);
  },

  /**
   * Submit a new review for a product
   * @param {string} productId
   * @param {object} payload
   * @param {number} payload.rating
   * @param {string} payload.title
   * @param {string} payload.comment
   */
  createReview: async (productId, payload) => {
    return api.post(`/products/${productId}/reviews`, payload);
  },

  /**
   * Update the customer's own review for a product
   * @param {string} productId
   * @param {object} payload
   * @param {number} [payload.rating]
   * @param {string} [payload.title]
   * @param {string} [payload.comment]
   */
  updateMyReview: async (productId, payload) => {
    return api.put(`/products/${productId}/reviews/my-review`, payload);
  },

  /**
   * Delete the customer's own review for a product
   * @param {string} productId
   */
  deleteMyReview: async (productId) => {
    return api.delete(`/products/${productId}/reviews/my-review`);
  },
};
