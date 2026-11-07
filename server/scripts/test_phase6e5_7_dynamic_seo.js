/**
 * LuxeCart — Phase 6E.5.7: Dynamic SEO & Metadata Verification Suite
 *
 * Verifies:
 * 1. Configured store title is used as default.
 * 2. Page-specific title takes precedence.
 * 3. Store name is not duplicated in titles.
 * 4. Configured meta description is used as fallback.
 * 5. Page-specific descriptions are preserved.
 * 6. Configured keywords are handled correctly.
 * 7. Open Graph site name is dynamic.
 * 8. Open Graph title and description match page metadata.
 * 9. Social image fallback works (valid logo or editorial fallback).
 * 10. Page-specific social image takes precedence.
 * 11. Canonical URLs preserve the correct page path.
 * 12. Tracking parameters are excluded from canonical URLs.
 * 13. Favicon updates when configured with valid URL.
 * 14. Local favicon remains fallback when missing or invalid.
 * 15. Failed favicon URLs do not break page (graceful error handling).
 * 16. Missing settings do not break SEO rendering (safe fallbacks).
 * 17. Storefront fallback settings remain safe.
 * 18. Existing product/category SEO behavior remains intact.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('======================================================================');
console.log('   LUXECART PHASE 6E.5.7: DYNAMIC SEO & METADATA VERIFICATION       ');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

const record = (id, description, status, details = '') => {
  if (status === 'PASS') {
    passCount++;
    console.log(`✔ [PASS] [${id}] ${description}`);
  } else {
    failCount++;
    console.error(`✖ [FAIL] [${id}] ${description}${details ? ' - ' + details : ''}`);
  }
};

const runSuite = async () => {
  const seoUtilsPath = path.join(rootDir, 'client/src/features/settings/utils/seoUtils.js');
  const seoPath = path.join(rootDir, 'client/src/components/common/SEO.jsx');
  const homePagePath = path.join(rootDir, 'client/src/pages/HomePage.jsx');
  const shopPagePath = path.join(rootDir, 'client/src/pages/ShopPage.jsx');
  const pdpPath = path.join(rootDir, 'client/src/pages/ProductDetailPage.jsx');
  const defaultSettingsPath = path.join(rootDir, 'client/src/features/settings/context/defaultSettings.js');

  const seoUtilsSource = fs.readFileSync(seoUtilsPath, 'utf-8');
  const seoSource = fs.readFileSync(seoPath, 'utf-8');
  const homePageSource = fs.readFileSync(homePagePath, 'utf-8');
  const shopPageSource = fs.readFileSync(shopPagePath, 'utf-8');
  const pdpSource = fs.readFileSync(pdpPath, 'utf-8');
  const defaultSettingsSource = fs.readFileSync(defaultSettingsPath, 'utf-8');

  // Dynamically import exported pure functions from seoUtils.js
  const {
    formatTitle,
    buildCanonicalUrl,
    resolveMetaImage,
    resolveMetaKeywords,
    isValidHttpUrl,
  } = await import(`file://${seoUtilsPath.replace(/\\/g, '/')}`);

  // -------------------------------------------------------------------------
  // TEST 01: Configured store title is used as the default
  // -------------------------------------------------------------------------
  try {
    const defaultTitle = 'Custom Boutique — Exclusive Designer Apparel';
    const storeName = 'Custom Boutique';
    const result = formatTitle(null, storeName, defaultTitle);
    assert.strictEqual(result, defaultTitle);

    const emptyResult = formatTitle('', storeName, defaultTitle);
    assert.strictEqual(emptyResult, defaultTitle);

    record('TEST_01', 'Configured store title is used as the default when title is omitted', 'PASS');
  } catch (err) {
    record('TEST_01', 'Default store title', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 02: Page-specific title takes precedence
  // -------------------------------------------------------------------------
  try {
    const storeName = 'LuxeCart';
    const pageTitle = 'Handcrafted Silk Scarves';
    const result = formatTitle(pageTitle, storeName);
    assert.strictEqual(result, 'Handcrafted Silk Scarves | LuxeCart');

    record('TEST_02', 'Page-specific title takes precedence and appends store name', 'PASS');
  } catch (err) {
    record('TEST_02', 'Page title precedence', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 03: Store name is not duplicated in titles
  // -------------------------------------------------------------------------
  try {
    const storeName = 'LuxeCart';
    const titleWithStoreName = 'Footwear Collection | LuxeCart';
    const result1 = formatTitle(titleWithStoreName, storeName);
    assert.strictEqual(result1, 'Footwear Collection | LuxeCart');

    const titleWithDash = 'LuxeCart — Premium Fashion & Luxury Lifestyle';
    const result2 = formatTitle(titleWithDash, storeName);
    assert.strictEqual(result2, 'LuxeCart — Premium Fashion & Luxury Lifestyle');

    record('TEST_03', 'Store name is not duplicated or appended if already present in title', 'PASS');
  } catch (err) {
    record('TEST_03', 'Store name deduplication', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 04: Configured meta description is used as fallback
  // -------------------------------------------------------------------------
  try {
    const usesConfiguredFallback = seoSource.includes('settings?.seo?.metaDescription');
    assert.ok(usesConfiguredFallback, 'SEO component must read settings.seo.metaDescription as default fallback');

    record('TEST_04', 'Configured meta description is used as fallback when description is omitted', 'PASS');
  } catch (err) {
    record('TEST_04', 'Meta description fallback', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 05: Page-specific descriptions are preserved
  // -------------------------------------------------------------------------
  try {
    const preservesSpecific = seoSource.includes('const metaDescription = description || defaultDescription');
    assert.ok(preservesSpecific, 'SEO component must strictly prioritize provided description prop over default');

    record('TEST_05', 'Page-specific meta descriptions are preserved over generic defaults', 'PASS');
  } catch (err) {
    record('TEST_05', 'Page-specific description preservation', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 06: Configured keywords are handled correctly
  // -------------------------------------------------------------------------
  try {
    const keywordsArray = ['couture', 'luxury silk', 'leather boots'];
    const formatted = resolveMetaKeywords(null, keywordsArray);
    assert.strictEqual(formatted, 'couture, luxury silk, leather boots');

    const specificKeywords = 'bespoke, handcrafted';
    const specificFormatted = resolveMetaKeywords(specificKeywords, keywordsArray);
    assert.strictEqual(specificFormatted, 'bespoke, handcrafted');

    record('TEST_06', 'Keywords arrays and strings are properly resolved and formatted', 'PASS');
  } catch (err) {
    record('TEST_06', 'Keywords formatting', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 07: Open Graph site name is dynamic
  // -------------------------------------------------------------------------
  try {
    const setsDynamicSiteName = seoSource.includes("setMetaTag('property', 'og:site_name', storeName)");
    assert.ok(setsDynamicSiteName, 'SEO component must dynamically set og:site_name to storeName');

    const notHardcoded = !seoSource.includes("setMetaTag('property', 'og:site_name', 'LuxeCart')");
    assert.ok(notHardcoded, 'og:site_name must not be hardcoded to LuxeCart literal');

    record('TEST_07', 'Open Graph og:site_name dynamically uses configured storeName', 'PASS');
  } catch (err) {
    record('TEST_07', 'Dynamic og:site_name', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 08: Open Graph title and description match page metadata
  // -------------------------------------------------------------------------
  try {
    const setsOgTitle = seoSource.includes("setMetaTag('property', 'og:title', fullTitle)");
    const setsOgDesc = seoSource.includes("setMetaTag('property', 'og:description', metaDescription)");
    const setsTwitterTitle = seoSource.includes("setMetaTag('name', 'twitter:title', fullTitle)");
    const setsTwitterDesc = seoSource.includes("setMetaTag('name', 'twitter:description', metaDescription)");

    assert.ok(setsOgTitle, 'og:title must match fullTitle');
    assert.ok(setsOgDesc, 'og:description must match metaDescription');
    assert.ok(setsTwitterTitle, 'twitter:title must match fullTitle');
    assert.ok(setsTwitterDesc, 'twitter:description must match metaDescription');

    record('TEST_08', 'Open Graph and Twitter titles and descriptions match resolved page metadata', 'PASS');
  } catch (err) {
    record('TEST_08', 'OG and Twitter metadata synchronization', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 09: Social image fallback works
  // -------------------------------------------------------------------------
  try {
    const validLogo = 'https://res.cloudinary.com/luxecart/image/upload/v1/logo.png';
    const fallbackEditorial = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200';

    const resultWithLogo = resolveMetaImage(null, validLogo, fallbackEditorial);
    assert.strictEqual(resultWithLogo, validLogo);

    const resultWithInvalidLogo = resolveMetaImage(null, 'not-a-valid-url', fallbackEditorial);
    assert.strictEqual(resultWithInvalidLogo, fallbackEditorial);

    const resultWithEmptyLogo = resolveMetaImage(null, '', fallbackEditorial);
    assert.strictEqual(resultWithEmptyLogo, fallbackEditorial);

    record('TEST_09', 'Social image falls back to valid store logo, then to luxury editorial image', 'PASS');
  } catch (err) {
    record('TEST_09', 'Social image fallback', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Page-specific social image takes precedence
  // -------------------------------------------------------------------------
  try {
    const productActiveImage = 'https://res.cloudinary.com/luxecart/products/dress.jpg';
    const validLogo = 'https://res.cloudinary.com/luxecart/image/upload/v1/logo.png';

    const result = resolveMetaImage(productActiveImage, validLogo);
    assert.strictEqual(result, productActiveImage);

    record('TEST_10', 'Page-specific social image strictly takes precedence over store logo', 'PASS');
  } catch (err) {
    record('TEST_10', 'Page-specific social image precedence', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Canonical URLs preserve the correct page path
  // -------------------------------------------------------------------------
  try {
    const origin = 'https://luxecart.com';
    const canonicalHome = buildCanonicalUrl('/', origin);
    assert.strictEqual(canonicalHome, 'https://luxecart.com/');

    const canonicalShop = buildCanonicalUrl('/shop?category=footwear', origin);
    assert.strictEqual(canonicalShop, 'https://luxecart.com/shop?category=footwear');

    const canonicalProduct = buildCanonicalUrl('/products/oxford-shirt', origin);
    assert.strictEqual(canonicalProduct, 'https://luxecart.com/products/oxford-shirt');

    record('TEST_11', 'Canonical URLs preserve the authentic page route and functional query parameters', 'PASS');
  } catch (err) {
    record('TEST_11', 'Canonical URL path preservation', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Tracking parameters are excluded from canonical URLs
  // -------------------------------------------------------------------------
  try {
    const origin = 'https://luxecart.com';
    const dirtyUrl = '/shop?category=beauty&utm_source=google&utm_medium=cpc&utm_campaign=winter2026&gclid=12345&fbclid=abcdef';
    const cleaned = buildCanonicalUrl(dirtyUrl, origin);
    assert.strictEqual(cleaned, 'https://luxecart.com/shop?category=beauty');

    record('TEST_12', 'Marketing and analytics tracking parameters are cleanly stripped from canonical links', 'PASS');
  } catch (err) {
    record('TEST_12', 'Tracking parameters exclusion', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 13: Favicon updates when configured
  // -------------------------------------------------------------------------
  try {
    const hasUpdateFavicon = seoSource.includes('updateFavicon(settings?.faviconUrl)');
    assert.ok(hasUpdateFavicon, 'SEO component must call updateFavicon with settings.faviconUrl');

    const validatesUrl = seoUtilsSource.includes('isValidHttpUrl(faviconUrl)');
    assert.ok(validatesUrl, 'updateFavicon must validate favicon URL protocol');

    record('TEST_13', 'Favicon updates dynamically when configured with a valid remote URL', 'PASS');
  } catch (err) {
    record('TEST_13', 'Dynamic favicon update', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 14: Local favicon remains fallback
  // -------------------------------------------------------------------------
  try {
    const definesLocalFallback = seoUtilsSource.includes("fallbackFavicon = '/favicon.svg'");
    assert.ok(definesLocalFallback, 'updateFavicon must default fallbackFavicon to /favicon.svg');

    record('TEST_14', 'Local favicon (/favicon.svg) remains immutable fallback when faviconUrl is omitted', 'PASS');
  } catch (err) {
    record('TEST_14', 'Local favicon fallback', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 15: Failed favicon URLs do not break the page
  // -------------------------------------------------------------------------
  try {
    const hasProbeHandling = seoUtilsSource.includes('probe.onerror')
      && seoUtilsSource.includes('setFaviconHref(fallbackFavicon)');
    assert.ok(hasProbeHandling, 'updateFavicon must handle probe.onerror and revert to fallbackFavicon');

    // Test protocol validator
    assert.strictEqual(isValidHttpUrl('javascript:alert(1)'), false);
    assert.strictEqual(isValidHttpUrl('not-a-valid-url'), false);
    assert.strictEqual(isValidHttpUrl(''), false);
    assert.strictEqual(isValidHttpUrl(null), false);
    assert.strictEqual(isValidHttpUrl('https://valid.com/icon.ico'), true);

    record('TEST_15', 'Invalid, broken, or unreachable favicon URLs safely fail back without breaking the page', 'PASS');
  } catch (err) {
    record('TEST_15', 'Favicon error handling resilience', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 16: Missing settings do not break SEO rendering
  // -------------------------------------------------------------------------
  try {
    const titleWithNullSettings = formatTitle('About Us', null, null);
    assert.strictEqual(titleWithNullSettings, 'About Us | LuxeCart');

    const defaultWithNullSettings = formatTitle(null, null, null);
    assert.strictEqual(defaultWithNullSettings, 'LuxeCart — Curated Luxury Fashion & Lifestyle');

    const keywordsWithNull = resolveMetaKeywords(null, null);
    assert.strictEqual(keywordsWithNull, '');

    record('TEST_16', 'Missing or null settings gracefully resolve to safe defaults without runtime errors', 'PASS');
  } catch (err) {
    record('TEST_16', 'Missing settings resilience', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 17: Storefront fallback settings remain safe
  // -------------------------------------------------------------------------
  try {
    const hasDefaultSeo = defaultSettingsSource.includes('seo: {')
      && defaultSettingsSource.includes('metaTitle:')
      && defaultSettingsSource.includes('metaDescription:')
      && defaultSettingsSource.includes('keywords:');
    assert.ok(hasDefaultSeo, 'defaultSettings.js must declare complete default seo metadata block');

    record('TEST_17', 'Storefront default fallback settings provide valid luxury title, description, and keywords', 'PASS');
  } catch (err) {
    record('TEST_17', 'Fallback settings safety', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 18: Existing product/category SEO behavior remains intact
  // -------------------------------------------------------------------------
  try {
    // HomePage passes dynamic SEO
    const homeUsesSeo = homePageSource.includes('<SEO')
      && homePageSource.includes('settings?.seo?.metaTitle')
      && homePageSource.includes('structuredData={homepageStructuredData}');
    assert.ok(homeUsesSeo, 'HomePage must render SEO with dynamic settings and structuredData');

    // ProductDetailPage passes dynamic SEO with product priority
    const pdpUsesSeo = pdpSource.includes('<SEO')
      && pdpSource.includes('title={pdpTitle}')
      && pdpSource.includes('description={pdpDescription}')
      && pdpSource.includes('structuredData={pdpStructuredData}');
    assert.ok(pdpUsesSeo, 'ProductDetailPage must render SEO with product title/description priority');

    // ShopPage passes dynamic SEO with category priority
    const shopUsesSeo = shopPageSource.includes('<SEO')
      && shopPageSource.includes('title={shopTitle}')
      && shopPageSource.includes('description={shopDescription}')
      && shopPageSource.includes('structuredData={shopStructuredData}');
    assert.ok(shopUsesSeo, 'ShopPage must render SEO with category/search title/description priority');

    record('TEST_18', 'Existing product, category, and homepage SEO implementations remain intact and enhanced', 'PASS');
  } catch (err) {
    record('TEST_18', 'Workflow continuity', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('======================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
};

runSuite().catch((err) => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
