import api from '../../../../services/api';

/**
 * Admin Support Tickets API Client
 */
export const adminSupportApi = {
  /**
   * List support tickets with query filters
   * @param {object} [params] - { page, limit, status, category, priority, search, sortBy, sortOrder }
   * @returns {Promise<object>}
   */
  getAdminTickets: async (params = {}) => {
    return api.get('/admin/support/tickets', { params });
  },

  /**
   * Get support ticket details by ticketNumber
   * @param {string} ticketNumber
   * @returns {Promise<object>}
   */
  getAdminTicketByNumber: async (ticketNumber) => {
    return api.get(`/admin/support/tickets/${ticketNumber}`);
  },

  /**
   * Update support ticket status
   * @param {string} ticketNumber
   * @param {object} payload - { status, note? }
   * @returns {Promise<object>}
   */
  updateTicketStatus: async (ticketNumber, payload) => {
    return api.patch(`/admin/support/tickets/${ticketNumber}/status`, payload);
  },

  /**
   * Add admin message to ticket thread
   * @param {string} ticketNumber
   * @param {object} payload - { message }
   * @returns {Promise<object>}
   */
  addAdminMessage: async (ticketNumber, payload) => {
    return api.post(`/admin/support/tickets/${ticketNumber}/messages`, payload);
  },

  /**
   * Assign ticket to an administrator
   * @param {string} ticketNumber
   * @param {object} payload - { assignedTo: string|null }
   * @returns {Promise<object>}
   */
  assignTicket: async (ticketNumber, payload) => {
    return api.patch(`/admin/support/tickets/${ticketNumber}/assignment`, payload);
  },

  /**
   * Update ticket priority
   * @param {string} ticketNumber
   * @param {object} payload - { priority }
   * @returns {Promise<object>}
   */
  updateTicketPriority: async (ticketNumber, payload) => {
    return api.patch(`/admin/support/tickets/${ticketNumber}/priority`, payload);
  },
};
