import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requestLogger } from './middlewares/logger.middleware.js';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware.js';
import { securityHeaders, noSqlSanitizer } from './middlewares/security.middleware.js';
import { globalRateLimiter } from './middlewares/rateLimiter.middleware.js';
import apiRoutes from './routes/api.routes.js';
import { config } from './config/env.js';

const app = express();

// 1. Security Headers Middleware (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
app.use(securityHeaders);

// 2. CORS configuration
const allowedOrigins = config.clientUrl ? [config.clientUrl] : ['http://localhost:5173'];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // Enable cookie credentials
  })
);

// 3. Body parsers
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. NoSQL Query Injection Sanitizer
app.use(noSqlSanitizer);

// 5. Global API Rate Limiter
app.use('/api', globalRateLimiter);

// 6. Minimal dev request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger);
}

// 7. API Routes
app.use('/api/v1', apiRoutes);

// 8. Fallback handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
