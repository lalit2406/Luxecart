import { Router } from 'express';
import { getSitemapXml } from './seo.controller.js';

const router = Router();

// Public sitemap endpoint
router.get('/sitemap.xml', getSitemapXml);

export default router;
