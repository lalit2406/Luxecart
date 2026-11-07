import rateLimit from 'express-rate-limit';

/**
 * Factory for creating custom rate limiters with consistent project formatting
 * @param {object} options
 * @returns {import('express').RequestHandler}
 */
export const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    message: {
      success: false,
      message: options.message || 'Too many requests. Please try again later.',
      error: {
        code: options.errorCode || 'TOO_MANY_REQUESTS',
      },
    },
    skip: options.skip || ((req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-ratelimit']),
    ...options.extra,
  });
};

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

/**
 * Rate limiter for checkout / order creation endpoints
 * 15-minute window, max 15 requests per IP
 */
export const checkoutRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many checkout attempts from this IP. Please try again after 15 minutes.',
  errorCode: 'TOO_MANY_CHECKOUT_ATTEMPTS',
});

/**
 * Rate limiter for customer coupon validation endpoint
 * 15-minute window, max 20 requests per IP
 */
export const couponValidationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many coupon validation attempts from this IP. Please try again after 15 minutes.',
  errorCode: 'TOO_MANY_COUPON_ATTEMPTS',
});

