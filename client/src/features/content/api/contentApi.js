import api from '../../../services/api';

/**
 * Public Storefront Content API
 */
export const contentApi = {
  /**
   * Retrieve active, non-expired homepage content sections
   * @returns {Promise<object>}
   */
  getHomepageContent: async () => {
    return api.get('/content/homepage');
  },
};

export default contentApi;
