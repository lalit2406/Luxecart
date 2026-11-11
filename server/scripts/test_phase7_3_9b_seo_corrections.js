/**
 * LUXECART PHASE 7.3.9B & 7.3.9B.2: CRITICAL SEO CORRECTIONS VERIFICATION SUITE
 *
 * Strictly offline / in-memory tests (zero live Atlas, Render, or external API calls).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const results = [];

function record(id, description, passed, details = '') {
  results.push({ id, description, passed, details });
  const badge = passed ? '✔ [PASS]' : '✖ [FAIL]';
  console.log(`${badge} [${id}] ${description}`);
  if (!passed && details) {
    console.error(`    ↳ ${details}`);
  }
}

async function runTests() {
  console.log('\n======================================================================');
  console.log('   LUXECART PHASE 7.3.9B.2: SEO CORRECTIONS & REGRESSION TEST SUITE');
  console.log('======================================================================\n');

  const seoUtilsPath = path.join(rootDir, 'client/src/features/settings/utils/seoUtils.js');
  const generateSitemapPath = path.join(rootDir, 'client/scripts/generateSitemap.mjs');
  const seoServicePath = path.join(rootDir, 'server/src/modules/seo/seo.service.js');

  const seoUtils = await import(`file://${seoUtilsPath.replace(/\\/g, '/')}`);
  const sitemapGen = await import(`file://${generateSitemapPath.replace(/\\/g, '/')}`);
  const seoServiceModule = await import(`file://${seoServicePath.replace(/\\/g, '/')}`);
  const seoService = seoServiceModule.default;

  const TARGET_ORIGIN = 'https://luxecart-rouge.vercel.app';
  const RENDER_ORIGIN = 'https://luxecart-8ek0.onrender.com';

  // -------------------------------------------------------------------------
  // 1. Product JSON-LD Pricing, Edge Cases & Offer Omission Tests (Fix 2)
  // -------------------------------------------------------------------------
  try {
    const baseProduct = {
      _id: 'prod123',
      name: 'Aurelio Essential Oversized T-Shirt',
      slug: 'aurelio-essential-oversized-t-shirt',
      brand: 'Aurelio',
      description: 'Heavyweight cotton oversized T-shirt.',
      category: {
        _id: 'catLeaf',
        name: 'T-Shirts',
        slug: 'mens-t-shirts',
        ancestors: [
          { _id: 'catRoot', name: 'MEN', slug: 'men' },
          { _id: 'catMid', name: 'Apparel', slug: 'mens-apparel' },
        ],
      },
      variants: [
        { sku: 'AUR-TEE-001-BLK-M', price: 899, mrp: 1499, inventory: { stock: 18 }, isActive: true },
      ],
      priceSummary: { minPrice: 899, minMrp: 1499 },
      ratings: { average: 0, count: 0 },
    };

    const images = [
      { url: 'https://res.cloudinary.com/luxecart-india/image/upload/v1/luxecart/products/tee/front.jpg' },
    ];

    // Valid prices: 899, 1, '899', '1.5'
    assert.strictEqual(seoUtils.formatOfferPriceInr(899), '899.00');
    assert.strictEqual(seoUtils.formatOfferPriceInr(1), '1.00');
    assert.strictEqual(seoUtils.formatOfferPriceInr('899'), '899.00');
    assert.strictEqual(seoUtils.formatOfferPriceInr(' 1499.5 '), '1499.50');

    // Invalid prices: 0, -1, null, undefined, NaN, Infinity, -Infinity, invalid strings, boolean
    for (const invalid of [0, -1, null, undefined, NaN, Infinity, -Infinity, '', '   ', 'abc', '0', '-10', true, false, {}]) {
      assert.strictEqual(
        seoUtils.formatOfferPriceInr(invalid),
        null,
        `Expected formatOfferPriceInr(${String(invalid)}) to return null`
      );
    }

    // Valid 899 product emits Offer with "899.00" INR
    const [productSchema, breadcrumbSchema] = seoUtils.buildProductStructuredData(
      baseProduct,
      baseProduct.variants[0],
      images,
      false
    );
    assert.strictEqual(productSchema.offers.price, '899.00');
    assert.strictEqual(productSchema.offers.priceCurrency, 'INR');
    assert.strictEqual(productSchema.offers.availability, 'https://schema.org/InStock');
    assert.strictEqual(
      productSchema.offers.url,
      `${TARGET_ORIGIN}/products/aurelio-essential-oversized-t-shirt`
    );

    // OutOfStock preserves availability
    const [outOfStockSchema] = seoUtils.buildProductStructuredData(
      baseProduct,
      baseProduct.variants[0],
      images,
      true
    );
    assert.strictEqual(outOfStockSchema.offers.availability, 'https://schema.org/OutOfStock');

    // Missing selectedVariant.price falls back to valid product.priceSummary.minPrice
    const [fallbackPriceSchema] = seoUtils.buildProductStructuredData(
      { ...baseProduct, priceSummary: { minPrice: 1499 } },
      { sku: 'AUR-MISSING-PRICE' }, // price is undefined
      images,
      false
    );
    assert.strictEqual(fallbackPriceSchema.offers?.price, '1499.00');

    const [nullVariantSchema] = seoUtils.buildProductStructuredData(
      { ...baseProduct, priceSummary: { minPrice: 1299 } },
      null,
      images,
      false
    );
    assert.strictEqual(nullVariantSchema.offers?.price, '1299.00');

    // Explicit invalid prices on selected variant or missing everywhere -> omit offers completely
    for (const badVariantPrice of [0, -1, NaN, Infinity, 'abc', '']) {
      const [badSchema] = seoUtils.buildProductStructuredData(
        baseProduct,
        { sku: 'BAD-PRICE', price: badVariantPrice },
        images,
        false
      );
      assert.strictEqual(
        'offers' in badSchema,
        false,
        `Expected offers property to be omitted for invalid variant price: ${String(badVariantPrice)}`
      );
    }

    const [bothMissingSchema] = seoUtils.buildProductStructuredData(
      { ...baseProduct, priceSummary: { minPrice: 0 } },
      null,
      images,
      false
    );
    assert.strictEqual('offers' in bothMissingSchema, false);

    // BreadcrumbList origin check
    assert.strictEqual(breadcrumbSchema.itemListElement[0].item, `${TARGET_ORIGIN}/`);
    assert.strictEqual(breadcrumbSchema.itemListElement[2].item, `${TARGET_ORIGIN}/shop?category=men`);

    record('SEO-01', 'Product JSON-LD handles 899/1/numeric strings, valid fallback, and omits invalid offers', true);
  } catch (err) {
    record('SEO-01', 'Product JSON-LD pricing & invalid offer omission', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 2. Centralized Canonical Site Origin & Domain Sanitization Tests
  // -------------------------------------------------------------------------
  try {
    assert.strictEqual(seoUtils.DEFAULT_SITE_ORIGIN, TARGET_ORIGIN);
    assert.strictEqual(seoUtils.getCanonicalSiteOrigin(), TARGET_ORIGIN);
    assert.strictEqual(seoUtils.getCanonicalSiteOrigin(RENDER_ORIGIN), TARGET_ORIGIN);

    const canonicalPdp = seoUtils.buildCanonicalUrl(
      '/products/aurelio-essential-oversized-t-shirt?utm_source=linkedin',
      seoUtils.getCanonicalSiteOrigin()
    );
    assert.strictEqual(
      canonicalPdp,
      `${TARGET_ORIGIN}/products/aurelio-essential-oversized-t-shirt`
    );

    const shopBreadcrumb = seoUtils.buildShopBreadcrumbStructuredData();
    assert.strictEqual(shopBreadcrumb.itemListElement[0].item, `${TARGET_ORIGIN}/`);
    assert.strictEqual(shopBreadcrumb.itemListElement[1].item, `${TARGET_ORIGIN}/shop`);

    const homeLd = seoUtils.buildHomepageStructuredData({ storeName: 'LuxeCart', tagline: 'Luxury Fashion' });
    assert.strictEqual(homeLd[0].url, TARGET_ORIGIN);
    assert.strictEqual(homeLd[1].url, TARGET_ORIGIN);

    record('SEO-02', 'Canonical URLs and Shop/Homepage schemas use centralized vercel.app origin', true);
  } catch (err) {
    record('SEO-02', 'Centralized canonical origin & schemas', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 3. Nested Category Tree Lookup Tests (Fix 3)
  // -------------------------------------------------------------------------
  try {
    const mockCategoryTree = [
      {
        id: 'cat_men',
        name: 'MEN',
        slug: 'men',
        description: 'Menswear root.',
        isActive: true,
        children: [
          {
            id: 'cat_men_apparel',
            name: 'Apparel',
            slug: 'mens-apparel',
            description: 'Mens apparel.',
            isActive: true,
            children: [
              {
                id: 'cat_men_tees',
                name: 'T-Shirts',
                slug: 'mens-t-shirts',
                description: 'Heavyweight cotton tees.',
                isActive: true,
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'cat_footwear',
        name: 'FOOTWEAR',
        slug: 'footwear',
        description: 'Designer footwear.',
        isActive: true,
        children: [
          {
            id: 'cat_sneakers',
            name: 'Sneakers',
            slug: 'sneakers',
            description: 'Retro runner sneakers.',
            isActive: true,
            children: [],
          },
          {
            id: 'cat_hidden',
            name: 'Hidden',
            slug: 'hidden-shoes',
            description: 'Inactive.',
            isActive: false,
            children: [],
          },
        ],
      },
    ];

    const resolvedTees = seoUtils.findActiveCategoryInTree(mockCategoryTree, 'mens-t-shirts');
    assert.strictEqual(resolvedTees?.name, 'T-Shirts');
    assert.strictEqual(resolvedTees?.description, 'Heavyweight cotton tees.');

    const resolvedSneakersUpper = seoUtils.findActiveCategoryInTree(mockCategoryTree, 'SNEAKERS');
    assert.strictEqual(resolvedSneakersUpper?.name, 'Sneakers');

    const resolvedById = seoUtils.findActiveCategoryInTree(mockCategoryTree, 'cat_men_apparel');
    assert.strictEqual(resolvedById?.slug, 'mens-apparel');

    assert.strictEqual(seoUtils.findActiveCategoryInTree(mockCategoryTree, 'hidden-shoes'), null);
    assert.strictEqual(seoUtils.findActiveCategoryInTree(mockCategoryTree, 'non-existent'), null);
    assert.strictEqual(seoUtils.findActiveCategoryInTree(mockCategoryTree, ''), null);

    const shopPageContent = fs.readFileSync(path.join(rootDir, 'client/src/pages/ShopPage.jsx'), 'utf8');
    assert.ok(shopPageContent.includes('findActiveCategoryInTree(categories, currentCategory)'));

    record('SEO-03', 'Nested category lookup resolves root, mid, and leaf child categories cleanly', true);
  } catch (err) {
    record('SEO-03', 'Nested category lookup', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 4. Sitemap Generator: Active Filtering, Empty Category Exclusion, Pagination (Fix 1)
  // -------------------------------------------------------------------------
  try {
    const mockFetch = async (url) => {
      if (url.includes('/products') && url.includes('page=1')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                slug: 'aurelio-essential-oversized-t-shirt',
                status: 'ACTIVE',
                category: { _id: 'c_tees', slug: 'mens-t-shirts' },
                categoryTree: ['c_men', 'c_apparel', 'c_tees'],
              },
              {
                slug: 'unpublished-draft-item',
                status: 'DRAFT',
                category: { _id: 'c_lifestyle', slug: 'lifestyle' },
                categoryTree: ['c_lifestyle'],
              },
            ],
            meta: { pagination: { totalPages: 2 } },
          }),
        };
      }
      if (url.includes('/products') && url.includes('page=2')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                slug: 'vanta-retro-runner-sneakers',
                status: 'ACTIVE',
                category: { _id: 'c_sneakers', slug: 'sneakers' },
                categoryTree: ['c_footwear', 'c_sneakers'],
              },
            ],
            meta: { pagination: { totalPages: 2 } },
          }),
        };
      }
      if (url.includes('/categories')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              categories: [
                {
                  _id: 'c_men',
                  slug: 'men',
                  isActive: true,
                  children: [
                    {
                      _id: 'c_apparel',
                      slug: 'mens-apparel',
                      isActive: true,
                      children: [{ _id: 'c_tees', slug: 'mens-t-shirts', isActive: true, children: [] }],
                    },
                  ],
                },
                {
                  _id: 'c_footwear',
                  slug: 'footwear',
                  isActive: true,
                  children: [{ _id: 'c_sneakers', slug: 'sneakers', isActive: true, children: [] }],
                },
                { _id: 'c_lifestyle', slug: 'lifestyle', isActive: true, children: [] }, // Empty! (only referenced by DRAFT)
                { _id: 'c_hidden', slug: 'hidden-cat', isActive: false, children: [] },
              ],
            },
          }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const res = await sitemapGen.generateSitemap({
      apiBaseUrl: `${RENDER_ORIGIN}/api/v1`,
      siteOrigin: TARGET_ORIGIN,
      isVercel: true,
      fetchImpl: mockFetch,
    });

    assert.strictEqual(res.source, 'api');
    assert.strictEqual(res.productCount, 2);
    assert.strictEqual(res.categoryCount, 5); // men, mens-apparel, mens-t-shirts, footwear, sneakers (NO lifestyle!)
    assert.ok(res.xml.includes(`<loc>${TARGET_ORIGIN}/shop?category=men</loc>`));
    assert.ok(res.xml.includes(`<loc>${TARGET_ORIGIN}/shop?category=mens-t-shirts</loc>`));
    assert.ok(res.xml.includes(`<loc>${TARGET_ORIGIN}/shop?category=sneakers</loc>`));
    assert.ok(res.xml.includes(`<loc>${TARGET_ORIGIN}/products/aurelio-essential-oversized-t-shirt</loc>`));
    assert.ok(res.xml.includes(`<loc>${TARGET_ORIGIN}/products/vanta-retro-runner-sneakers</loc>`));

    // Must exclude empty categories (lifestyle), DRAFT products, inactive categories, Render host
    assert.ok(!res.xml.includes('category=lifestyle'), 'Empty lifestyle category must be excluded');
    assert.ok(!res.xml.includes('unpublished-draft-item'));
    assert.ok(!res.xml.includes('hidden-cat'));
    assert.ok(!res.xml.includes('onrender.com'));

    record('SEO-04', 'Multi-page sitemap includes populated categories & active products while excluding empty lifestyle', true);
  } catch (err) {
    record('SEO-04', 'Sitemap pagination & empty category exclusion', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 5. Fix 1 Safety: Empty 200 OK Never Triggers Fallback; Vercel Fails Closed
  // -------------------------------------------------------------------------
  try {
    // 5a. Empty 200 OK product list must return source='api' with 0 products & 0 categories (NO fallback!)
    const emptyApiFetch = async (url) => {
      if (url.includes('/products')) {
        return { ok: true, json: async () => ({ success: true, data: [], meta: { pagination: { totalPages: 1 } } }) };
      }
      if (url.includes('/categories')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: { categories: [{ _id: 'c_men', slug: 'men', isActive: true, children: [] }] } }),
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const emptyRes = await sitemapGen.generateSitemap({
      apiBaseUrl: `${RENDER_ORIGIN}/api/v1`,
      siteOrigin: TARGET_ORIGIN,
      isVercel: true,
      fetchImpl: emptyApiFetch,
    });

    assert.strictEqual(emptyRes.source, 'api');
    assert.strictEqual(emptyRes.productCount, 0);
    assert.strictEqual(emptyRes.categoryCount, 0);
    assert.ok(emptyRes.xml.includes(`<loc>${TARGET_ORIGIN}/</loc>`));
    assert.ok(emptyRes.xml.includes(`<loc>${TARGET_ORIGIN}/shop</loc>`));
    assert.ok(!emptyRes.xml.includes('/products/'), 'Empty API must not fall back to hardcoded products');
    assert.ok(!emptyRes.xml.includes('?category='), 'Empty API must not emit empty category URLs');

    // 5b. Vercel fails closed when products HTTP 500, categories HTTP 500, or page 2 fails
    const failCases = [
      {
        label: 'products 500',
        fn: async (url) =>
          url.includes('/products')
            ? { ok: false, status: 500, json: async () => ({}) }
            : { ok: true, json: async () => ({ success: true, data: { categories: [] } }) },
      },
      {
        label: 'categories 500',
        fn: async (url) =>
          url.includes('/categories')
            ? { ok: false, status: 500, json: async () => ({}) }
            : { ok: true, json: async () => ({ success: true, data: [{ slug: 'x', status: 'ACTIVE' }], meta: { pagination: { totalPages: 1 } } }) },
      },
      {
        label: 'partial page 2 failure',
        fn: async (url) => {
          if (url.includes('page=1')) {
            return { ok: true, json: async () => ({ success: true, data: [{ slug: 'p1', status: 'ACTIVE' }], meta: { pagination: { totalPages: 2 } } }) };
          }
          if (url.includes('page=2')) {
            return { ok: false, status: 503, json: async () => ({}) };
          }
          return { ok: true, json: async () => ({ success: true, data: { categories: [] } }) };
        },
      },
    ];

    for (const fc of failCases) {
      let threw = false;
      try {
        await sitemapGen.generateSitemap({
          apiBaseUrl: `${RENDER_ORIGIN}/api/v1`,
          siteOrigin: TARGET_ORIGIN,
          isVercel: true,
          fetchImpl: fc.fn,
        });
      } catch (e) {
        threw = e.message.includes('fail-closed mode');
      }
      assert.ok(threw, `Expected Vercel build to fail closed on ${fc.label}`);
    }

    // 5c. Local offline dev falls back cleanly without lifestyle
    const offlineFallback = await sitemapGen.generateSitemap({
      apiBaseUrl: 'http://localhost:5000/api/v1',
      siteOrigin: TARGET_ORIGIN,
      isVercel: false,
      fetchImpl: async () => {
        throw new Error('fetch failed');
      },
    });
    assert.strictEqual(offlineFallback.source, 'fallback');
    assert.strictEqual(offlineFallback.productCount, 12);
    assert.strictEqual(offlineFallback.categoryCount, 20);
    assert.ok(!offlineFallback.xml.includes('category=lifestyle'));

    record('SEO-05', 'Empty 200 OK never triggers fallback; Vercel fails closed; local fallback works offline', true);
  } catch (err) {
    record('SEO-05', 'Sitemap fail-closed & empty catalog semantics', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 6. Backend SeoService Dynamic Sitemap & Empty Category Exclusion
  // -------------------------------------------------------------------------
  try {
    const mockProdDocs = [
      {
        slug: 'aurelio-essential-oversized-t-shirt',
        status: 'ACTIVE',
        category: 'c_footwear',
        categoryTree: ['c_footwear'],
        updatedAt: new Date('2026-11-10T10:00:00Z'),
      },
      {
        slug: 'draft-leaked-product',
        status: 'DRAFT',
        category: 'c_lifestyle',
        categoryTree: ['c_lifestyle'],
        updatedAt: new Date(),
      },
    ];
    const mockCatDocs = [
      { _id: 'c_footwear', slug: 'footwear', isActive: true, updatedAt: new Date('2026-11-10T10:00:00Z') },
      { _id: 'c_lifestyle', slug: 'lifestyle', isActive: true, updatedAt: new Date('2026-11-10T10:00:00Z') }, // Empty!
      { _id: 'c_inactive', slug: 'inactive-cat', isActive: false, updatedAt: new Date() },
    ];

    const makeMockModel = (rows) => ({
      find(filter) {
        const filtered = rows.filter((r) => {
          if (filter.status && r.status !== filter.status) return false;
          if (filter.isActive !== undefined && r.isActive !== filter.isActive) return false;
          return true;
        });
        return {
          select() {
            return { lean: async () => filtered };
          },
        };
      },
    });

    const backendXml = await seoService.generateSitemapXml(RENDER_ORIGIN, {
      clientUrl: TARGET_ORIGIN,
      ProductModel: makeMockModel(mockProdDocs),
      CategoryModel: makeMockModel(mockCatDocs),
    });

    assert.ok(backendXml.includes(`<loc>${TARGET_ORIGIN}/products/aurelio-essential-oversized-t-shirt</loc>`));
    assert.ok(backendXml.includes(`<loc>${TARGET_ORIGIN}/shop?category=footwear</loc>`));
    assert.ok(!backendXml.includes('category=lifestyle'), 'Backend sitemap must exclude empty lifestyle category');
    assert.ok(!backendXml.includes('draft-leaked-product'));
    assert.ok(!backendXml.includes('inactive-cat'));
    assert.ok(!backendXml.includes('onrender.com'));

    record('SEO-06', 'Backend SeoService excludes empty lifestyle category, drafts, and Render hostnames', true);
  } catch (err) {
    record('SEO-06', 'Backend SeoService empty category & safety checks', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 7. robots.txt & Static Override Removal Verification
  // -------------------------------------------------------------------------
  try {
    const robotsTxt = fs.readFileSync(path.join(rootDir, 'client/public/robots.txt'), 'utf8');
    assert.ok(robotsTxt.includes(`Sitemap: ${TARGET_ORIGIN}/sitemap.xml`));
    assert.ok(!robotsTxt.includes('luxecart.com'));
    assert.ok(robotsTxt.includes('Disallow: /admin'));
    assert.ok(robotsTxt.includes('Disallow: /account'));
    assert.ok(robotsTxt.includes('Disallow: /checkout'));
    assert.ok(robotsTxt.includes('Disallow: /orders'));
    assert.ok(!robotsTxt.includes('Disallow: /cart'));
    assert.ok(!robotsTxt.includes('Disallow: /wishlist'));
    assert.ok(!robotsTxt.includes('Disallow: /login'));
    assert.strictEqual(fs.existsSync(path.join(rootDir, 'client/public/sitemap.xml')), false);

    record('SEO-07', 'robots.txt sitemap directive, crawl separation, and static sitemap removal verified', true);
  } catch (err) {
    record('SEO-07', 'robots.txt & static override protection', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passedCount}/${results.length} PASSED | ${failedCount} FAILED`);
  console.log('======================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal SEO test suite error:', err);
  process.exit(1);
});
