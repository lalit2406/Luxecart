import { Router } from 'express';
import { register, login, refresh, logout, getCurrentUser } from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authRateLimiter } from '../../middlewares/rateLimiter.middleware.js';

const router = Router();

// Public routes (rate-limited against brute force)
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes
router.get('/me', authenticate, getCurrentUser);

export default router;
