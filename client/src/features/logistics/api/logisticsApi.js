import api from '../../../services/api';

/**
 * Logistics API client for admin simulation and customer tracking
 */
export const logisticsApi = {
  /**
   * Admin: Retrieve simulated rate quotes for 500 g and 1 kg tiers
   * @param {string} orderNumber
   */
  getRateQuotes: async (orderNumber) => {
    return api.get(`/admin/logistics/rates/${orderNumber}`);
  },

  /**
   * Admin: Manifest mock shipment and generate MOCK- AWB
   * @param {string} orderNumber
   * @param {object} payload
   * @param {string} payload.carrierId
   * @param {string} [payload.weightTier]
   * @param {string} [payload.notes]
   */
  manifestShipment: async (orderNumber, payload) => {
    return api.post(`/admin/logistics/manifest/${orderNumber}`, payload);
  },

  /**
   * Admin: Advance mock shipment along the linear milestone sequence
   * @param {string} orderNumber
   * @param {object} payload
   * @param {string} payload.nextMilestone
   * @param {string} [payload.customLocation]
   * @param {string} [payload.customDescription]
   */
  advanceMilestone: async (orderNumber, payload) => {
    return api.post(`/admin/logistics/advance-milestone/${orderNumber}`, payload);
  },

  /**
   * Admin: Simulate delivery exception (failed attempt or RTO)
   * @param {string} orderNumber
   * @param {object} payload
   * @param {string} payload.exceptionType 'ATTEMPT_FAILED' | 'RTO'
   * @param {string} [payload.reason]
   */
  simulateException: async (orderNumber, payload) => {
    return api.post(`/admin/logistics/simulate-exception/${orderNumber}`, payload);
  },

  /**
   * Customer / Admin: Retrieve read-only tracking checkpoints for an order
   * @param {string} orderNumber
   */
  getOrderTracking: async (orderNumber) => {
    return api.get(`/orders/${orderNumber}/tracking`);
  },

  /**
   * Customer / Admin: Retrieve simulated communication log (SMS & Email previews)
   * @param {string} orderNumber
   */
  getOrderNotifications: async (orderNumber) => {
    return api.get(`/orders/${orderNumber}/notifications`);
  },
};

export default logisticsApi;
