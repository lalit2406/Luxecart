import api from '../../../../services/api';

export const adminCouponApi = {
  /**
   * List all coupons with filters and usage metrics
   * @param {object} [params]
   */
  getCoupons: async (params = {}) => {
    return api.get('/admin/coupons', { params });
  },

  /**
   * Create a new coupon
   * @param {object} payload
   */
  createCoupon: async (payload) => {
    return api.post('/admin/coupons', payload);
  },

  /**
   * Get coupon by ID
   * @param {string} id
   */
  getCouponById: async (id) => {
    return api.get(`/admin/coupons/${id}`);
  },

  /**
   * Update existing coupon
   * @param {string} id
   * @param {object} payload
   */
  updateCoupon: async (id, payload) => {
    return api.put(`/admin/coupons/${id}`, payload);
  },

  /**
   * Toggle coupon active/inactive status
   * @param {string} id
   * @param {boolean} isActive
   */
  toggleCouponStatus: async (id, isActive) => {
    return api.patch(`/admin/coupons/${id}/status`, { isActive });
  },

  /**
   * Delete coupon
   * @param {string} id
   */
  deleteCoupon: async (id) => {
    return api.delete(`/admin/coupons/${id}`);
  },
};
