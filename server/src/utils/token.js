import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config/env.js';

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Hash plaintext password
 * @param {string} password
 * @returns {Promise<string>}
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

/**
 * Compare password with hash
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Compute SHA-256 hash of a token for secure database storage
 * @param {string} token
 * @returns {string}
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate a cryptographically secure random password reset token and its SHA-256 hash
 * @returns {{ rawToken: string, tokenHash: string }}
 */
export const generateResetToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
};

/**
 * Generate short-lived JWT Access Token
 * @param {object} user
 * @returns {string}
 */
export const generateAccessToken = (user) => {
  const payload = {
    sub: user._id ? user._id.toString() : user.id,
    role: user.role,
  };

  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
};

/**
 * Generate long-lived JWT Refresh Token
 * @param {object} user
 * @returns {string}
 */
export const generateRefreshToken = (user) => {
  const payload = {
    sub: user._id ? user._id.toString() : user.id,
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
};

/**
 * Verify JWT Access Token
 * @param {string} token
 * @returns {object} Decoded payload
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.accessSecret);
};

/**
 * Verify JWT Refresh Token
 * @param {string} token
 * @returns {object} Decoded payload
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret);
};

/**
 * Base options for authentication cookies
 */
const getCookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  domain: config.cookie.domain,
  path: '/',
  maxAge: maxAgeMs,
});

/**
 * Set secure HTTP-only cookies on Express response
 * @param {import('express').Response} res
 * @param {string} accessToken
 * @param {string} refreshToken
 */
export const setAuthCookies = (res, accessToken, refreshToken) => {
  if (accessToken) {
    res.cookie('accessToken', accessToken, getCookieOptions(config.jwt.accessMaxAgeMs));
  }
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, getCookieOptions(config.jwt.refreshMaxAgeMs));
  }
};

/**
 * Clear authentication cookies on Express response
 * @param {import('express').Response} res
 */
export const clearAuthCookies = (res) => {
  const clearOptions = {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: '/',
  };

  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
};
