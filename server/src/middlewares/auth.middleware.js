import { verifyAccessToken } from '../utils/token.js';
import { sendError } from '../utils/response.js';

/**
 * Middleware to authenticate requests via HTTP-only cookie or Authorization header
 */
export const authenticate = (req, res, next) => {
  let token = req.cookies?.accessToken;

  // Fallback to Bearer token header if present
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return sendError(res, 401, 'Authentication required', 'UNAUTHENTICATED');
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Access token has expired', 'TOKEN_EXPIRED');
    }
    return sendError(res, 401, 'Invalid access token', 'INVALID_TOKEN');
  }
};

/**
 * Middleware to authorize specific roles
 * @param  {...string} roles
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required', 'UNAUTHENTICATED');
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, 'Forbidden: You do not have permission to perform this action', 'FORBIDDEN');
    }

    next();
  };
};
