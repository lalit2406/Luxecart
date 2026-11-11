/**
 * LuxeCart — Phase 7.3.9G: Public Contact & Project Information Verification Suite
 *
 * Verifies:
 * 1. Public /contact route registered in App.jsx without ProtectedRoute.
 * 2. ContactPage renders via PolicyPageLayout with exactly one H1, unique title & description,
 *    canonical https://luxecart-rouge.vercel.app/contact, indexable SEO defaults (no noindex),
 *    accessible Home > Contact breadcrumbs, and shared portfolio notice.
 * 3. Footer Contact link exists in shared PortfolioFooter (covering Shop, ProductDetail,
 *    NotFound, Contact, and all 4 policy pages) and HomePage footer alongside all 4 policy links.
 * 4. Sitemap generators (client & server) include /contact and exclude private routes.
 * 5. Zero placeholder email/phone/address or invented social links on ContactPage.
 * 6. No public contact form (<form>) or guest submission endpoint added.
 * 7. Existing /support client routes and /api/v1/support/* backend routes remain protected.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const loadModule = (relPath) => import(pathToFileURL(path.join(rootDir, relPath)).href);
const readText = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

const results = [];
const record = (id, name, passed, details = '') => {
  results.push({ id, name, passed, details });
  if (passed) {
    console.log(`PASS [${id}] ${name}`);
  } else {
    console.error(`FAIL [${id}] ${name}${details ? ` — ${details}` : ''}`);
  }
};

async function run() {
  console.log('======================================================================');
  console.log('   LUXECART PHASE 7.3.9G: PUBLIC CONTACT & PROJECT INFO VERIFICATION  ');
  console.log('======================================================================\n');

  const appSrc = readText('client/src/App.jsx');
  const contactSrc = readText('client/src/pages/ContactPage.jsx');
  const policyLayoutSrc = readText('client/src/components/common/PolicyPageLayout.jsx');
  const footerSrc = readText('client/src/components/common/PortfolioFooter.jsx');
  const homeSrc = readText('client/src/pages/HomePage.jsx');
  const shopSrc = readText('client/src/pages/ShopPage.jsx');
  const productDetailSrc = readText('client/src/pages/ProductDetailPage.jsx');
  const notFoundSrc = readText('client/src/pages/NotFoundPage.jsx');
  const seoComponentSrc = readText('client/src/components/common/SEO.jsx');
  const privacySrc = readText('client/src/pages/PrivacyPolicyPage.jsx');
  const termsSrc = readText('client/src/pages/TermsPage.jsx');
  const shippingSrc = readText('client/src/pages/ShippingPolicyPage.jsx');
  const returnsSrc = readText('client/src/pages/ReturnsPolicyPage.jsx');
  const supportRoutesSrc = readText('server/src/modules/support/support.routes.js');
  const appServerSrc = readText('server/src/app.js');
  const serverSeoSrc = readText('server/src/modules/seo/seo.service.js');

  const seoUtils = await loadModule('client/src/features/settings/utils/seoUtils.js');
  const sitemapMod = await loadModule('client/scripts/generateSitemap.mjs');

  // TEST-01: Public /contact route accessibility without login
  try {
    assert.ok(
      appSrc.includes("const ContactPage = lazy(() => import('./pages/ContactPage'))"),
      'App.jsx must lazy-load ContactPage'
    );
    assert.ok(
      appSrc.includes('<Route path="/contact" element={<ContactPage />} />'),
      'App.jsx must register public /contact route outside ProtectedRoute'
    );
    record('CONTACT-01', 'Public /contact route registered without ProtectedRoute', true);
  } catch (err) {
    record('CONTACT-01', 'Public /contact route registration', false, err.message);
  }

  // TEST-02: Single H1, unique title & description, canonical, indexable SEO, Home > Contact breadcrumbs
  try {
    assert.ok(contactSrc.includes('<PolicyPageLayout'), 'ContactPage must reuse shared PolicyPageLayout');
    assert.strictEqual((policyLayoutSrc.match(/<h1[\s>]/g) || []).length, 1, 'PolicyPageLayout must render exactly 1 <h1>');
    assert.ok(contactSrc.includes('title="Project & Contact Information"'), 'ContactPage heading must be Project & Contact Information');
    assert.ok(contactSrc.includes('breadcrumbLabel="Contact"'), 'ContactPage breadcrumb label must be Contact');
    assert.ok(contactSrc.includes('canonicalPath="/contact"'), 'ContactPage must use canonicalPath="/contact"');
    assert.ok(!contactSrc.includes('noindex'), 'ContactPage must not set noindex');
    assert.ok(seoComponentSrc.includes("robots = 'index, follow'"), 'SEO component must default to index, follow');
    assert.strictEqual(
      seoUtils.buildCanonicalUrl('/contact'),
      'https://luxecart-rouge.vercel.app/contact',
      'Canonical URL must resolve to https://luxecart-rouge.vercel.app/contact'
    );

    const { items, jsonLd } = seoUtils.buildPageBreadcrumbs('Contact', '/contact');
    assert.deepStrictEqual(
      items.map((i) => i.label),
      ['Home', 'Contact'],
      'Visible breadcrumbs must be Home > Contact'
    );
    assert.strictEqual(jsonLd.itemListElement[1].item, 'https://luxecart-rouge.vercel.app/contact');

    const titleMatch = contactSrc.match(/seoTitle="([^"]+)"/);
    const descMatch = contactSrc.match(/description="([^"]+)"/);
    assert.ok(titleMatch && titleMatch[1].trim(), 'ContactPage must have seoTitle');
    assert.ok(descMatch && descMatch[1].trim(), 'ContactPage must have description');

    for (const sibling of [privacySrc, termsSrc, shippingSrc, returnsSrc]) {
      const otherTitle = sibling.match(/seoTitle="([^"]+)"/)?.[1];
      const otherDesc = sibling.match(/description="([^"]+)"/)?.[1];
      assert.notStrictEqual(titleMatch[1], otherTitle, 'ContactPage seoTitle must be unique');
      assert.notStrictEqual(descMatch[1], otherDesc, 'ContactPage description must be unique');
    }

    assert.ok(contactSrc.includes('non-commercial ecommerce portfolio demonstration'), 'ContactPage must state portfolio status');
    assert.ok(contactSrc.includes('no public customer support'), 'ContactPage must disclose absence of public support');
    record('CONTACT-02', 'ContactPage H1, unique title/description, canonical, indexability & Home > Contact breadcrumbs verified', true);
  } catch (err) {
    record('CONTACT-02', 'ContactPage SEO, H1, canonical & breadcrumbs', false, err.message);
  }

  // TEST-03: Shared footer Contact link across Home, Shop, Product Detail, NotFound, and policy pages
  try {
    assert.ok(footerSrc.includes("to: '/contact'"), 'PortfolioFooter must define /contact link');
    assert.ok(footerSrc.includes('CONTACT_NAV_LINK'), 'PortfolioFooter must use CONTACT_NAV_LINK');
    assert.ok(footerSrc.includes('POLICY_NAV_LINKS'), 'PortfolioFooter must preserve all 4 policy links');
    assert.ok(homeSrc.includes('CONTACT_NAV_LINK'), 'HomePage footer must render shared CONTACT_NAV_LINK');
    assert.ok(homeSrc.includes('POLICY_NAV_LINKS'), 'HomePage footer must keep POLICY_NAV_LINKS');
    for (const page of [
      { name: 'ShopPage', src: shopSrc },
      { name: 'ProductDetailPage', src: productDetailSrc },
      { name: 'NotFoundPage', src: notFoundSrc },
      { name: 'PolicyPageLayout (used by all policy pages & ContactPage)', src: policyLayoutSrc },
    ]) {
      assert.ok(page.src.includes('<PortfolioFooter />'), `${page.name} must render shared PortfolioFooter`);
    }
    record('CONTACT-03', 'Contact link & all 4 policy links verified across Home, Shop, ProductDetail, NotFound & policy pages', true);
  } catch (err) {
    record('CONTACT-03', 'Footer Contact link coverage', false, err.message);
  }

  // TEST-04: Sitemap inclusion of /contact and exclusion of private routes
  try {
    const xml = sitemapMod.buildSitemapXml({
      siteOrigin: 'https://luxecart-rouge.vercel.app',
      categories: [],
      products: [],
    });
    assert.ok(
      xml.includes('<loc>https://luxecart-rouge.vercel.app/contact</loc>'),
      'Client sitemap XML must include https://luxecart-rouge.vercel.app/contact'
    );
    assert.ok(
      serverSeoSrc.includes("addUrl('/contact'"),
      'Server seo.service.js must include /contact'
    );
    for (const privatePath of ['/support', '/checkout', '/orders', '/admin', '/cart', '/login']) {
      assert.ok(!xml.includes(`<loc>https://luxecart-rouge.vercel.app${privatePath}</loc>`), `Sitemap must exclude ${privatePath}`);
    }
    record('CONTACT-04', 'Client & server sitemaps include /contact and exclude private routes', true);
  } catch (err) {
    record('CONTACT-04', 'Sitemap /contact inclusion', false, err.message);
  }

  // TEST-05: Zero placeholder contacts, zero public contact form or guest contact API
  try {
    for (const forbidden of [
      'support@luxecart.com',
      '98765',
      'Indiranagar',
      'Bengaluru',
      '560038',
      '<form',
      '<input',
      '<textarea',
      'onSubmit',
      'mailto:',
      'tel:',
    ]) {
      assert.ok(!contactSrc.includes(forbidden), `ContactPage must not contain "${forbidden}"`);
    }
    assert.ok(!appServerSrc.includes('/contact'), 'Server app.js must not mount any public /contact API');
    record('CONTACT-05', 'No placeholder contact info, public form, or guest submission API added', true);
  } catch (err) {
    record('CONTACT-05', 'Placeholder contact & form exclusion', false, err.message);
  }

  // TEST-06: Existing /support frontend route & /api/v1/support/* API remain protected
  try {
    const supportRouteBlock = appSrc.match(/path="\/support"[\s\S]{0,200}/)?.[0] || '';
    const supportTicketBlock = appSrc.match(/path="\/support\/tickets\/:ticketNumber"[\s\S]{0,200}/)?.[0] || '';
    assert.ok(supportRouteBlock.includes('<ProtectedRoute>'), '/support route must remain wrapped in <ProtectedRoute>');
    assert.ok(supportTicketBlock.includes('<ProtectedRoute>'), '/support/tickets/:ticketNumber must remain wrapped in <ProtectedRoute>');
    assert.ok(supportRoutesSrc.includes('router.use(authenticate);'), 'support.routes.js must keep router.use(authenticate)');
    record('CONTACT-06', 'Existing /support route & /api/v1/support/* API remain authenticated', true);
  } catch (err) {
    record('CONTACT-06', 'Support authorization preservation', false, err.message);
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
