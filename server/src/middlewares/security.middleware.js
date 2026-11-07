import { config } from '../config/env.js';

/**
 * Constructs Content Security Policy (CSP) directives based on environment and allowed origins.
 *
 * In production:
 * - Omits all localhost and 127.0.0.1 development origins from connect-src.
 * - Removes legacy Unsplash image origins.
 * - Allows self, configured frontend origins, Cloudinary assets/APIs, and Google GIS.
 *
 * In development:
 * - Retains localhost dev ports and mock fallbacks to support local development.
 *
 * @param {object} [options={}]
 * @param {boolean} [options.isProduction=config.isProduction]
 * @param {string[]} [options.allowedOrigins=config.allowedOrigins]
 * @returns {string[]}
 */
export const buildCspDirectives = (options = {}) => {
  const isProduction = options.isProduction !== undefined ? options.isProduction : config.isProduction;
  const allowedOrigins = options.allowedOrigins !== undefined ? options.allowedOrigins : (config.allowedOrigins || []);

  // 1. Connection endpoints (connect-src)
  const connectOrigins = new Set(["'self'"]);

  if (isProduction) {
    // Only add non-localhost origins in production
    for (const origin of allowedOrigins) {
      if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        connectOrigins.add(origin);
      }
    }
  } else {
    // Development origins
    connectOrigins.add('http://localhost:5000');
    connectOrigins.add('http://localhost:5173');
    for (const origin of allowedOrigins) {
      if (origin) connectOrigins.add(origin);
    }
  }

  // Cloudinary media and API endpoints
  connectOrigins.add('https://res.cloudinary.com');
  connectOrigins.add('https://api.cloudinary.com');
  // Google Identity Services endpoints
  connectOrigins.add('https://accounts.google.com');

  // 2. Image endpoints (img-src)
  const imgOrigins = ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'];
  if (!isProduction) {
    imgOrigins.push('https://images.unsplash.com');
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src ${imgOrigins.join(' ')}`,
    `connect-src ${Array.from(connectOrigins).join(' ')}`,
    "frame-src 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ];
};

/**
 * Factory for CORS middleware options supporting multi-origin allowlists,
 * safe handling of non-browser requests (no Origin header), credentialed cookies,
 * and preflight OPTIONS handling.
 *
 * @param {string[]} [allowedOrigins=config.allowedOrigins]
 * @returns {object}
 */
export const getCorsOptions = (allowedOrigins = config.allowedOrigins) => {
  const origins = Array.isArray(allowedOrigins) ? allowedOrigins : [];

  return {
    origin: (origin, callback) => {
      // 1. Allow non-browser requests (e.g. server-to-server, curl, mobile, health checks)
      if (!origin) {
        return callback(null, true);
      }

      // 2. Exact match against allowed origins allowlist (no substrings, no wildcards)
      if (origins.includes(origin)) {
        return callback(null, true);
      }

      // 3. Reject unapproved origins without setting Access-Control-Allow-Origin
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-LuxeCart-Client', 'Accept'],
    optionsSuccessStatus: 204,
  };
};

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
  const cspDirectives = buildCspDirectives();
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

/**
 * Factory for CSRF Protection Middleware for Browser-Originated State-Changing Mutations
 *
 * Defense-in-depth model:
 * 1. Safe Methods (GET, HEAD, OPTIONS) pass directly without mutation risk.
 * 2. Origin Validation: When an Origin (or Referer origin) is present:
 *    - It must match one of the exact strings in config.allowedOrigins.
 *    - Untrusted origins are rejected with HTTP 403 (CSRF_ORIGIN_INVALID).
 * 3. Custom Header Enforcement:
 *    - Browser mutations from trusted origins must supply a custom request header
 *      ('X-Requested-With: XMLHttpRequest' or 'X-LuxeCart-Client: 1').
 *    - Because browsers do not allow cross-origin HTML forms (<form method="POST">) or simple
 *      requests to set custom headers without CORS preflight, this completely neutralizes
 *      cross-origin ambient cookie exploitation.
 *    - Missing custom header is rejected with HTTP 403 (CSRF_HEADER_MISSING).
 * 4. Missing Origin Policy:
 *    - If a state-changing request carries authentication cookies (accessToken or refreshToken)
 *      and is identified as browser-originated (or in production mode), but provides neither Origin nor Referer:
 *      It is rejected with HTTP 403 (CSRF_ORIGIN_REQUIRED) because legitimate modern browsers
 *      always send an Origin header on state-changing requests.
 * 5. Programmatic / Non-Browser Clients:
 *    - Server-to-server or programmatic clients that do not rely on browser cookies (e.g. passing
 *      Authorization: Bearer <token>) and do not present browser fetch metadata are permitted
 *      without breaking automated backend tools or CLI test suites.
 *
 * @param {object} [options={}]
 * @param {string[]} [options.allowedOrigins]
 * @param {boolean} [options.isProduction]
 * @returns {import('express').RequestHandler}
 */
export const createCsrfProtection = (options = {}) => {
  return (req, res, next) => {
    const isProd = options.isProduction !== undefined ? options.isProduction : config.isProduction;
    const allowedOrigins = options.allowedOrigins !== undefined
      ? (Array.isArray(options.allowedOrigins) ? options.allowedOrigins : [])
      : (Array.isArray(config.allowedOrigins) ? config.allowedOrigins : []);

    // 1. Safe methods are exempt
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // 2. Extract request origin (Origin header or Referer origin)
    let requestOrigin = req.headers.origin;
    if (!requestOrigin && req.headers.referer) {
      try {
        requestOrigin = new URL(req.headers.referer).origin;
      } catch {
        requestOrigin = null;
      }
    }

    // 3. Check for ambient session cookies and authorization headers
    const hasAuthCookies = Boolean(req.cookies?.accessToken || req.cookies?.refreshToken);
    const hasBearerAuth = Boolean(req.headers.authorization?.startsWith('Bearer '));

    // 4. Case: Origin (or Referer) is provided
    if (requestOrigin) {
      if (!allowedOrigins.includes(requestOrigin)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Untrusted or invalid origin for state-changing operation',
          error: { code: 'CSRF_ORIGIN_INVALID' },
        });
      }

      // Origin is trusted. Require custom request header for browser mutations
      const hasCustomHeader = Boolean(
        req.headers['x-requested-with'] ||
        req.headers['x-luxecart-client']
      );

      if (!hasCustomHeader) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Missing required custom request header for state-changing operation',
          error: { code: 'CSRF_HEADER_MISSING' },
        });
      }

      return next();
    }

    // 5. Case: Origin and Referer are both missing
    // Programmatic / server-to-server requests using Bearer token without cookies are immune to CSRF
    if (hasBearerAuth && !hasAuthCookies) {
      return next();
    }

    // Detect browser origin through Sec-Fetch-Site or browser User-Agent
    const isBrowserRequest = Boolean(
      req.headers['sec-fetch-site'] ||
      (req.headers['user-agent'] && !req.headers['user-agent'].startsWith('node') && !req.headers['user-agent'].startsWith('curl'))
    );

    if (hasAuthCookies) {
      // Browser cookie-authenticated mutations MUST provide Origin
      if (isProd || isBrowserRequest || req.headers['x-test-csrf-strict']) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: State-changing requests using cookie authentication must provide a valid Origin header',
          error: { code: 'CSRF_ORIGIN_REQUIRED' },
        });
      }

      // Non-production test/CLI environments without browser metadata
      return next();
    }

    // If request is from browser but missing origin
    if (isBrowserRequest) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Browser-originated state-changing operation missing Origin header',
        error: { code: 'CSRF_ORIGIN_REQUIRED' },
      });
    }

    // Non-browser / server-to-server client (e.g. CLI, tests, backend workers)
    return next();
  };
};

export const csrfProtection = createCsrfProtection();
