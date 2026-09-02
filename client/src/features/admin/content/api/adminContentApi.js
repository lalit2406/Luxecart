import api from '../../../../services/api';

/**
 * Admin Content Management API Client
 */
export const adminContentApi = {
  /**
   * Retrieve paginated content list with filters
   * @param {object} [params] - { page, limit, type, isActive, search, sortBy, sortOrder }
   * @returns {Promise<object>}
   */
  getContent: async (params = {}) => {
    return api.get('/admin/content', { params });
  },

  /**
   * Retrieve single content item by ID
   * @param {string} id
   * @returns {Promise<object>}
   */
  getContentById: async (id) => {
    return api.get(`/admin/content/${id}`);
  },

  /**
   * Create a new content section
   * @param {object} payload
   * @returns {Promise<object>}
   */
  createContent: async (payload) => {
    return api.post('/admin/content', payload);
  },

  /**
   * Update an existing content section
   * @param {string} id
   * @param {object} payload
   * @returns {Promise<object>}
   */
  updateContent: async (id, payload) => {
    return api.put(`/admin/content/${id}`, payload);
  },

  /**
   * Toggle active state of a content item
   * @param {string} id
   * @param {boolean} isActive
   * @returns {Promise<object>}
   */
  toggleContent: async (id, isActive) => {
    return api.patch(`/admin/content/${id}/toggle`, { isActive });
  },

  /**
   * Delete a content item
   * @param {string} id
   * @returns {Promise<object>}
   */
  deleteContent: async (id) => {
    return api.delete(`/admin/content/${id}`);
  },

  /**
   * Reorder content items sequentially
   * @param {Array<string>} orderedIds
   * @param {string} [type]
   * @returns {Promise<object>}
   */
  reorderContent: async (orderedIds, type = null) => {
    const body = { orderedIds };
    if (type) body.type = type;
    return api.put('/admin/content/reorder', body);
  },
};

export default adminContentApi;
