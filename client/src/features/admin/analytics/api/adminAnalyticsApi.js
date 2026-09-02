import api from '../../../../services/api';

/**
 * Admin Analytics API Client
 */
export const adminAnalyticsApi = {
  /**
   * Retrieve high-level summary KPIs and metrics
   * @param {object} [params] - { range: '7d'|'30d'|'this_year'|'all', from?: string, to?: string }
   * @returns {Promise<object>}
   */
  getSummary: async (params = {}) => {
    return api.get('/admin/analytics/summary', { params });
  },

  /**
   * Retrieve time-series sales trend metrics
   * @param {object} [params] - { range: '7d'|'30d'|'this_year'|'all', from?: string, to?: string }
   * @returns {Promise<object>}
   */
  getSalesTrends: async (params = {}) => {
    return api.get('/admin/analytics/sales-trends', { params });
  },

  /**
   * Retrieve product-level sales and revenue ranking analytics
   * @param {object} [params] - { range, from, to, page, limit, sortBy, sortOrder, search, categoryId }
   * @returns {Promise<object>}
   */
  getProductPerformance: async (params = {}) => {
    return api.get('/admin/analytics/products', { params });
  },

  /**
   * Retrieve category-level sales, revenue, and contribution analytics
   * @param {object} [params] - { range, from, to, page, limit, sortBy, sortOrder, search }
   * @returns {Promise<object>}
   */
  getCategoryPerformance: async (params = {}) => {
    return api.get('/admin/analytics/categories', { params });
  },

  /**
   * Retrieve customer cohort performance, repeat rates, and segmentation
   * @param {object} [params] - { range, from, to, page, limit, sortBy, sortOrder, search, segment }
   * @returns {Promise<object>}
   */
  getCustomerPerformance: async (params = {}) => {
    return api.get('/admin/analytics/customers', { params });
  },

  /**
   * Retrieve order value distribution bracket metrics
   * @param {object} [params] - { range, from, to }
   * @returns {Promise<object>}
   */
  getOrderDistribution: async (params = {}) => {
    return api.get('/admin/analytics/order-distribution', { params });
  },

  /**
   * Retrieve customer acquisition (new vs returning) time-series trends
   * @param {object} [params] - { range, from, to }
   * @returns {Promise<object>}
   */
  getCustomerTrends: async (params = {}) => {
    return api.get('/admin/analytics/customer-trends', { params });
  },

  /**
   * Retrieve operational inventory summary metrics
   * @returns {Promise<object>}
   */
  getInventorySummary: async () => {
    return api.get('/admin/analytics/inventory-summary');
  },

  /**
   * Retrieve variant-level inventory health records
   * @param {object} [params] - { page, limit, search, status, categoryId, sortBy, sortOrder }
   * @returns {Promise<object>}
   */
  getInventoryHealth: async (params = {}) => {
    return api.get('/admin/analytics/inventory-health', { params });
  },

  /**
   * Retrieve operational low-stock variants
   * @param {object} [params] - { page, limit, search, categoryId, sortBy, sortOrder }
   * @returns {Promise<object>}
   */
  getLowStock: async (params = {}) => {
    return api.get('/admin/analytics/low-stock', { params });
  },

  /**
   * Retrieve operational out-of-stock variants
   * @param {object} [params] - { page, limit, search, categoryId, sortBy, sortOrder }
   * @returns {Promise<object>}
   */
  getOutOfStock: async (params = {}) => {
    return api.get('/admin/analytics/out-of-stock', { params });
  },

  /**
   * Retrieve category-level inventory concentration
   * @param {object} [params] - { search, sortBy, sortOrder }
   * @returns {Promise<object>}
   */
  getInventoryConcentration: async (params = {}) => {
    return api.get('/admin/analytics/inventory-concentration', { params });
  },
};
