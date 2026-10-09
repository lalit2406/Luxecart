import api from '../../../services/api';

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (credentials) => api.post('/auth/login', credentials),
  googleLogin: (credential) => api.post('/auth/google', { credential }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: ({ token, password }) => api.post('/auth/reset-password', { token, password }),
  logout: () => api.post('/auth/logout', {}),
  getCurrentUser: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh', {}),
  testAdminAccess: () => api.get('/admin/test'),
};
