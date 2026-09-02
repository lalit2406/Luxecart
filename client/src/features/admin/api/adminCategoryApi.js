import api from '../../../services/api';

export const adminCategoryApi = {
  /**
   * Fetch category hierarchy/list
   */
  getCategories: async () => {
    return api.get('/categories');
  },

  /**
   * Create a new category
   */
  createCategory: async (data) => {
    return api.post('/admin/categories', data);
  },

  /**
   * Update category
   */
  updateCategory: async (id, data) => {
    return api.patch(`/admin/categories/${id}`, data);
  },

  /**
   * Archive/delete category
   */
  archiveCategory: async (id) => {
    return api.delete(`/admin/categories/${id}`);
  },
};
