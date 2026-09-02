import api from '../../../../services/api';

export const adminReviewApi = {
  /**
   * List all reviews for admin moderation dashboard
   * @param {object} [params]
   * @param {number} [params.page]
   * @param {number} [params.limit]
   * @param {string} [params.status]
   * @param {string} [params.productId]
   * @param {string} [params.search]
   * @param {string} [params.sortBy]
   * @param {string} [params.sortOrder]
   */
  getAdminReviews: async (params = {}) => {
    return api.get('/admin/reviews', { params });
  },

  /**
   * Update review status (APPROVED, HIDDEN, REJECTED)
   * @param {string} reviewId
   * @param {string} status
   */
  updateReviewStatus: async (reviewId, status) => {
    return api.patch(`/admin/reviews/${reviewId}/status`, { status });
  },

  /**
   * Delete review by admin
   * @param {string} reviewId
   */
  deleteReview: async (reviewId) => {
    return api.delete(`/admin/reviews/${reviewId}`);
  },
};
