/**
 * LuxeCart — Phase 7.3.9F: Portfolio Trust & Legal Transparency Verification Suite
 *
 * Verifies:
 * 1. Public legal/policy routes (/privacy-policy, /terms, /shipping-policy, /returns-policy)
 *    are registered in App.jsx without ProtectedRoute while private routes stay protected.
 * 2. PolicyPageLayout and all 4 policy pages provide unique titles, descriptions, canonical paths,
 *    a single H1, accessible breadcrumbs, BreadcrumbList JSON-LD, and honest portfolio disclosures.
 * 3. Storefront pages (HomePage, ShopPage, ProductDetailPage, NotFoundPage, OrderSuccessPage)
 *    render PortfolioFooter / PortfolioNoticeStrip and remove misleading claims.
 * 4. Default store settings and fallbacks (client + server) contain zero placeholder Bengaluru/support@luxecart.com
 *    contacts, and storeSettings.validator allows clearing supportEmail to empty string.
 * 5. Client and server sitemap generators include all 4 public policy routes.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const loadModule = (relPath) => import(pathToFileURL(path.join(rootDir, relPath)).href);

const results = [];
const record = (id, name, passed, details = '') => {
  results.push({ id, name, passed, details });
  if (passed) {
    console.log(`PASS [${id}] ${name}`);
  } else {
    console.error(`FAIL [${id}] ${name}${details ? ` — ${details}` : ''}`);
  }
};

const readText = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

async function run() {
  console.log('======================================================================');
  console.log('   LUXECART PHASE 7.3.9F: PORTFOLIO TRUST & LEGAL VERIFICATION        ');
  console.log('======================================================================\n');

  const appSrc = readText('client/src/App.jsx');
  const homeSrc = readText('client/src/pages/HomePage.jsx');
  const shopSrc = readText('client/src/pages/ShopPage.jsx');
  const productDetailSrc = readText('client/src/pages/ProductDetailPage.jsx');
  const notFoundSrc = readText('client/src/pages/NotFoundPage.jsx');
  const orderSuccessSrc = readText('client/src/pages/OrderSuccessPage.jsx');
  const announcementSrc = readText('client/src/components/home/AnnouncementBar.jsx');
  const footerSrc = readText('client/src/components/common/PortfolioFooter.jsx');
  const policyLayoutSrc = readText('client/src/components/common/PolicyPageLayout.jsx');
  const privacySrc = readText('client/src/pages/PrivacyPolicyPage.jsx');
  const termsSrc = readText('client/src/pages/TermsPage.jsx');
  const shippingSrc = readText('client/src/pages/ShippingPolicyPage.jsx');
  const returnsSrc = readText('client/src/pages/ReturnsPolicyPage.jsx');

  const defaultSettingsMod = await loadModule('client/src/features/settings/context/defaultSettings.js');
  const seoUtilsMod = await loadModule('client/src/features/settings/utils/seoUtils.js');
  const sitemapMod = await loadModule('client/scripts/generateSitemap.mjs');
  const validatorMod = await loadModule('server/src/validators/storeSettings.validator.js');

  const modelSrc = readText('server/src/modules/settings/storeSettings.model.js');
  const settingsServiceSrc = readText('server/src/modules/settings/storeSettings.service.js');
  const adminSettingsApiSrc = readText('client/src/features/admin/settings/api/adminSettingsApi.js');
  const serverSeoSrc = readText('server/src/modules/seo/seo.service.js');

  // TEST-01: Public policy routes registered outside ProtectedRoute
  try {
    const publicRoutes = [
      { path: '/privacy-policy', component: 'PrivacyPolicyPage' },
      { path: '/terms', component: 'TermsPage' },
      { path: '/shipping-policy', component: 'ShippingPolicyPage' },
      { path: '/returns-policy', component: 'ReturnsPolicyPage' },
    ];
    for (const r of publicRoutes) {
      const exactRoute = `<Route path="${r.path}" element={<${r.component} />} />`;
      assert.ok(appSrc.includes(exactRoute), `App.jsx missing public route: ${exactRoute}`);
    }
    assert.ok(appSrc.includes('path="/account/addresses"'), 'Protected addresses route preserved');
    assert.ok(appSrc.includes('path="/checkout"'), 'Protected checkout route preserved');
    assert.ok(appSrc.includes('path="/support"'), 'Protected support route preserved');
    record('TRUST-01', 'All 4 policy routes are publicly routed without ProtectedRoute', true);
  } catch (err) {
    record('TRUST-01', 'Public policy routing', false, err.message);
  }

  // TEST-02: PolicyPageLayout & 4 policy pages SEO, single H1, breadcrumbs, and honesty
  try {
    const h1Count = (policyLayoutSrc.match(/<h1[\s>]/g) || []).length;
    assert.strictEqual(h1Count, 1, 'PolicyPageLayout must render exactly one <h1>');
    assert.ok(policyLayoutSrc.includes('<SEO'), 'PolicyPageLayout must render SEO');
    assert.ok(policyLayoutSrc.includes('aria-label="Breadcrumb"'), 'PolicyPageLayout must render accessible Breadcrumb nav');
    assert.ok(policyLayoutSrc.includes('buildPageBreadcrumbs'), 'PolicyPageLayout must generate synchronized BreadcrumbList JSON-LD');
    assert.ok(policyLayoutSrc.includes('<PortfolioNoticeStrip'), 'PolicyPageLayout must show PortfolioNoticeStrip');
    assert.ok(policyLayoutSrc.includes('<PortfolioFooter />'), 'PolicyPageLayout must show PortfolioFooter');

    const { jsonLd: bc } = seoUtilsMod.buildPageBreadcrumbs('Privacy Policy', '/privacy-policy');
    assert.strictEqual(bc['@type'], 'BreadcrumbList');
    assert.strictEqual(bc.itemListElement.length, 2);
    assert.strictEqual(bc.itemListElement[1].item, 'https://luxecart-rouge.vercel.app/privacy-policy');

    const policyDocs = [
      { name: 'PrivacyPolicyPage', src: privacySrc, canonical: '/privacy-policy' },
      { name: 'TermsPage', src: termsSrc, canonical: '/terms' },
      { name: 'ShippingPolicyPage', src: shippingSrc, canonical: '/shipping-policy' },
      { name: 'ReturnsPolicyPage', src: returnsSrc, canonical: '/returns-policy' },
    ];
    const seoTitles = new Set();
    const descriptions = new Set();
    for (const doc of policyDocs) {
      assert.ok(doc.src.includes(`canonicalPath="${doc.canonical}"`), `${doc.name} must pass canonicalPath="${doc.canonical}"`);
      const titleMatch = doc.src.match(/seoTitle="([^"]+)"/);
      const descMatch = doc.src.match(/description="([^"]+)"/);
      assert.ok(titleMatch && titleMatch[1].trim(), `${doc.name} must have seoTitle`);
      assert.ok(descMatch && descMatch[1].trim(), `${doc.name} must have description`);
      assert.ok(!seoTitles.has(titleMatch[1]), `Duplicate seoTitle in ${doc.name}`);
      assert.ok(!descriptions.has(descMatch[1]), `Duplicate description in ${doc.name}`);
      seoTitles.add(titleMatch[1]);
      descriptions.add(descMatch[1]);
      assert.ok(doc.src.toLowerCase().includes('portfolio'), `${doc.name} must disclose portfolio status`);
      assert.ok(!doc.src.includes('support@luxecart.com'), `${doc.name} must not leak placeholder support@luxecart.com`);
      assert.ok(!doc.src.includes('luxecart_staging'), `${doc.name} must not expose internal DB name`);
    }
    record('TRUST-02', 'Policy pages have unique SEO metadata, canonical paths, single H1, breadcrumbs & honest disclosures', true);
  } catch (err) {
    record('TRUST-02', 'Policy page SEO and content checks', false, err.message);
  }

  // TEST-03: Removal of misleading commercial/legal claims and presence of Portfolio Notice
  try {
    const forbiddenClaims = [
      'DPDP Act 2023 Compliant',
      'Authenticity Guarantee',
      'Customer Grievance Officer',
      '256-Bit SSL Encryption',
    ];
    for (const phrase of forbiddenClaims) {
      assert.ok(!homeSrc.includes(phrase), `HomePage must not contain "${phrase}"`);
      assert.ok(!footerSrc.includes(phrase), `PortfolioFooter must not contain "${phrase}"`);
    }
    assert.ok(!orderSuccessSrc.includes('Authenticity Guaranteed'), 'OrderSuccessPage must not contain "Authenticity Guaranteed"');
    assert.ok(!orderSuccessSrc.includes('Standard Doorstep Delivery'), 'OrderSuccessPage must qualify simulated COD flow');
    assert.ok(announcementSrc.includes('Portfolio Demo'), 'AnnouncementBar default notice must identify Portfolio Demo');
    assert.ok(homeSrc.includes('POLICY_NAV_LINKS'), 'HomePage must render POLICY_NAV_LINKS');
    assert.ok(homeSrc.includes('<PortfolioNoticeStrip'), 'HomePage must render PortfolioNoticeStrip');
    assert.ok(footerSrc.includes('non-commercial ecommerce portfolio demonstration'), 'PortfolioFooter must contain portfolio notice');
    assert.ok(shopSrc.includes('<PortfolioFooter />'), 'ShopPage must render PortfolioFooter');
    assert.ok(productDetailSrc.includes('<PortfolioFooter />'), 'ProductDetailPage must render PortfolioFooter');
    assert.ok(notFoundSrc.includes('<PortfolioFooter />'), 'NotFoundPage must render PortfolioFooter');
    record('TRUST-03', 'Misleading claims removed and shared portfolio notice/footer integrated across storefront', true);
  } catch (err) {
    record('TRUST-03', 'Storefront claims & footer integration', false, err.message);
  }

  // TEST-04: Placeholder contact defaults removed across client & server
  try {
    const def = defaultSettingsMod.DEFAULT_PUBLIC_SETTINGS;
    assert.strictEqual(def.supportEmail, '', 'DEFAULT_PUBLIC_SETTINGS.supportEmail must be empty');
    assert.strictEqual(def.supportPhone, '', 'DEFAULT_PUBLIC_SETTINGS.supportPhone must be empty');
    assert.strictEqual(def.operatingHours, '', 'DEFAULT_PUBLIC_SETTINGS.operatingHours must be empty');
    assert.strictEqual(def.address.street, '', 'DEFAULT_PUBLIC_SETTINGS.address.street must be empty');
    assert.strictEqual(def.address.city, '', 'DEFAULT_PUBLIC_SETTINGS.address.city must be empty');
    assert.strictEqual(def.address.state, '', 'DEFAULT_PUBLIC_SETTINGS.address.state must be empty');
    assert.strictEqual(def.address.postalCode, '', 'DEFAULT_PUBLIC_SETTINGS.address.postalCode must be empty');
    assert.strictEqual(def.address.country, '', 'DEFAULT_PUBLIC_SETTINGS.address.country must be empty');

    const forbiddenDefaults = [
      'support@luxecart.com',
      '+91 98765 43210',
      '100 Feet Road, Indiranagar',
      '560038',
      'Bengaluru',
    ];
    for (const fileInfo of [
      { name: 'storeSettings.model.js', src: modelSrc },
      { name: 'storeSettings.service.js', src: settingsServiceSrc },
      { name: 'adminSettingsApi.js', src: adminSettingsApiSrc },
    ]) {
      for (const forbidden of forbiddenDefaults) {
        assert.ok(
          !fileInfo.src.includes(forbidden),
          `${fileInfo.name} must not hardcode placeholder "${forbidden}"`
        );
      }
    }

    const cleared = validatorMod.validateStoreSettingsUpdate({ supportEmail: '' });
    assert.strictEqual(cleared.supportEmail, '', 'Validator must allow clearing supportEmail to empty string');
    assert.throws(
      () => validatorMod.validateStoreSettingsUpdate({ supportEmail: 'bad-email' }),
      /supportEmail must be a valid email/
    );
    record('TRUST-04', 'Placeholder contact defaults and fallbacks removed cleanly', true);
  } catch (err) {
    record('TRUST-04', 'Contact defaults cleanup', false, err.message);
  }

  // TEST-05: Client and server sitemaps include all 4 policy routes
  try {
    const xml = sitemapMod.buildSitemapXml({
      siteOrigin: 'https://luxecart-rouge.vercel.app',
      categories: [],
      products: [{ slug: 'sample-item', status: 'ACTIVE' }],
    });
    for (const p of ['/privacy-policy', '/terms', '/shipping-policy', '/returns-policy']) {
      assert.ok(
        xml.includes(`<loc>https://luxecart-rouge.vercel.app${p}</loc>`),
        `Client sitemap missing ${p}`
      );
      assert.ok(
        serverSeoSrc.includes(`addUrl('${p}'`),
        `Server seo.service.js missing addUrl('${p}')`
      );
    }
    assert.ok(!xml.includes('/admin'), 'Sitemap must exclude /admin');
    assert.ok(!xml.includes('/checkout'), 'Sitemap must exclude /checkout');
    assert.ok(!xml.includes('/orders'), 'Sitemap must exclude /orders');
    record('TRUST-05', 'Client & server sitemaps include all 4 public policy routes', true);
  } catch (err) {
    record('TRUST-05', 'Sitemap policy routes check', false, err.message);
  }

  // TEST-06: Admin settings contact clearance (empty supportEmail & empty country)
  try {
    const adminApiMod = await loadModule('client/src/features/admin/settings/api/adminSettingsApi.js');
    const adminPageSrc = readText('client/src/pages/admin/AdminSettingsPage.jsx');
    const baseValidForm = adminApiMod.mapSettingsToForm({
      storeName: 'LuxeCart',
      supportEmail: '',
      supportPhone: '',
      operatingHours: '',
      address: { street: '', city: '', state: '', postalCode: '', country: '' },
      shipping: {
        standardFeePaise: 20000,
        enableFreeShippingThreshold: false,
        freeShippingThresholdPaise: 500000,
        deliveryEstimateDays: { min: 3, max: 7 },
      },
      payment: { isCodEnabled: true, maxCodOrderPaise: 10000000 },
      returns: { isReturnsEnabled: true, returnWindowDays: 7 },
    });

    // Empty supportEmail accepted
    const emptyErrs = adminApiMod.validateSettingsForm({ ...baseValidForm, supportEmail: '' });
    assert.strictEqual(emptyErrs.supportEmail, undefined, 'Empty supportEmail must pass validation');

    // Whitespace-only supportEmail accepted
    const wsErrs = adminApiMod.validateSettingsForm({ ...baseValidForm, supportEmail: '   ' });
    assert.strictEqual(wsErrs.supportEmail, undefined, 'Whitespace-only supportEmail must pass validation');

    // Valid supportEmail accepted
    const okErrs = adminApiMod.validateSettingsForm({ ...baseValidForm, supportEmail: 'demo@example.com' });
    assert.strictEqual(okErrs.supportEmail, undefined, 'Valid supportEmail must pass validation');

    // Invalid non-empty supportEmail rejected
    const badErrs = adminApiMod.validateSettingsForm({ ...baseValidForm, supportEmail: 'not-an-email' });
    assert.strictEqual(badErrs.supportEmail, 'Please provide a valid email address');
    const longErrs = adminApiMod.validateSettingsForm({
      ...baseValidForm,
      supportEmail: `${'a'.repeat(145)}@example.com`,
    });
    assert.strictEqual(longErrs.supportEmail, 'Support email cannot exceed 150 characters');

    // Unrelated validations preserved
    const storeNameErrs = adminApiMod.validateSettingsForm({ ...baseValidForm, storeName: '   ' });
    assert.strictEqual(storeNameErrs.storeName, 'Store name is required');
    const shipErrs = adminApiMod.validateSettingsForm({
      ...baseValidForm,
      shipping: { ...baseValidForm.shipping, standardFeeRupees: -5 },
    });
    assert.strictEqual(shipErrs['shipping.standardFeeRupees'], 'Standard shipping fee cannot be negative');

    // Empty country stays empty string in patch payload (does not silently restore 'India')
    const patch = adminApiMod.buildSettingsPatchPayload({
      ...baseValidForm,
      supportEmail: '   ',
      address: { street: '', city: '', state: '', postalCode: '', country: '   ' },
    });
    assert.strictEqual(patch.supportEmail, '', 'Cleared supportEmail must serialize as empty string');
    assert.strictEqual(patch.address.country, '', 'Cleared address.country must serialize as empty string');

    // Support Email Address label no longer renders required asterisk
    const labelBlock = adminPageSrc.match(/Support Email Address[\s\S]{0,120}<\/label>/)?.[0] || '';
    assert.ok(labelBlock && !labelBlock.includes('*'), 'Support Email Address label must not show required asterisk');

    record('TRUST-06', 'Admin settings contact clearance (empty email/country allowed, unrelated validation intact)', true);
  } catch (err) {
    record('TRUST-06', 'Admin settings contact clearance validation & payload', false, err.message);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n======================================================================');
  console.log(`RESULT: ${passed}/${results.length} PASSED, ${failed} FAILED`);
  console.log('======================================================================');
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
