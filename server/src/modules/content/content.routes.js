import { Router } from 'express';
import { getPublicHomepageContent } from './content.controller.js';

const router = Router();

// Public Storefront Homepage Content Route (No authentication required)
router.get('/homepage', getPublicHomepageContent);

export default router;
