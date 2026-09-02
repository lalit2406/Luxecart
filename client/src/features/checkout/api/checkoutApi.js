import api from '../../../services/api';

export const checkoutApi = {
  /**
   * Prepare checkout snapshot, revalidating items, address, coupon, and pricing
   * @param {string} [addressId]
   * @param {string} [couponCode]
   */
  prepareCheckout: async (addressId = null, couponCode = null) => {
    const payload = {};
    if (addressId) payload.addressId = addressId;
    if (couponCode) payload.couponCode = couponCode;
    return api.post('/checkout/prepare', payload);
  },
};
