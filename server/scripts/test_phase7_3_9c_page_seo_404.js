/**
 * LUXECART PHASE 7.3.9C: PAGE-LEVEL SEO, CUSTOM 404 & METADATA TEST SUITE
 *
 * Strictly offline / static & unit verification (zero live DB or deployment changes).
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

function countOccurrences(str, pattern) {
  const matches = str.match(pattern);
  return matches ? matches.length : 0;
}

async function runTests() {
  console.log('\n======================================================================');
  console.log('   LUXECART PHASE 7.3.9C: PAGE-LEVEL SEO, 404 & METADATA TESTS');
  console.log('======================================================================\n');

  const seoUtilsPath = path.join(rootDir, 'client/src/features/settings/utils/seoUtils.js');
  const seoUtils = await import(`file://${seoUtilsPath.replace(/\\/g, '/')}`);

  const appSource = fs.readFileSync(path.join(rootDir, 'client/src/App.jsx'), 'utf8');
  const notFoundSource = fs.readFileSync(path.join(rootDir, 'client/src/pages/NotFoundPage.jsx'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'client/index.html'), 'utf8');
  const seoSource = fs.readFileSync(path.join(rootDir, 'client/src/components/common/SEO.jsx'), 'utf8');
  const pdpSource = fs.readFileSync(path.join(rootDir, 'client/src/pages/ProductDetailPage.jsx'), 'utf8');
  const shopSource = fs.readFileSync(path.join(rootDir, 'client/src/pages/ShopPage.jsx'), 'utf8');

  // -------------------------------------------------------------------------
  // 1. Custom 404 Route, Single H1, Links & Noindex
  // -------------------------------------------------------------------------
  try {
    assert.ok(appSource.includes("lazy(() => import('./pages/NotFoundPage'))"), 'App.jsx must lazy-load NotFoundPage');
    assert.ok(appSource.includes('<Route path="*" element={<NotFoundPage />} />'), 'App.jsx must define catch-all Route path="*"');
    assert.ok(!appSource.includes('<Navigate to="/"'), 'App.jsx must not redirect all unknown URLs to homepage');

    assert.strictEqual(countOccurrences(notFoundSource, /<h1[\s>]/g), 1, 'NotFoundPage must contain exactly one H1');
    assert.ok(notFoundSource.includes('robots="noindex, nofollow"'), 'NotFoundPage must set robots="noindex, nofollow"');
    assert.ok(notFoundSource.includes('canonical={false}'), 'NotFoundPage must suppress stale canonical URLs');
    assert.ok(notFoundSource.includes('to="/"'), 'NotFoundPage must link back to Home');
    assert.ok(notFoundSource.includes('to="/shop"'), 'NotFoundPage must link to Shop');

    record('C-01', 'Custom 404 catch-all route renders NotFoundPage with 1 H1, Home/Shop links, and noindex', true);
  } catch (err) {
    record('C-01', 'Custom 404 catch-all verification', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 2. Cart / Wishlist / Auth Routes: Unique Titles, Descriptions, 1 H1, Noindex
  // -------------------------------------------------------------------------
  try {
    const utilityAuthPages = [
      { file: 'client/src/pages/CartPage.jsx', title: 'Shopping Bag', canonical: '/cart' },
      { file: 'client/src/pages/WishlistPage.jsx', title: 'My Wishlist', canonical: '/wishlist' },
      { file: 'client/src/pages/LoginPage.jsx', title: 'Sign In', canonical: '/login' },
      { file: 'client/src/pages/RegisterPage.jsx', title: 'Create Account', canonical: '/register' },
      { file: 'client/src/pages/ForgotPasswordPage.jsx', title: 'Forgot Password', canonical: '/forgot-password' },
      { file: 'client/src/pages/ResetPasswordPage.jsx', title: 'Reset Password', canonical: '/reset-password' },
    ];

    const seenTitles = new Set();
    for (const pg of utilityAuthPages) {
      const src = fs.readFileSync(path.join(rootDir, pg.file), 'utf8');
      assert.ok(src.includes('<SEO'), `${pg.file} must render <SEO>`);
      assert.ok(src.includes(`title="${pg.title}"`), `${pg.file} must have unique title "${pg.title}"`);
      assert.ok(src.includes('robots="noindex, nofollow"'), `${pg.file} must set robots="noindex, nofollow"`);
      assert.ok(src.includes(`canonical="${pg.canonical}"`), `${pg.file} must set clean canonical="${pg.canonical}"`);
      assert.strictEqual(countOccurrences(src, /<h1[\s>]/g), 1, `${pg.file} must have exactly one <h1>`);
      assert.ok(!seenTitles.has(pg.title), `Duplicate title detected: ${pg.title}`);
      seenTitles.add(pg.title);
    }

    record('C-02', 'All 6 utility & auth routes have unique titles, 1 H1 each, and robots="noindex, nofollow"', true);
  } catch (err) {
    record('C-02', 'Utility & auth route metadata', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 3. Product Not-Found State & Loading State SEO
  // -------------------------------------------------------------------------
  try {
    assert.ok(pdpSource.includes('title="Product Not Found"'), 'Product not-found state must set title');
    assert.ok(pdpSource.includes('robots="noindex, nofollow"'), 'Product not-found state must set robots="noindex, nofollow"');
    assert.ok(pdpSource.includes('canonical={false}'), 'Product not-found state must clear stale canonical');
    assert.ok(pdpSource.includes('>Product Unavailable</h1>'), 'Product not-found state must render one H1');
    assert.strictEqual(countOccurrences(pdpSource, /<h1[\s>]/g), 2, 'ProductDetailPage should have 1 H1 in not-found return branch and 1 H1 in product return branch');

    record('C-03', 'ProductDetailPage not-found state sets noindex, suppresses stale canonical, and renders H1', true);
  } catch (err) {
    record('C-03', 'Product not-found state SEO', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 4. Shop Category Dynamic H1 & Title Verification
  // -------------------------------------------------------------------------
  try {
    const teeHeading = seoUtils.formatShopHeading({
      activeCategory: { name: 'T-Shirts', slug: 'mens-t-shirts', description: 'Heavyweight tees.' },
      categoryParam: 'mens-t-shirts',
    });
    assert.strictEqual(teeHeading.heading, 'T-Shirts Collection');
    assert.strictEqual(teeHeading.subtitle, 'Heavyweight tees.');

    const slugFallbackHeading = seoUtils.formatShopHeading({
      activeCategory: null,
      categoryParam: 'mens-t-shirts',
    });
    assert.strictEqual(slugFallbackHeading.heading, 'Mens T Shirts Collection');

    const searchHeading = seoUtils.formatShopHeading({ search: 'oxford' });
    assert.strictEqual(searchHeading.heading, 'Search Results for "oxford"');

    const defaultHeading = seoUtils.formatShopHeading({});
    assert.strictEqual(defaultHeading.heading, 'Fashion & Lifestyle Catalog');

    assert.strictEqual(countOccurrences(shopSource, /<h1[\s>]/g), 1, 'ShopPage must have exactly one <h1>');
    assert.ok(shopSource.includes('{shopHeading}'), 'ShopPage H1 must render dynamic shopHeading');

    record('C-04', 'ShopPage renders single dynamic H1 matching selected category, search, or department', true);
  } catch (err) {
    record('C-04', 'Shop category H1 verification', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 5. Canonical Token Stripping & Stale Canonical Suppression
  // -------------------------------------------------------------------------
  try {
    const cleanReset = seoUtils.buildCanonicalUrl(
      '/reset-password/secret-reset-token-abc123?token=xyz&utm_source=email',
      'https://luxecart-rouge.vercel.app'
    );
    assert.strictEqual(cleanReset, 'https://luxecart-rouge.vercel.app/reset-password');
    assert.ok(!cleanReset.includes('secret-reset-token'));
    assert.ok(!cleanReset.includes('xyz'));
    assert.ok(!cleanReset.includes('utm_source'));

    assert.strictEqual(seoUtils.buildCanonicalUrl(false, 'https://luxecart-rouge.vercel.app'), '');
    assert.ok(seoSource.includes('canonicalElement.remove()'), 'SEO.jsx must remove stale canonical tags when suppressed');

    record('C-05', 'Canonical URLs strip password-reset tokens/tracking params and remove stale canonicals', true);
  } catch (err) {
    record('C-05', 'Canonical token stripping & stale suppression', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 6. Default Static HTML Metadata in client/index.html
  // -------------------------------------------------------------------------
  try {
    assert.ok(indexHtml.includes('<title>LuxeCart'), 'index.html must include default title');
    assert.ok(indexHtml.includes('name="description"'), 'index.html must include default meta description');
    assert.ok(indexHtml.includes('property="og:title"'), 'index.html must include og:title');
    assert.ok(indexHtml.includes('property="og:description"'), 'index.html must include og:description');
    assert.ok(
      indexHtml.includes('property="og:image" content="https://luxecart-rouge.vercel.app/images/hero-campaign.jpg"'),
      'index.html og:image must reference CSP-safe hosted LuxeCart image'
    );
    assert.ok(indexHtml.includes('name="twitter:card" content="summary_large_image"'), 'index.html must include twitter:card');
    assert.ok(indexHtml.includes('name="theme-color" content="#2A211B"'), 'index.html must include theme-color');
    assert.ok(indexHtml.includes('name="viewport"'), 'index.html must include viewport');
    assert.ok(!indexHtml.includes('images.unsplash.com'), 'index.html and seoUtils must not rely on CSP-blocked Unsplash URL');
    assert.ok(!indexHtml.includes('rel="canonical"'), 'index.html must not hardcode static canonical="/" that overrides deep routes');

    record('C-06', 'Default static HTML metadata complete with CSP-safe LuxeCart OG/Twitter image', true);
  } catch (err) {
    record('C-06', 'Static HTML metadata verification', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 7. Existing Storefront & Protected Routes Preserved + robots.txt Crawlability
  // -------------------------------------------------------------------------
  try {
    for (const routePath of ['path="/"', 'path="/shop"', 'path="/products/:slug"', 'path="/cart"', 'path="/wishlist"', 'path="/checkout"', 'path="/orders"', 'path="/admin"']) {
      assert.ok(appSource.includes(routePath), `Existing route missing in App.jsx: ${routePath}`);
    }

    const robotsTxt = fs.readFileSync(path.join(rootDir, 'client/public/robots.txt'), 'utf8');
    assert.ok(!robotsTxt.includes('Disallow: /cart'));
    assert.ok(!robotsTxt.includes('Disallow: /wishlist'));
    assert.ok(!robotsTxt.includes('Disallow: /login'));
    assert.ok(!robotsTxt.includes('Disallow: /register'));
    assert.ok(!robotsTxt.includes('Disallow: /forgot-password'));
    assert.ok(!robotsTxt.includes('Disallow: /reset-password'));

    record('C-07', 'Existing routes & protection preserved; robots.txt keeps noindex utility/auth pages crawlable', true);
  } catch (err) {
    record('C-07', 'Existing routes & crawlability preservation', false, err.message);
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
  console.error('Fatal Phase 7.3.9C test suite error:', err);
  process.exit(1);
});
