import Product from '../products/product.model.js';
import Category from '../categories/category.model.js';
import { config } from '../../config/env.js';

export const DEFAULT_PUBLIC_SITE_URL = 'https://luxecart-rouge.vercel.app';

const PRIVATE_ROUTE_PREFIXES = [
  '/admin',
  '/account',
  '/cart',
  '/wishlist',
  '/checkout',
  '/orders',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/support',
  '/api',
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isDisallowedCanonicalHost(hostname) {
  if (!hostname) return true;
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h.endsWith('.onrender.com') ||
    h === 'luxecart.com' ||
    h === 'www.luxecart.com'
  );
}

/**
 * Resolves the authoritative canonical frontend origin for sitemap URLs.
 * Rejects backend Render API hosts and legacy placeholder domains.
 *
 * @param {string|null} [baseUrl=null]
 * @param {string|null} [clientUrlConfig=config.clientUrl]
 * @returns {string}
 */
export function resolvePublicFrontendOrigin(baseUrl = null, clientUrlConfig = config.clientUrl) {
  const candidates = [];
  if (baseUrl && typeof baseUrl === 'string') {
    candidates.push(baseUrl);
  }
  if (clientUrlConfig && typeof clientUrlConfig === 'string') {
    candidates.push(...clientUrlConfig.split(','));
  }
  candidates.push(DEFAULT_PUBLIC_SITE_URL);

  for (const raw of candidates) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      if (isDisallowedCanonicalHost(parsed.hostname)) continue;
      return parsed.origin;
    } catch {
      continue;
    }
  }

  return DEFAULT_PUBLIC_SITE_URL;
}

function isEligiblePublicPath(routePath) {
  const lower = String(routePath || '').toLowerCase();
  return !PRIVATE_ROUTE_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`) || lower.startsWith(`${prefix}?`));
}

class SeoService {
  /**
   * Generates dynamic XML sitemap containing homepage, shop, active products, and active categories.
   * Never publishes Render API hostnames, draft/inactive products, or private routes.
   *
   * @param {string|null} [baseUrl=null]
   * @param {object} [deps] - Optional injected models/data for isolated unit testing
   * @returns {Promise<string>}
   */
  async generateSitemapXml(baseUrl = null, deps = {}) {
    const cleanSiteUrl = resolvePublicFrontendOrigin(baseUrl, deps.clientUrl ?? config.clientUrl);

    const ProductModel = deps.ProductModel || Product;
    const CategoryModel = deps.CategoryModel || Category;

    const [products, categories] = await Promise.all([
      ProductModel.find({ status: 'ACTIVE' }).select('slug status category categoryTree updatedAt').lean(),
      CategoryModel.find({ isActive: true }).select('slug isActive parentId updatedAt').lean(),
    ]);

    const activeProducts = (products || []).filter((prod) => prod && (!prod.status || prod.status === 'ACTIVE') && prod.slug);

    // Collect populated category IDs & slugs from active products so empty categories (e.g. lifestyle) are excluded
    const populatedCatKeys = new Set();
    for (const prod of activeProducts) {
      if (prod.category) {
        const key = typeof prod.category === 'object' ? (prod.category._id || prod.category.id || prod.category.slug) : prod.category;
        if (key) populatedCatKeys.add(String(key));
      }
      for (const treeId of prod.categoryTree || []) {
        if (treeId) populatedCatKeys.add(String(treeId));
      }
    }

    const now = new Date().toISOString();
    const seenLocs = new Set();
    const entries = [];

    const addUrl = (routePath, lastMod, changefreq, priority) => {
      if (!isEligiblePublicPath(routePath)) return;
      const fullLoc = `${cleanSiteUrl}${routePath}`;
      if (seenLocs.has(fullLoc)) return;
      seenLocs.add(fullLoc);
      entries.push({ loc: fullLoc, lastmod: lastMod, changefreq, priority });
    };

    // 1. Homepage & Shop Catalog
    addUrl('/', now, 'daily', '1.0');
    addUrl('/shop', now, 'daily', '0.9');

    // 1b. Public Portfolio Policy, Contact & Legal Pages
    addUrl('/contact', now, 'monthly', '0.5');
    addUrl('/privacy-policy', now, 'monthly', '0.5');
    addUrl('/terms', now, 'monthly', '0.5');
    addUrl('/shipping-policy', now, 'monthly', '0.5');
    addUrl('/returns-policy', now, 'monthly', '0.5');

    // 2. Active Populated Public Categories ONLY (exclude categories with 0 active products)
    for (const cat of categories || []) {
      if (cat?.isActive === false || !cat?.slug) continue;
      const slug = String(cat.slug).trim().toLowerCase();
      if (!slug) continue;
      const catIdStr = cat._id || cat.id ? String(cat._id || cat.id) : null;
      const isPopulated = (catIdStr && populatedCatKeys.has(catIdStr)) || populatedCatKeys.has(slug);
      if (!isPopulated) continue;
      const lastMod = cat.updatedAt ? new Date(cat.updatedAt).toISOString() : now;
      addUrl(`/shop?category=${encodeURIComponent(slug)}`, lastMod, 'weekly', '0.8');
    }

    // 3. Active Public Products ONLY (strictly exclude DRAFT / ARCHIVED)
    for (const prod of activeProducts) {
      const slug = String(prod.slug).trim().toLowerCase();
      if (!slug) continue;
      const lastMod = prod.updatedAt ? new Date(prod.updatedAt).toISOString() : now;
      addUrl(`/products/${encodeURIComponent(slug)}`, lastMod, 'weekly', '0.8');
    }

    const urlBlocks = entries
      .map(
        (entry) =>
          `  <url>\n` +
          `    <loc>${escapeXml(entry.loc)}</loc>\n` +
          `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>\n` +
          `    <changefreq>${escapeXml(entry.changefreq)}</changefreq>\n` +
          `    <priority>${escapeXml(entry.priority)}</priority>\n` +
          `  </url>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlBlocks}\n</urlset>\n`;
  }
}

export default new SeoService();
