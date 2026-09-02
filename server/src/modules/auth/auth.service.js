import User from '../users/user.model.js';
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../../utils/token.js';
import { config } from '../../config/env.js';

class AuthService {
  /**
   * Register a new CUSTOMER user
   * @param {{ name: string, email: string, password: string, phone?: string }} data
   * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
   */
  async register({ name, email, password, phone }) {
    // 1. Check for duplicate account
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const error = new Error('An account with this email already exists');
      error.statusCode = 409;
      error.code = 'DUPLICATE_EMAIL';
      throw error;
    }

    // 2. Hash password
    const passwordHash = await hashPassword(password);

    // 3. Create User (Always enforce CUSTOMER role for public registration)
    const user = new User({
      name,
      email,
      passwordHash,
      phone,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      refreshTokens: [],
    });

    // 4. Generate JWT tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 5. Store hashed refresh token for revocation and rotation
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + config.jwt.refreshMaxAgeMs);

    user.refreshTokens.push({
      tokenHash: refreshTokenHash,
      createdAt: new Date(),
      expiresAt,
    });

    await user.save();

    return {
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Authenticate user with credentials
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
   */
  async login({ email, password }) {
    // 1. Find user by normalized email including passwordHash & refreshTokens
    const user = await User.findOne({ email }).select('+passwordHash +refreshTokens');

    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // 2. Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // 3. Check account status
    if (user.status !== 'ACTIVE') {
      const error = new Error(`Account is ${user.status.toLowerCase()}`);
      error.statusCode = 403;
      error.code = 'ACCOUNT_INACTIVE';
      throw error;
    }

    // 4. Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 5. Prune expired tokens and maintain maximum 5 active sessions
    const now = new Date();
    const activeTokens = (user.refreshTokens || []).filter((t) => t.expiresAt > now);

    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + config.jwt.refreshMaxAgeMs);

    activeTokens.push({
      tokenHash: refreshTokenHash,
      createdAt: now,
      expiresAt,
    });

    // Keep at most 5 recent sessions
    user.refreshTokens = activeTokens.slice(-5);
    await user.save();

    return {
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Validate and rotate refresh token
   * @param {string} rawRefreshToken
   * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
   */
  async refresh(rawRefreshToken) {
    if (!rawRefreshToken) {
      const error = new Error('Refresh token is required');
      error.statusCode = 401;
      error.code = 'REFRESH_TOKEN_REQUIRED';
      throw error;
    }

    // 1. Verify token cryptographic signature
    let decoded;
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch {
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      error.code = 'INVALID_REFRESH_TOKEN';
      throw error;
    }

    // 2. Find user
    const user = await User.findById(decoded.sub).select('+refreshTokens');
    if (!user || user.status !== 'ACTIVE') {
      const error = new Error('User not found or account is inactive');
      error.statusCode = 401;
      error.code = 'INVALID_REFRESH_TOKEN';
      throw error;
    }

    // 3. Check token existence in user's refresh token store (detect reuse / revocation)
    const tokenHash = hashToken(rawRefreshToken);
    const tokenIndex = (user.refreshTokens || []).findIndex((t) => t.tokenHash === tokenHash);

    if (tokenIndex === -1) {
      // Possible token reuse attack — invalidate all sessions for safety
      user.refreshTokens = [];
      await user.save();
      const error = new Error('Refresh token has been revoked or already used');
      error.statusCode = 401;
      error.code = 'REVOKED_REFRESH_TOKEN';
      throw error;
    }

    // 4. Remove old token (Rotation)
    user.refreshTokens.splice(tokenIndex, 1);

    // 5. Generate new pair
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + config.jwt.refreshMaxAgeMs);

    user.refreshTokens.push({
      tokenHash: newTokenHash,
      createdAt: new Date(),
      expiresAt,
    });

    await user.save();

    return {
      user: user.toSafeObject(),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Log out user and revoke session token
   * @param {string} [userId]
   * @param {string} [rawRefreshToken]
   */
  async logout(userId, rawRefreshToken) {
    if (!userId && !rawRefreshToken) {
      return;
    }

    try {
      let targetUserId = userId;
      if (!targetUserId && rawRefreshToken) {
        try {
          const decoded = verifyRefreshToken(rawRefreshToken);
          targetUserId = decoded.sub;
        } catch {
          // Token already invalid/expired, continue
        }
      }

      if (targetUserId) {
        const user = await User.findById(targetUserId).select('+refreshTokens');
        if (user && rawRefreshToken) {
          const tokenHash = hashToken(rawRefreshToken);
          user.refreshTokens = (user.refreshTokens || []).filter((t) => t.tokenHash !== tokenHash);
          await user.save();
        }
      }
    } catch {
      // Never block logout on error
    }
  }

  /**
   * Fetch current authenticated user by ID
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getCurrentUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    if (user.status !== 'ACTIVE') {
      const error = new Error(`Account is ${user.status.toLowerCase()}`);
      error.statusCode = 403;
      error.code = 'ACCOUNT_INACTIVE';
      throw error;
    }

    return user.toSafeObject();
  }
}

export default new AuthService();
