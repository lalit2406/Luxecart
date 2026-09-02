import api from '../../../../services/api';

/**
 * Admin Returns API Client
 */
export const adminReturnApi = {
  /**
   * Retrieve paginated return requests with search and filters
   * @param {object} params
   * @returns {Promise<object>}
   */
  getAdminReturns: async (params = {}) => {
    return api.get('/admin/returns', { params });
  },

  /**
   * Retrieve full return detail record by returnNumber
   * @param {string} returnNumber
   * @returns {Promise<object>}
   */
  getAdminReturnByNumber: async (returnNumber) => {
    return api.get(`/admin/returns/${returnNumber}`);
  },

  /**
   * Update return status (e.g. APPROVED, REJECTED, etc.)
   * @param {string} returnNumber
   * @param {object} payload
   * @returns {Promise<object>}
   */
  updateReturnStatus: async (returnNumber, payload) => {
    return api.patch(`/admin/returns/${returnNumber}/status`, payload);
  },
};
