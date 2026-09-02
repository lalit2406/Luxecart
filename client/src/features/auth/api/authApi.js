import api from '../../../services/api';

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout', {}),
  getCurrentUser: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh', {}),
  testAdminAccess: () => api.get('/admin/test'),
};
