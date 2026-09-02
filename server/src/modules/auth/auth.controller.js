import authService from './auth.service.js';
import { validateRegisterInput, validateLoginInput } from '../../validators/auth.validator.js';
import { setAuthCookies, clearAuthCookies } from '../../utils/token.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Register a new customer
 */
export const register = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateRegisterInput(req.body);

    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const { user, accessToken, refreshToken } = await authService.register(sanitized);

    // Set secure HTTP-only cookies
    setAuthCookies(res, accessToken, refreshToken);

    return sendSuccess(res, 201, 'User registered successfully', { user });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user with email and password
 */
export const login = async (req, res, next) => {
  try {
    const { isValid, errors, sanitized } = validateLoginInput(req.body);

    if (!isValid) {
      const error = new Error(errors[0]);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      error.details = errors;
      throw error;
    }

    const { user, accessToken, refreshToken } = await authService.login(sanitized);

    // Set secure HTTP-only cookies
    setAuthCookies(res, accessToken, refreshToken);

    return sendSuccess(res, 200, 'Logged in successfully', { user });
  } catch (error) {
    next(error);
  }
};

/**
 * Rotate refresh token and issue new access token
 */
export const refresh = async (req, res, next) => {
  try {
    // Read refresh token from HTTP-only cookie or request body
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!rawRefreshToken) {
      const error = new Error('Refresh token is required');
      error.statusCode = 401;
      error.code = 'REFRESH_TOKEN_REQUIRED';
      throw error;
    }

    const { user, accessToken, refreshToken } = await authService.refresh(rawRefreshToken);

    // Set updated secure HTTP-only cookies
    setAuthCookies(res, accessToken, refreshToken);

    return sendSuccess(res, 200, 'Token refreshed successfully', { user });
  } catch (error) {
    clearAuthCookies(res);
    next(error);
  }
};

/**
 * Logout and invalidate session cookies
 */
export const logout = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const userId = req.user?.id || req.user?._id;

    await authService.logout(userId, rawRefreshToken);

    // Clear HTTP-only cookies
    clearAuthCookies(res);

    return sendSuccess(res, 200, 'Logged out successfully', {});
  } catch (error) {
    clearAuthCookies(res);
    next(error);
  }
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await authService.getCurrentUser(userId);

    return sendSuccess(res, 200, 'Authenticated user fetched successfully', { user });
  } catch (error) {
    next(error);
  }
};
