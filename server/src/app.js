import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requestLogger } from './middlewares/logger.middleware.js';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware.js';
import { securityHeaders, noSqlSanitizer, getCorsOptions, csrfProtection } from './middlewares/security.middleware.js';
import { globalRateLimiter } from './middlewares/rateLimiter.middleware.js';
import apiRoutes from './routes/api.routes.js';
import { config } from './config/env.js';

const app = express();

// 0. Topology-Aware Express Trust Proxy Configuration (Render / Reverse Proxy)
if (config.trustProxy !== false) {
  app.set('trust proxy', config.trustProxy);
} else {
  app.set('trust proxy', false);
}

// 1. Security Headers Middleware (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
app.use(securityHeaders);

// 2. CORS configuration (Multi-Origin, Preflight OPTIONS, and Strict Origin Matching)
app.use(cors(getCorsOptions()));

// 3. Body parsers
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. NoSQL Query Injection Sanitizer
app.use(noSqlSanitizer);

// 5. Global API Rate Limiter
app.use('/api', globalRateLimiter);

// 6. CSRF Protection Middleware for Browser-Originated Mutations
app.use('/api', csrfProtection);

// 7. Minimal dev request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger);
}

// 7. API Routes (canonical /api/v1 and direct /api routing)
app.use('/api/v1', apiRoutes);
app.use('/api', (req, res, next) => {
  if (req.url.startsWith('/v1')) return next();
  return apiRoutes(req, res, next);
});

// 8. Fallback handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
