import api from '../../../../services/api';

export const adminCustomerApi = {
  /**
   * List customers with pagination, search, status filtering, and order metrics
   * @param {object} [params]
   * @param {number} [params.page]
   * @param {number} [params.limit]
   * @param {string} [params.status]
   * @param {string} [params.search]
   * @param {string} [params.sortBy]
   * @param {string} [params.sortOrder]
   */
  getCustomers: async (params = {}) => {
    return api.get('/admin/customers', { params });
  },

  /**
   * Retrieve full customer profile, addresses, order summary, and status history
   * @param {string} customerId
   */
  getCustomerById: async (customerId) => {
    return api.get(`/admin/customers/${customerId}`);
  },

  /**
   * Retrieve paginated order history for a customer
   * @param {string} customerId
   * @param {object} [params]
   * @param {number} [params.page]
   * @param {number} [params.limit]
   */
  getCustomerOrders: async (customerId, params = {}) => {
    return api.get(`/admin/customers/${customerId}/orders`, { params });
  },

  /**
   * Update customer account status (ACTIVE or SUSPENDED)
   * @param {string} customerId
   * @param {object} payload
   * @param {'ACTIVE' | 'SUSPENDED'} payload.status
   * @param {string} [payload.reason]
   */
  updateCustomerStatus: async (customerId, payload) => {
    return api.patch(`/admin/customers/${customerId}/status`, payload);
  },
};
