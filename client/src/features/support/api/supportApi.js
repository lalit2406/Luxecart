import api from '../../../services/api';

/**
 * Customer Support Tickets API Client
 */
export const supportApi = {
  /**
   * Create a new support ticket
   * @param {object} payload - { subject, category, message, orderNumber?, returnNumber? }
   * @returns {Promise<object>}
   */
  createTicket: async (payload) => {
    return api.post('/support/tickets', payload);
  },

  /**
   * List customer's support tickets
   * @param {object} [params] - { page, limit, status, category }
   * @returns {Promise<object>}
   */
  getMyTickets: async (params = {}) => {
    return api.get('/support/tickets', { params });
  },

  /**
   * Get ticket details by ticketNumber
   * @param {string} ticketNumber
   * @returns {Promise<object>}
   */
  getTicketByNumber: async (ticketNumber) => {
    return api.get(`/support/tickets/${ticketNumber}`);
  },

  /**
   * Add customer message to a ticket thread
   * @param {string} ticketNumber
   * @param {object} payload - { message }
   * @returns {Promise<object>}
   */
  addMessage: async (ticketNumber, payload) => {
    return api.post(`/support/tickets/${ticketNumber}/messages`, payload);
  },

  /**
   * Customer close their own ticket
   * @param {string} ticketNumber
   * @param {object} payload - { status: 'CLOSED', note? }
   * @returns {Promise<object>}
   */
  closeTicket: async (ticketNumber, payload = { status: 'CLOSED' }) => {
    return api.patch(`/support/tickets/${ticketNumber}/status`, payload);
  },
};
