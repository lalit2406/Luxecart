import rateLimit from 'express-rate-limit';

/**
 * Global API Rate Limiter
 * 15-minute window, max 500 requests per IP
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many API requests from this IP. Please try again after 15 minutes.',
    error: {
      code: 'TOO_MANY_REQUESTS',
    },
  },
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit'],
});

/**
 * Rate limiter for authentication endpoints (login, register)
 * 15-minute window, max 50 requests per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit'],
});
