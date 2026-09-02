import api from '../../../services/api';

export const orderApi = {
  /**
   * Place a Cash on Delivery order
   * @param {object} payload
   * @param {string} [payload.addressId]
   * @param {string} [payload.idempotencyKey]
   * @param {string} [payload.couponCode]
   */
  placeCodOrder: async ({ addressId, idempotencyKey, couponCode } = {}) => {
    const body = {
      paymentMethod: 'CASH_ON_DELIVERY',
    };
    if (addressId) body.addressId = addressId;
    if (idempotencyKey) body.idempotencyKey = idempotencyKey;
    if (couponCode) body.couponCode = couponCode;

    return api.post('/orders', body);
  },

  /**
   * Fetch order details by orderNumber for authenticated customer
   * @param {string} orderNumber
   */
  getOrderByNumber: async (orderNumber) => {
    return api.get(`/orders/${orderNumber}`);
  },

  /**
   * Alias for getOrderByNumber
   * @param {string} orderNumber
   */
  getOrder: async (orderNumber) => {
    return api.get(`/orders/${orderNumber}`);
  },

  /**
   * Fetch customer's paginated order history
   * @param {object} [params]
   */
  getMyOrders: async (params = {}) => {
    return api.get('/orders', { params });
  },

  /**
   * Alias for getMyOrders
   * @param {object} [params]
   */
  getOrders: async (params = {}) => {
    return api.get('/orders', { params });
  },
};
