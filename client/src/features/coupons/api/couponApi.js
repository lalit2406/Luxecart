import api from '../../../services/api';

export const couponApi = {
  /**
   * Validate coupon code against active cart for authenticated customer
   * @param {string} code
   * @returns {Promise<object>}
   */
  validateCoupon: async (code) => {
    return api.post('/coupons/validate', { code });
  },
};
