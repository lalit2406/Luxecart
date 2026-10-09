import { Router } from 'express';
import {
  register,
  login,
  googleAuth,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  getCurrentUser,
} from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authRateLimiter } from '../../middlewares/rateLimiter.middleware.js';

const router = Router();

// Public routes (rate-limited against abuse / brute force)
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/google', authRateLimiter, googleAuth);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes
router.get('/me', authenticate, getCurrentUser);

export default router;
