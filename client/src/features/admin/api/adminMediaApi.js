import api from '../../../services/api';

export const adminMediaApi = {
  /**
   * Upload multiple media images (multipart/form-data)
   * @param {string} productId
   * @param {FormData} formData
   * @param {Function} [onUploadProgress]
   */
  uploadMedia: async (productId, formData, onUploadProgress) => {
    return api.post(`/admin/products/${productId}/media`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
  },

  /**
   * Set an image as the single primary image
   * @param {string} productId
   * @param {string} mediaId
   */
  setPrimaryMedia: async (productId, mediaId) => {
    return api.patch(`/admin/products/${productId}/media/${mediaId}/primary`);
  },

  /**
   * Reorder images gallery
   * @param {string} productId
   * @param {Array<{ mediaId: string, displayOrder: number }>} images
   */
  reorderMedia: async (productId, images) => {
    return api.patch(`/admin/products/${productId}/media/order`, { images });
  },

  /**
   * Delete a media image from product and Cloudinary
   * @param {string} productId
   * @param {string} mediaId
   */
  deleteMedia: async (productId, mediaId) => {
    return api.delete(`/admin/products/${productId}/media/${mediaId}`);
  },
};
