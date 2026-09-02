import api from '../../../services/api';

export const addressApi = {
  /**
   * Fetch all saved addresses for authenticated customer
   */
  getAddresses: async () => {
    return api.get('/addresses');
  },

  /**
   * Create a new address
   * @param {object} addressData
   */
  createAddress: async (addressData) => {
    return api.post('/addresses', addressData);
  },

  /**
   * Update an existing address
   * @param {string} id
   * @param {object} updateData
   */
  updateAddress: async (id, updateData) => {
    return api.patch(`/addresses/${id}`, updateData);
  },

  /**
   * Set an address as default
   * @param {string} id
   */
  setDefaultAddress: async (id) => {
    return api.patch(`/addresses/${id}/default`);
  },

  /**
   * Delete an address
   * @param {string} id
   */
  deleteAddress: async (id) => {
    return api.delete(`/addresses/${id}`);
  },
};
