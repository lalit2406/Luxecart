import api from '../../../services/api';

/**
 * Customer Returns API Client
 */
export const returnApi = {
  /**
   * Create a return request for a delivered order
   * @param {object} payload - { orderNumber, items: [...] }
   * @returns {Promise<object>}
   */
  createReturn: async (payload) => {
    return api.post('/returns', payload);
  },

  /**
   * Create a return request for a specific orderNumber via URL param
   * @param {string} orderNumber
   * @param {object} payload - { items: [...] }
   * @returns {Promise<object>}
   */
  createReturnForOrder: async (orderNumber, payload) => {
    return api.post(`/returns/orders/${orderNumber}`, payload);
  },

  /**
   * Retrieve paginated return history for authenticated customer
   * @param {object} [params]
   * @returns {Promise<object>}
   */
  getMyReturns: async (params = {}) => {
    return api.get('/returns', { params });
  },

  /**
   * Retrieve single return details by returnNumber for authenticated customer
   * @param {string} returnNumber
   * @returns {Promise<object>}
   */
  getReturnByNumber: async (returnNumber) => {
    return api.get(`/returns/${returnNumber}`);
  },
};
