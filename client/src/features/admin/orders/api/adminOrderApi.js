import api from '../../../../services/api';

export const adminOrderApi = {
  /**
   * List all customer orders with search, status filtering, and pagination for admin dashboard
   * @param {object} [params]
   * @param {number} [params.page]
   * @param {number} [params.limit]
   * @param {string} [params.status]
   * @param {string} [params.search]
   * @param {string} [params.sortBy]
   * @param {string} [params.sortOrder]
   */
  getAdminOrders: async (params = {}) => {
    return api.get('/admin/orders', { params });
  },

  /**
   * Retrieve full customer order snapshot by orderNumber for admin inspection
   * @param {string} orderNumber
   */
  getAdminOrder: async (orderNumber) => {
    return api.get(`/admin/orders/${orderNumber}`);
  },

  /**
   * Update order status following server-authoritative state machine
   * @param {string} orderNumber
   * @param {object} payload
   * @param {string} payload.status
   * @param {string} [payload.note]
   */
  updateOrderStatus: async (orderNumber, payload) => {
    return api.patch(`/admin/orders/${orderNumber}/status`, payload);
  },
};
