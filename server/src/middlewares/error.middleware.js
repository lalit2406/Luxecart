import { sendError } from '../utils/response.js';

/**
 * 404 Not Found Middleware
 */
export const notFoundHandler = (req, res) => {
  return sendError(res, 404, `Cannot ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND');
};

/**
 * Centralized Global Error Handler
 */
export const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const errorCode = err.code || 'SERVER_ERROR';
  const details = err.details || (process.env.NODE_ENV === 'development' ? err.stack : undefined);

  return sendError(res, statusCode, message, errorCode, details);
};
