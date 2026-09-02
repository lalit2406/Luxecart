import api from '../../../services/api';

export const adminProductApi = {
  /**
   * List all products with admin filtering (status, search, category, pagination)
   */
  getProducts: async (params = {}) => {
    return api.get('/admin/products', { params });
  },

  /**
   * Get single product by ID
   */
  getProductById: async (id) => {
    return api.get(`/admin/products/${id}`);
  },

  /**
   * Create a new product (defaults to DRAFT)
   */
  createProduct: async (data) => {
    return api.post('/admin/products', data);
  },

  /**
   * Update product general details
   */
  updateProduct: async (id, data) => {
    return api.patch(`/admin/products/${id}`, data);
  },

  /**
   * Update product lifecycle status (DRAFT | ACTIVE | ARCHIVED)
   */
  updateProductStatus: async (id, status) => {
    return api.patch(`/admin/products/${id}/status`, { status });
  },

  /**
   * Add a new variant to product
   */
  addVariant: async (productId, variantData) => {
    return api.post(`/admin/products/${productId}/variants`, variantData);
  },

  /**
   * Update an existing variant inside product
   */
  updateVariant: async (productId, variantId, variantData) => {
    return api.patch(`/admin/products/${productId}/variants/${variantId}`, variantData);
  },

  /**
   * Delete a variant from product
   */
  deleteVariant: async (productId, variantId) => {
    return api.delete(`/admin/products/${productId}/variants/${variantId}`);
  },
};
