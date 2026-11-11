/**
 * LuxeCart Build-Time XML Sitemap Generator
 *
 * Strategy:
 * - Runs after `vite build` to produce `client/dist/sitemap.xml` for Vercel CDN delivery
 *   at `https://luxecart-rouge.vercel.app/sitemap.xml`.
 * - Fetches live active products (all pages) and active categories from the public backend API
 *   without requiring MongoDB credentials in Vercel.
 * - Strictly excludes DRAFT/ARCHIVED products, inactive categories, empty categories (0 active
 *   products, such as `lifestyle`), private/auth/cart routes, and never publishes Render API hosts.
 * - Fail-closed on Vercel: if either API request fails, times out, or returns invalid data,
 *   the build fails with a non-zero exit code unless SITEMAP_ALLOW_FALLBACK=true is explicitly set.
 * - Valid empty API responses (0 active products) are treated as genuine and never trigger fallback.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SITE_ORIGIN, getCanonicalSiteOrigin } from '../src/features/settings/utils/seoUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');

export const PRIVATE_ROUTE_PREFIXES = Object.freeze([
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
]);

// Curated fallback manifest (populated categories only; excludes empty `lifestyle`)
// Used ONLY for offline local development builds when the API is unavailable.
export const CURATED_FALLBACK_CATEGORIES = Object.freeze([
  'men',
  'women',
  'footwear',
  'beauty',
  'accessories',
  'mens-apparel',
  'mens-t-shirts',
  'mens-shirts',
  'mens-jeans',
  'womens-apparel',
  'womens-dresses',
  'womens-tops',
  'womens-kurta-sets',
  'womens-trousers',
  'sneakers',
  'loafers',
  'skincare',
  'face-serum',
  'bags',
  'shoulder-bags',
]);

export const CURATED_FALLBACK_PRODUCTS = Object.freeze([
  'aurelio-essential-oversized-t-shirt',
  'northline-oxford-casual-shirt',
  'veyron-relaxed-linen-shirt',
  'urban-form-straight-fit-denim',
  'elane-satin-midi-dress',
  'mirae-ribbed-knit-top',
  'nivara-printed-kurta-set',
  'velora-wide-leg-trousers',
  'vanta-retro-runner-sneakers',
  'stride-minimal-leather-loafers',
  'nivelle-vitamin-c-brightening-serum',
  'aurelia-structured-shoulder-bag',
]);

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function isPrivateOrDisallowedPath(routePath) {
  const lower = String(routePath || '').trim().toLowerCase();
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => lower === prefix || lower.startsWith(`${prefix}/`) || lower.startsWith(`${prefix}?`)
  );
}

/**
 * Recursively flattens a nested category tree from GET /api/v1/categories,
 * attaching resolved parentSlug/parentId links for upward ancestor propagation.
 * Excludes inactive categories cleanly.
 *
 * @param {Array<object>} nodes
 * @param {Array<object>} [acc=[]]
 * @param {string|null} [parentSlug=null]
 * @returns {Array<object>}
 */
export function flattenActiveCategories(nodes = [], acc = [], parentSlug = null) {
  for (const node of nodes || []) {
    if (!node || typeof node !== 'object') continue;
    const slug = typeof node.slug === 'string' ? node.slug.trim().toLowerCase() : null;
    if (node.isActive !== false && slug) {
      acc.push({
        ...node,
        slug,
        _resolvedParentSlug: parentSlug,
      });
    }
    if (Array.isArray(node.children) && node.children.length > 0 && node.isActive !== false) {
      flattenActiveCategories(node.children, acc, slug || parentSlug);
    }
  }
  return acc;
}

/**
 * Filters flattened active categories to ONLY those that have >= 1 eligible active product
 * (either directly via product.category / product.categoryTree or as an ancestor of a populated leaf).
 *
 * @param {Array<object>} flatActiveCategories
 * @param {Array<object>} activeProducts
 * @returns {Array<object>}
 */
export function filterPopulatedCategories(flatActiveCategories = [], activeProducts = []) {
  if (!Array.isArray(activeProducts) || activeProducts.length === 0) {
    return [];
  }

  const byId = new Map();
  const bySlug = new Map();

  for (const cat of flatActiveCategories) {
    if (!cat || cat.isActive === false || !cat.slug) continue;
    const slug = String(cat.slug).trim().toLowerCase();
    const id = cat._id || cat.id;
    const entry = { ...cat, slug };
    bySlug.set(slug, entry);
    if (id !== undefined && id !== null) {
      byId.set(String(id), entry);
    }
  }

  const populatedSlugs = new Set();

  const markWithAncestors = (catEntry) => {
    const visited = new Set();
    let curr = catEntry;
    while (curr && curr.slug && !visited.has(curr.slug)) {
      visited.add(curr.slug);
      populatedSlugs.add(curr.slug);

      if (curr._resolvedParentSlug && bySlug.has(curr._resolvedParentSlug)) {
        curr = bySlug.get(curr._resolvedParentSlug);
      } else if (curr.parentId && byId.has(String(curr.parentId))) {
        curr = byId.get(String(curr.parentId));
      } else {
        break;
      }
    }
  };

  for (const prod of activeProducts) {
    if (!prod || (prod.status && prod.status !== 'ACTIVE')) continue;

    // 1. Leaf product.category (object or ID string)
    if (prod.category && typeof prod.category === 'object') {
      const catId = prod.category._id || prod.category.id;
      const catSlug = prod.category.slug ? String(prod.category.slug).trim().toLowerCase() : null;
      if (catSlug && bySlug.has(catSlug)) {
        markWithAncestors(bySlug.get(catSlug));
      } else if (catId && byId.has(String(catId))) {
        markWithAncestors(byId.get(String(catId)));
      }
    } else if (prod.category) {
      const catStr = String(prod.category).trim();
      if (byId.has(catStr)) {
        markWithAncestors(byId.get(catStr));
      } else if (bySlug.has(catStr.toLowerCase())) {
        markWithAncestors(bySlug.get(catStr.toLowerCase()));
      }
    }

    // 2. product.categorySlug fallback if supplied
    if (prod.categorySlug) {
      const slugKey = String(prod.categorySlug).trim().toLowerCase();
      if (bySlug.has(slugKey)) {
        markWithAncestors(bySlug.get(slugKey));
      }
    }

    // 3. product.categoryTree array (IDs or objects)
    if (Array.isArray(prod.categoryTree)) {
      for (const treeEntry of prod.categoryTree) {
        if (!treeEntry) continue;
        if (typeof treeEntry === 'object') {
          const slug = treeEntry.slug ? String(treeEntry.slug).trim().toLowerCase() : null;
          const id = treeEntry._id || treeEntry.id;
          if (slug && bySlug.has(slug)) markWithAncestors(bySlug.get(slug));
          else if (id && byId.has(String(id))) markWithAncestors(byId.get(String(id)));
        } else {
          const key = String(treeEntry).trim();
          if (byId.has(key)) markWithAncestors(byId.get(key));
          else if (bySlug.has(key.toLowerCase())) markWithAncestors(bySlug.get(key.toLowerCase()));
        }
      }
    }
  }

  return flatActiveCategories.filter((c) => c?.slug && populatedSlugs.has(String(c.slug).trim().toLowerCase()));
}

/**
 * Builds valid XML sitemap content from eligible categories & active products using the
 * centralized canonical frontend origin (never Render API hosts).
 *
 * @param {object} params
 * @param {string} [params.siteOrigin]
 * @param {Array<object>} [params.categories]
 * @param {Array<object>} [params.products]
 * @param {string} [params.generatedAt]
 * @returns {string}
 */
export function buildSitemapXml({
  siteOrigin = null,
  categories = [],
  products = [],
  generatedAt = new Date().toISOString(),
} = {}) {
  const cleanOrigin = getCanonicalSiteOrigin(siteOrigin) || DEFAULT_SITE_ORIGIN;
  const seen = new Set();
  const entries = [];

  const addEntry = (routePath, lastmod, changefreq, priority) => {
    if (!routePath || isPrivateOrDisallowedPath(routePath)) return;
    const loc = `${cleanOrigin}${routePath}`;
    if (seen.has(loc)) return;
    seen.add(loc);
    entries.push({ loc, lastmod: lastmod || generatedAt, changefreq, priority });
  };

  // 1. Core Public Storefront Routes
  addEntry('/', generatedAt, 'daily', '1.0');
  addEntry('/shop', generatedAt, 'daily', '0.9');

  // 1b. Public Portfolio Policy, Contact & Legal Disclosure Routes
  addEntry('/contact', generatedAt, 'monthly', '0.5');
  addEntry('/privacy-policy', generatedAt, 'monthly', '0.5');
  addEntry('/terms', generatedAt, 'monthly', '0.5');
  addEntry('/shipping-policy', generatedAt, 'monthly', '0.5');
  addEntry('/returns-policy', generatedAt, 'monthly', '0.5');

  // 2. Public Populated Active Category Routes
  for (const cat of categories) {
    if (!cat || cat.isActive === false) continue;
    const slug = typeof cat === 'string' ? cat : cat.slug;
    if (!slug || typeof slug !== 'string') continue;
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug) continue;
    const lastMod = cat.updatedAt ? new Date(cat.updatedAt).toISOString() : generatedAt;
    addEntry(`/shop?category=${encodeURIComponent(cleanSlug)}`, lastMod, 'weekly', '0.8');
  }

  // 3. Eligible Active Product Routes (strictly exclude DRAFT / ARCHIVED)
  for (const prod of products) {
    if (!prod) continue;
    if (typeof prod === 'object' && prod.status && prod.status !== 'ACTIVE') continue;
    const slug = typeof prod === 'string' ? prod : prod.slug;
    if (!slug || typeof slug !== 'string') continue;
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug) continue;
    const lastMod = prod.updatedAt ? new Date(prod.updatedAt).toISOString() : generatedAt;
    addEntry(`/products/${encodeURIComponent(cleanSlug)}`, lastMod, 'weekly', '0.8');
  }

  const urlXml = entries
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

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlXml}\n</urlset>\n`;
}

function readEnvApiUrlFallback() {
  if (process.env.SITEMAP_API_URL) return process.env.SITEMAP_API_URL;
  if (process.env.VITE_API_URL) return process.env.VITE_API_URL;

  const envPath = path.join(clientRoot, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^VITE_API_URL\s*=\s*(.+)$/);
      if (match && match[1]) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return process.env.VERCEL ? 'https://luxecart-8ek0.onrender.com/api/v1' : '';
}

async function fetchJsonWithRetry(fetchImpl, url, { timeoutMs = 15000, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res || !res.ok) {
        throw new Error(`HTTP ${res?.status ?? 'UNKNOWN'} from ${url}`);
      }
      const parsed = await res.json();
      if (!parsed || typeof parsed !== 'object' || parsed.success === false) {
        throw new Error(`Invalid API JSON payload from ${url}`);
      }
      return parsed;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
    }
  }
  throw lastError;
}

function extractProductsArray(payload, url) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.products)) return payload.data.products;
  throw new Error(`Malformed products array in response from ${url}`);
}

function extractCategoriesArray(payload, url) {
  if (Array.isArray(payload?.data?.categories)) return payload.data.categories;
  if (Array.isArray(payload?.data)) return payload.data;
  throw new Error(`Malformed categories array in response from ${url}`);
}

/**
 * Fetches eligible active products (all pages) and active categories from public API endpoints.
 * - Valid empty API responses (0 active products) succeed and never fall back to static lists.
 * - Fails closed on Vercel if either API request fails unless SITEMAP_ALLOW_FALLBACK=true is set.
 * - Permits curated fallback strictly for offline local development workflows.
 *
 * @param {object} [options={}]
 * @returns {Promise<{ xml: string, source: 'api'|'fallback', productCount: number, categoryCount: number }>}
 */
export async function generateSitemap(options = {}) {
  const isVercelBuild = options.isVercel !== undefined ? Boolean(options.isVercel) : Boolean(process.env.VERCEL);
  const allowFallback =
    options.allowFallback !== undefined
      ? Boolean(options.allowFallback)
      : !isVercelBuild || process.env.SITEMAP_ALLOW_FALLBACK === 'true';

  const {
    apiBaseUrl = readEnvApiUrlFallback(),
    siteOrigin = process.env.VITE_SITE_URL || DEFAULT_SITE_ORIGIN,
    fetchImpl = typeof fetch !== 'undefined' ? fetch : null,
    timeoutMs = isVercelBuild ? 45000 : 8000,
    outputPath = null,
  } = options;

  let categories = [];
  let products = [];
  let apiSucceeded = false;
  let apiFailureError = null;

  const cleanApiBase = apiBaseUrl ? String(apiBaseUrl).trim().replace(/\/+$/, '') : '';

  if (cleanApiBase && fetchImpl) {
    try {
      const page1Url = `${cleanApiBase}/products?limit=50&page=1`;
      const catsUrl = `${cleanApiBase}/categories`;

      // Both required API endpoints must succeed
      const [prodPage1, catRes] = await Promise.all([
        fetchJsonWithRetry(fetchImpl, page1Url, { timeoutMs, retries: 1 }),
        fetchJsonWithRetry(fetchImpl, catsUrl, { timeoutMs, retries: 1 }),
      ]);

      const rawProducts = [...extractProductsArray(prodPage1, page1Url)];
      const rawCategories = extractCategoriesArray(catRes, catsUrl);

      const totalPages = Math.max(1, Number(prodPage1?.meta?.pagination?.totalPages || 1));
      for (let page = 2; page <= totalPages; page++) {
        const nextUrl = `${cleanApiBase}/products?limit=50&page=${page}`;
        const nextPage = await fetchJsonWithRetry(fetchImpl, nextUrl, { timeoutMs, retries: 1 });
        rawProducts.push(...extractProductsArray(nextPage, nextUrl));
      }

      const activeProds = rawProducts.filter((p) => p && (!p.status || p.status === 'ACTIVE'));
      const flatActiveCats = flattenActiveCategories(rawCategories);
      const populatedCats = filterPopulatedCategories(flatActiveCats, activeProds);

      // Mark API retrieval successful regardless of whether activeProds is empty (0 products)
      products = activeProds;
      categories = populatedCats;
      apiSucceeded = true;
    } catch (err) {
      apiFailureError = err;
    }
  } else {
    apiFailureError = new Error(
      !cleanApiBase ? 'Missing public API base URL for sitemap generation.' : 'Fetch implementation unavailable.'
    );
  }

  let source = 'api';
  if (!apiSucceeded) {
    if (!allowFallback) {
      const reason = apiFailureError?.message || 'Catalog API retrieval failed';
      throw new Error(`[Sitemap Aborted] Cannot generate reliable sitemap in fail-closed mode: ${reason}`);
    }
    console.warn(
      `[Sitemap] Live catalog API unavailable (${apiFailureError?.message || 'unknown error'}); using local fallback catalog.`
    );
    source = 'fallback';
    categories = CURATED_FALLBACK_CATEGORIES.map((slug) => ({ slug, isActive: true }));
    products = CURATED_FALLBACK_PRODUCTS.map((slug) => ({ slug, status: 'ACTIVE' }));
  }

  const xml = buildSitemapXml({ siteOrigin, categories, products });

  if (outputPath) {
    const resolvedOut = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
    fs.writeFileSync(resolvedOut, xml, 'utf8');
  }

  return {
    xml,
    source,
    productCount: products.length,
    categoryCount: categories.length,
  };
}

// CLI execution when run via `npm run build` or `node scripts/generateSitemap.mjs`
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const staticPublicSitemap = path.join(clientRoot, 'public', 'sitemap.xml');
  if (fs.existsSync(staticPublicSitemap)) {
    console.warn('[Sitemap Warning] Static client/public/sitemap.xml detected and may shadow generated dist/sitemap.xml.');
  }

  const distOutput = path.join(clientRoot, 'dist', 'sitemap.xml');
  generateSitemap({ outputPath: distOutput })
    .then((result) => {
      console.log(
        `[Sitemap] Generated ${distOutput} (source=${result.source}, categories=${result.categoryCount}, products=${result.productCount})`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Sitemap] Generation failed:', err.message);
      process.exit(1);
    });
}
