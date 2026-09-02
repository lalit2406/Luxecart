import api from '../../../services/api';

export const adminImportApi = {
  /**
   * Upload spreadsheet file (CSV/XLSX) to generate preflight preview
   * @param {FormData} formData
   * @param {Function} [onUploadProgress]
   */
  previewImport: async (formData, onUploadProgress) => {
    return api.post('/admin/products/import/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
  },

  /**
   * Execute confirmed import job and create DRAFT products
   * @param {string} importId
   */
  executeImport: async (importId) => {
    return api.post('/admin/products/import/execute', { importId });
  },

  /**
   * Get paginated past import jobs
   * @param {object} params
   */
  getImportJobs: async (params = {}) => {
    return api.get('/admin/products/imports', { params });
  },

  /**
   * Get single import job details by ID
   * @param {string} id
   */
  getImportJobById: async (id) => {
    return api.get(`/admin/products/imports/${id}`);
  },

  /**
   * Download sample import template (CSV or XLSX)
   * @param {'csv' | 'xlsx'} format
   */
  downloadTemplate: async (format = 'csv') => {
    const response = await api.get('/admin/products/import/template', {
      params: { format },
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `luxecart_product_import_template.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Download CSV error report for an import job
   * @param {string} id
   */
  downloadErrorCsv: async (id) => {
    const response = await api.get(`/admin/products/imports/${id}/errors`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'text/csv' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `import_errors_${id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};
