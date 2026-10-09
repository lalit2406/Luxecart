import User from '../users/user.model.js';
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateResetToken,
} from '../../utils/token.js';
import { config } from '../../config/env.js';
import emailService from '../../services/email.service.js';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();

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

    // 2. Verify password (Google-only accounts without password will safely fail comparison)
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
   * Authenticate or register user via Google Identity Services
   * @param {string} credential Google ID Token
   * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
   */
  async googleAuth(credential) {
    if (!config.google.clientId) {
      const error = new Error('Google Sign-In is not configured on the server (missing GOOGLE_CLIENT_ID)');
      error.statusCode = 500;
      error.code = 'GOOGLE_AUTH_UNCONFIGURED';
      throw error;
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.google.clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      const error = new Error(`Google token verification failed: ${err.message || 'Invalid token'}`);
      error.statusCode = 401;
      error.code = 'INVALID_GOOGLE_TOKEN';
      throw error;
    }

    if (!payload || !payload.sub || !payload.email) {
      const error = new Error('Google ID token is missing required claims (sub, email)');
      error.statusCode = 400;
      error.code = 'INVALID_GOOGLE_PAYLOAD';
      throw error;
    }

    const { sub: googleId, email: rawEmail, name, picture: avatar } = payload;
    const email = rawEmail.trim().toLowerCase();

    // 1. Check if user already exists by googleId
    let user = await User.findOne({ googleId }).select('+refreshTokens');

    // 2. If not found by googleId, check by normalized email
    if (!user) {
      user = await User.findOne({ email }).select('+refreshTokens');
      if (user) {
        // Link Google ID to existing account without elevating privileges
        user.googleId = googleId;
        if (!user.avatar && avatar) {
          user.avatar = avatar;
        }
      }
    }

    // 3. If no existing user, create new CUSTOMER account
    if (!user) {
      user = new User({
        name: name || 'LuxeCart Customer',
        email,
        googleId,
        avatar: avatar || undefined,
        role: 'CUSTOMER', // Always CUSTOMER
        status: 'ACTIVE',
        refreshTokens: [],
      });
    }

    // 4. Verify account status
    if (user.status !== 'ACTIVE') {
      const error = new Error(`Account is ${user.status.toLowerCase()}`);
      error.statusCode = 403;
      error.code = 'ACCOUNT_INACTIVE';
      throw error;
    }

    // 5. Generate session tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const now = new Date();
    const activeTokens = (user.refreshTokens || []).filter((t) => t.expiresAt > now);
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + config.jwt.refreshMaxAgeMs);

    activeTokens.push({
      tokenHash: refreshTokenHash,
      createdAt: now,
      expiresAt,
    });

    user.refreshTokens = activeTokens.slice(-5);
    await user.save();

    return {
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Request password reset token and send transactional email
   * Returns a timing-safe generic response regardless of email existence
   * @param {string} email
   * @returns {Promise<{ message: string }>}
   */
  async forgotPassword(email) {
    const genericMessage = 'If an account exists with this email address, we have sent a password reset link.';

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || user.status !== 'ACTIVE') {
      return { message: genericMessage };
    }

    // Generate secure random reset token
    const { rawToken, tokenHash } = generateResetToken();
    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await user.save();

    // Construct reset URL for frontend
    const resetUrl = `${config.clientUrl}/reset-password/${rawToken}`;

    // Send transactional email via Resend
    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });

    return { message: genericMessage };
  }

  /**
   * Reset user password using verified single-use reset token
   * @param {{ token: string, password: string }} data
   * @returns {Promise<{ message: string }>}
   */
  async resetPassword({ token, password }) {
    const tokenHash = hashToken(token);

    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordTokenHash +resetPasswordExpires +refreshTokens');

    if (!user) {
      const error = new Error('Password reset token is invalid or has expired');
      error.statusCode = 400;
      error.code = 'INVALID_RESET_TOKEN';
      throw error;
    }

    // 1. Hash new password
    const newPasswordHash = await hashPassword(password);
    user.passwordHash = newPasswordHash;

    // 2. Invalidate single-use reset token
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;

    // 3. Revoke existing refresh tokens/sessions for security
    user.refreshTokens = [];

    await user.save();

    return { message: 'Password has been reset successfully. You may now log in with your new password.' };
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
