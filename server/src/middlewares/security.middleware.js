import { config } from '../config/env.js';

/**
 * Security Headers Middleware
 * Applies production-grade security headers including CSP, HSTS, X-Content-Type-Options,
 * X-Frame-Options, Referrer-Policy, and X-XSS-Protection.
 */
export const securityHeaders = (req, res, next) => {
  // 1. Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 2. Clickjacking protection
  res.setHeader('X-Frame-Options', 'DENY');

  // 3. Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 4. Disable buggy legacy XSS filter
  res.setHeader('X-XSS-Protection', '0');

  // 5. HTTP Strict Transport Security (HSTS) in production
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // 6. Content Security Policy (CSP)
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com",
    "connect-src 'self' http://localhost:5000 http://localhost:5173 https://res.cloudinary.com https://api.cloudinary.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  next();
};

/**
 * Recursive sanitizer function to strip MongoDB operator injection keys ($ and .)
 * @param {any} target
 * @returns {any}
 */
const sanitizeObject = (target) => {
  if (!target || typeof target !== 'object') {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => sanitizeObject(item));
  }

  const clean = {};
  for (const key of Object.keys(target)) {
    // Strip keys that start with $ (MongoDB query operators) or contain . (dotted paths)
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    clean[key] = sanitizeObject(target[key]);
  }
  return clean;
};

/**
 * NoSQL Query Injection Sanitizer Middleware
 * Defensively cleans user-controlled payload objects in req.body, req.query, and req.params
 */
export const noSqlSanitizer = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
};
