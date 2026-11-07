import axios from 'axios';

/**
 * Centralized Axios API client
 */
const api = axios.create({
  baseURL: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  withCredentials: true, // Send and receive HTTP-only cookies
  timeout: 45000,
});

// Ensure common default header is consistently applied across all HTTP verbs
api.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor for error normalization and automatic token refresh
api.interceptors.response.use(
  (response) => {
    // If response was requested as blob, preserve response structure (headers and blob data)
    if (response.config?.responseType === 'blob') {
      return response;
    }
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Normalize error object
    const isTimeout = error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout');
    const customError = {
      message:
        error.response?.data?.message ||
        (isTimeout ? 'Request timed out. The server took too long to respond. Please try again.' : error.message) ||
        'Network error occurred',
      statusCode: error.response?.status || (isTimeout ? 408 : 500),
      code: error.response?.data?.error?.code || error.response?.data?.code || (isTimeout ? 'REQUEST_TIMEOUT' : 'UNKNOWN_ERROR'),
      details: error.response?.data?.error?.details || error.response?.data?.details || error.response?.data?.data,
    };

    // If error response body is a Blob (common when responseType: 'blob'), parse JSON text
    if (typeof Blob !== 'undefined' && error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const parsed = JSON.parse(text);
        if (parsed.message) customError.message = parsed.message;
        if (parsed.code) customError.code = parsed.code;
        if (parsed.details) customError.details = parsed.details;
      } catch (_) {
        // Non-JSON blob, keep default error message
      }
    }

    // If 401 received on a non-auth endpoint, try refresh token rotation once
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/me') &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !originalRequest.url?.includes('/auth/google') &&
      !originalRequest.url?.includes('/auth/forgot-password') &&
      !originalRequest.url?.includes('/auth/reset-password') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
            },
          }
        );
        processQueue(null);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        return Promise.reject(customError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(customError);
  }
);

export default api;
