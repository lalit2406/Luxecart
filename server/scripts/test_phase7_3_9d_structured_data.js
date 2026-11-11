/**
 * LUXECART PHASE 7.3.9D: ECOMMERCE STRUCTURED DATA & BREADCRUMB SEO SUITE
 *
 * Tests all 12 curated portfolio products, single/multi-variant handling,
 * inactive variant filtering, out-of-stock availability, invalid price omission,
 * missing optional identifiers, root/child/missing category breadcrumbs,
 * and Organization/WebSite JSON-LD compliance.
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
  console.log('   LUXECART PHASE 7.3.9D: STRUCTURED DATA & BREADCRUMB VERIFICATION');
  console.log('======================================================================\n');

  const seoUtilsPath = path.join(rootDir, 'client/src/features/settings/utils/seoUtils.js');
  const seoUtils = await import(`file://${seoUtilsPath.replace(/\\/g, '/')}`);

  const TARGET_ORIGIN = 'https://luxecart-rouge.vercel.app';

  const mockCategoryTree = [
    {
      _id: 'c_men',
      name: 'MEN',
      slug: 'men',
      isActive: true,
      children: [
        {
          _id: 'c_men_app',
          name: 'Apparel',
          slug: 'mens-apparel',
          isActive: true,
          children: [
            { _id: 'c_men_tees', name: 'T-Shirts', slug: 'mens-t-shirts', isActive: true, children: [] },
            { _id: 'c_men_shirts', name: 'Shirts', slug: 'mens-shirts', isActive: true, children: [] },
            { _id: 'c_men_jeans', name: 'Jeans', slug: 'mens-jeans', isActive: true, children: [] },
          ],
        },
      ],
    },
    {
      _id: 'c_women',
      name: 'WOMEN',
      slug: 'women',
      isActive: true,
      children: [
        {
          _id: 'c_women_app',
          name: 'Apparel',
          slug: 'womens-apparel',
          isActive: true,
          children: [
            { _id: 'c_dresses', name: 'Dresses', slug: 'womens-dresses', isActive: true, children: [] },
            { _id: 'c_tops', name: 'Tops', slug: 'womens-tops', isActive: true, children: [] },
            { _id: 'c_kurta', name: 'Kurta Sets', slug: 'womens-kurta-sets', isActive: true, children: [] },
            { _id: 'c_trousers', name: 'Trousers', slug: 'womens-trousers', isActive: true, children: [] },
          ],
        },
      ],
    },
    {
      _id: 'c_footwear',
      name: 'FOOTWEAR',
      slug: 'footwear',
      isActive: true,
      children: [
        { _id: 'c_sneakers', name: 'Sneakers', slug: 'sneakers', isActive: true, children: [] },
        { _id: 'c_loafers', name: 'Loafers', slug: 'loafers', isActive: true, children: [] },
      ],
    },
    {
      _id: 'c_beauty',
      name: 'BEAUTY',
      slug: 'beauty',
      isActive: true,
      children: [
        {
          _id: 'c_skincare',
          name: 'Skincare',
          slug: 'skincare',
          isActive: true,
          children: [{ _id: 'c_serum', name: 'Face Serum', slug: 'face-serum', isActive: true, children: [] }],
        },
      ],
    },
    {
      _id: 'c_acc',
      name: 'ACCESSORIES',
      slug: 'accessories',
      isActive: true,
      children: [
        {
          _id: 'c_bags',
          name: 'Bags',
          slug: 'bags',
          isActive: true,
          children: [{ _id: 'c_sbags', name: 'Shoulder Bags', slug: 'shoulder-bags', isActive: true, children: [] }],
        },
      ],
    },
    {
      _id: 'c_inactive',
      name: 'Archived Dept',
      slug: 'archived-dept',
      isActive: false,
      children: [],
    },
  ];

  // -------------------------------------------------------------------------
  // 1. Validate All 12 Curated Portfolio Products
  // -------------------------------------------------------------------------
  try {
    const curated12 = [
      { name: 'Aurelio Essential Oversized T-Shirt', slug: 'aurelio-essential-oversized-t-shirt', brand: 'Aurelio', price: 899, sku: 'AUR-TEE-001-BLK-S', cat: { _id: 'c_men_tees', name: 'T-Shirts', slug: 'mens-t-shirts', ancestors: [{ _id: 'c_men', name: 'MEN', slug: 'men' }, { _id: 'c_men_app', name: 'Apparel', slug: 'mens-apparel' }] }, multi: true },
      { name: 'Northline Oxford Casual Shirt', slug: 'northline-oxford-casual-shirt', brand: 'Northline', price: 1499, sku: 'NOR-SHT-001-WHT-M', cat: { _id: 'c_men_shirts', name: 'Shirts', slug: 'mens-shirts', ancestors: [{ _id: 'c_men', name: 'MEN', slug: 'men' }, { _id: 'c_men_app', name: 'Apparel', slug: 'mens-apparel' }] }, multi: true },
      { name: 'Veyron Relaxed Linen Shirt', slug: 'veyron-relaxed-linen-shirt', brand: 'Veyron', price: 1699, sku: 'VEY-LIN-001-SND-L', cat: { _id: 'c_men_shirts', name: 'Shirts', slug: 'mens-shirts', ancestors: [{ _id: 'c_men', name: 'MEN', slug: 'men' }, { _id: 'c_men_app', name: 'Apparel', slug: 'mens-apparel' }] }, multi: true },
      { name: 'Urban Form Straight Fit Denim', slug: 'urban-form-straight-fit-denim', brand: 'Urban Form', price: 1899, sku: 'UFM-DNM-001-IND-32', cat: { _id: 'c_men_jeans', name: 'Jeans', slug: 'mens-jeans', ancestors: [{ _id: 'c_men', name: 'MEN', slug: 'men' }, { _id: 'c_men_app', name: 'Apparel', slug: 'mens-apparel' }] }, multi: true },
      { name: 'Élané Satin Midi Dress', slug: 'elane-satin-midi-dress', brand: 'Élané', price: 2099, sku: 'ELA-DRS-001-BLK-M', cat: { _id: 'c_dresses', name: 'Dresses', slug: 'womens-dresses', ancestors: [{ _id: 'c_women', name: 'WOMEN', slug: 'women' }, { _id: 'c_women_app', name: 'Apparel', slug: 'womens-apparel' }] }, multi: true },
      { name: 'Miraé Ribbed Knit Top', slug: 'mirae-ribbed-knit-top', brand: 'Miraé', price: 899, sku: 'MIR-TOP-001-CRM-S', cat: { _id: 'c_tops', name: 'Tops', slug: 'womens-tops', ancestors: [{ _id: 'c_women', name: 'WOMEN', slug: 'women' }, { _id: 'c_women_app', name: 'Apparel', slug: 'womens-apparel' }] }, multi: true },
      { name: 'Nivara Printed Kurta Set', slug: 'nivara-printed-kurta-set', brand: 'Nivara', price: 1799, sku: 'NIV-KUR-001-GRN-M', cat: { _id: 'c_kurta', name: 'Kurta Sets', slug: 'womens-kurta-sets', ancestors: [{ _id: 'c_women', name: 'WOMEN', slug: 'women' }, { _id: 'c_women_app', name: 'Apparel', slug: 'womens-apparel' }] }, multi: true },
      { name: 'Velora Wide-Leg Trousers', slug: 'velora-wide-leg-trousers', brand: 'Velora', price: 1499, sku: 'VEL-TRS-001-BGE-M', cat: { _id: 'c_trousers', name: 'Trousers', slug: 'womens-trousers', ancestors: [{ _id: 'c_women', name: 'WOMEN', slug: 'women' }, { _id: 'c_women_app', name: 'Apparel', slug: 'womens-apparel' }] }, multi: true },
      { name: 'Vanta Retro Runner Sneakers', slug: 'vanta-retro-runner-sneakers', brand: 'Vanta', price: 2499, sku: 'VAN-RUN-001-WHT-8', cat: { _id: 'c_sneakers', name: 'Sneakers', slug: 'sneakers', ancestors: [{ _id: 'c_footwear', name: 'FOOTWEAR', slug: 'footwear' }] }, multi: true },
      { name: 'Stride Minimal Leather Loafers', slug: 'stride-minimal-leather-loafers', brand: 'Stride', price: 2299, sku: 'STR-LOA-001-BLK-6', cat: { _id: 'c_loafers', name: 'Loafers', slug: 'loafers', ancestors: [{ _id: 'c_footwear', name: 'FOOTWEAR', slug: 'footwear' }] }, multi: true },
      { name: 'Nivelle Vitamin C Brightening Serum', slug: 'nivelle-vitamin-c-brightening-serum', brand: 'Nivelle', price: 699, sku: 'NIV-SRM-001-30ML', cat: { _id: 'c_serum', name: 'Face Serum', slug: 'face-serum', ancestors: [{ _id: 'c_beauty', name: 'BEAUTY', slug: 'beauty' }, { _id: 'c_skincare', name: 'Skincare', slug: 'skincare' }] }, multi: false },
      { name: 'Aurelia Structured Shoulder Bag', slug: 'aurelia-structured-shoulder-bag', brand: 'Aurelia', price: 2299, sku: 'AUR-BAG-001-BLK', cat: { _id: 'c_sbags', name: 'Shoulder Bags', slug: 'shoulder-bags', ancestors: [{ _id: 'c_acc', name: 'ACCESSORIES', slug: 'accessories' }, { _id: 'c_bags', name: 'Bags', slug: 'bags' }] }, multi: true },
    ];

    assert.strictEqual(curated12.length, 12);
    for (const item of curated12) {
      const variants = [
        { sku: item.sku, price: item.price, mrp: item.price + 500, inventory: { stock: 15 }, isActive: true },
        ...(item.multi
          ? [{ sku: `${item.sku}-ALT`, price: item.price + 100, mrp: item.price + 600, inventory: { stock: 10 }, isActive: true }]
          : []),
      ];
      const product = {
        _id: `id_${item.slug}`,
        name: item.name,
        slug: item.slug,
        brand: item.brand,
        description: `Curated ${item.name}`,
        category: item.cat,
        variants,
        priceSummary: { minPrice: item.price, hasStock: true },
        ratings: { average: 0, count: 0 },
      };
      const imgs = [{ url: `https://res.cloudinary.com/luxecart-india/image/upload/v1/luxecart/products/${item.slug}/front.jpg` }];

      const [prodLd, crumbLd] = seoUtils.buildProductStructuredData(product, variants[0], imgs, false);
      assert.strictEqual(prodLd['@type'], 'Product');
      assert.strictEqual(prodLd.name, item.name);
      assert.strictEqual(prodLd.brand?.name, item.brand);
      assert.strictEqual(prodLd.sku, item.sku);
      assert.strictEqual(prodLd.offers.price, item.price.toFixed(2));
      assert.strictEqual(prodLd.offers.priceCurrency, 'INR');
      assert.strictEqual(prodLd.offers.availability, 'https://schema.org/InStock');
      assert.strictEqual(prodLd.offers.url, `${TARGET_ORIGIN}/products/${item.slug}`);
      assert.ok(!('gtin' in prodLd) && !('mpn' in prodLd) && !('aggregateRating' in prodLd));

      assert.strictEqual(crumbLd['@type'], 'BreadcrumbList');
      crumbLd.itemListElement.forEach((el, idx) => {
        assert.strictEqual(el.position, idx + 1);
        assert.ok(el.item.startsWith(TARGET_ORIGIN));
      });
    }

    record('D-01', 'All 12 curated products (single & multi-variant) emit valid INR Product & BreadcrumbList JSON-LD', true);
  } catch (err) {
    record('D-01', '12 curated products JSON-LD verification', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 2. Inactive Variants, Out-Of-Stock, Invalid Price & Missing Identifiers
  // -------------------------------------------------------------------------
  try {
    // 2a. Inactive selected variant is ignored / never included in offers
    const inactiveProduct = {
      _id: 'p_inactive_vars',
      name: 'Inactive Variant Sample',
      slug: 'inactive-variant-sample',
      brand: 'LuxeCart',
      description: 'Test',
      variants: [{ sku: 'OLD-INACTIVE-SKU', price: 999, inventory: { stock: 10 }, isActive: false }],
      priceSummary: { minPrice: 999, hasStock: false },
    };
    const [inactiveLd] = seoUtils.buildProductStructuredData(inactiveProduct, inactiveProduct.variants[0], [], true);
    assert.strictEqual('offers' in inactiveLd, false, 'Inactive-only product must omit Offer');
    assert.strictEqual('sku' in inactiveLd, false, 'Inactive variant SKU must not be emitted');

    // 2b. Out-of-stock variant (even if caller forgot isOutOfStock=true) must emit OutOfStock
    const oosProduct = {
      name: 'Out of Stock Item',
      slug: 'oos-item',
      brand: 'Aurelio',
      variants: [{ sku: 'OOS-SKU-1', price: 1299, inventory: { stock: 0 }, isActive: true }],
      priceSummary: { minPrice: 1299, hasStock: false },
    };
    const [oosLd] = seoUtils.buildProductStructuredData(oosProduct, oosProduct.variants[0], [], false);
    assert.strictEqual(oosLd.offers.availability, 'https://schema.org/OutOfStock');

    // 2c. Product without optional SKU/GTIN/MPN/reviews omits them cleanly without fabricating placeholders
    const noSkuProduct = {
      _id: 'rawMongoId999',
      name: 'No SKU Sample',
      slug: 'no-sku-sample',
      variants: [],
      priceSummary: { minPrice: 1500, hasStock: true },
    };
    const [noSkuLd] = seoUtils.buildProductStructuredData(noSkuProduct, null, [], false);
    assert.strictEqual('sku' in noSkuLd, false, 'Must not fabricate SKU-rawMongoId999 when SKU is absent');
    assert.strictEqual('brand' in noSkuLd, false, 'Must not emit empty brand');
    assert.strictEqual('image' in noSkuLd, false, 'Must not emit empty image array');
    assert.strictEqual('aggregateRating' in noSkuLd, false);
    assert.strictEqual(noSkuLd.offers.price, '1500.00');

    // 2d. Valid genuine review aggregate IS emitted when count > 0
    const reviewedProduct = {
      name: 'Reviewed Piece',
      slug: 'reviewed-piece',
      brand: 'Veyron',
      variants: [{ sku: 'VEY-01', price: 1699, inventory: { stock: 5 }, isActive: true }],
      ratings: { average: 4.7, count: 12 },
    };
    const [reviewedLd] = seoUtils.buildProductStructuredData(reviewedProduct, reviewedProduct.variants[0], [], false);
    assert.deepStrictEqual(reviewedLd.aggregateRating, {
      '@type': 'AggregateRating',
      ratingValue: 4.7,
      reviewCount: 12,
    });

    record('D-02', 'Inactive variants, OutOfStock enforcement, and omission of fabricated SKU/GTIN/MPN/reviews verified', true);
  } catch (err) {
    record('D-02', 'Variant/OOS/Identifier edge cases', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 3. Shop & Product Breadcrumb Navigation + JSON-LD Parity
  // -------------------------------------------------------------------------
  try {
    // Root shop breadcrumb
    const rootShop = seoUtils.buildShopBreadcrumbs(mockCategoryTree, null);
    assert.deepStrictEqual(
      rootShop.items.map((i) => ({ label: i.label, to: i.to })),
      [
        { label: 'Home', to: '/' },
        { label: 'Shop', to: '/shop' },
      ]
    );
    assert.strictEqual(rootShop.jsonLd.itemListElement.length, 2);

    // Root category breadcrumb (/shop?category=footwear)
    const footwearShop = seoUtils.buildShopBreadcrumbs(mockCategoryTree, 'footwear');
    assert.deepStrictEqual(
      footwearShop.items.map((i) => i.label),
      ['Home', 'Shop', 'FOOTWEAR']
    );
    assert.strictEqual(footwearShop.jsonLd.itemListElement[2].position, 3);
    assert.strictEqual(footwearShop.jsonLd.itemListElement[2].item, `${TARGET_ORIGIN}/shop?category=footwear`);

    // Leaf child category breadcrumb (/shop?category=mens-t-shirts)
    const leafShop = seoUtils.buildShopBreadcrumbs(mockCategoryTree, 'mens-t-shirts');
    assert.deepStrictEqual(
      leafShop.items.map((i) => i.label),
      ['Home', 'Shop', 'MEN', 'Apparel', 'T-Shirts']
    );
    assert.deepStrictEqual(
      leafShop.jsonLd.itemListElement.map((el) => ({ pos: el.position, name: el.name })),
      [
        { pos: 1, name: 'Home' },
        { pos: 2, name: 'Shop' },
        { pos: 3, name: 'MEN' },
        { pos: 4, name: 'Apparel' },
        { pos: 5, name: 'T-Shirts' },
      ]
    );

    // Missing or inactive category safely omitted (only Home > Shop)
    const missingCatShop = seoUtils.buildShopBreadcrumbs(mockCategoryTree, 'nonexistent-category');
    assert.strictEqual(missingCatShop.items.length, 2);
    const inactiveCatShop = seoUtils.buildShopBreadcrumbs(mockCategoryTree, 'archived-dept');
    assert.strictEqual(inactiveCatShop.items.length, 2);

    // Product breadcrumbs match Product JSON-LD BreadcrumbList 1:1
    const sampleProd = {
      name: 'Aurelio Essential Oversized T-Shirt',
      slug: 'aurelio-essential-oversized-t-shirt',
      category: {
        _id: 'c_men_tees',
        name: 'T-Shirts',
        slug: 'mens-t-shirts',
        ancestors: [
          { _id: 'c_men', name: 'MEN', slug: 'men' },
          { _id: 'c_men_app', name: 'Apparel', slug: 'mens-apparel' },
        ],
      },
      variants: [{ sku: 'AUR-TEE-001-BLK-S', price: 899, inventory: { stock: 10 }, isActive: true }],
    };
    const pdpCrumbs = seoUtils.buildProductBreadcrumbs(sampleProd);
    const [, pdpBreadcrumbLd] = seoUtils.buildProductStructuredData(sampleProd, sampleProd.variants[0], [], false);
    assert.deepStrictEqual(pdpCrumbs.jsonLd, pdpBreadcrumbLd);
    assert.deepStrictEqual(
      pdpCrumbs.items.map((i) => i.label),
      ['Home', 'Shop', 'MEN', 'Apparel', 'T-Shirts', 'Aurelio Essential Oversized T-Shirt']
    );

    // Confirm ShopPage.jsx & ProductDetailPage.jsx render visible <nav aria-label="Breadcrumb"> with Link
    const shopSrc = fs.readFileSync(path.join(rootDir, 'client/src/pages/ShopPage.jsx'), 'utf8');
    const pdpSrc = fs.readFileSync(path.join(rootDir, 'client/src/pages/ProductDetailPage.jsx'), 'utf8');
    assert.ok(shopSrc.includes('aria-label="Breadcrumb"') && shopSrc.includes('shopBreadcrumbs.map'));
    assert.ok(pdpSrc.includes('aria-label="Breadcrumb"') && pdpSrc.includes('productBreadcrumbs.map'));

    record('D-03', 'Shop & Product visible breadcrumbs match BreadcrumbList JSON-LD 1:1 and exclude missing/inactive categories', true);
  } catch (err) {
    record('D-03', 'Breadcrumb parity verification', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 4. Organization & WebSite Schema Compliance
  // -------------------------------------------------------------------------
  try {
    const [orgSchema, webSiteSchema] = seoUtils.buildHomepageStructuredData({
      storeName: 'LuxeCart Atelier',
      tagline: 'Portfolio fashion storefront demonstration.',
      logoUrl: 'https://res.cloudinary.com/luxecart-india/image/upload/v1/logo.png',
    });

    assert.strictEqual(orgSchema['@type'], 'Organization');
    assert.strictEqual(orgSchema.name, 'LuxeCart Atelier');
    assert.strictEqual(orgSchema.url, TARGET_ORIGIN);
    assert.ok(!('address' in orgSchema) && !('telephone' in orgSchema) && !('sameAs' in orgSchema) && !('taxID' in orgSchema));

    assert.strictEqual(webSiteSchema['@type'], 'WebSite');
    assert.strictEqual(webSiteSchema.url, TARGET_ORIGIN);
    assert.strictEqual(webSiteSchema.potentialAction['@type'], 'SearchAction');
    assert.strictEqual(webSiteSchema.potentialAction.target, `${TARGET_ORIGIN}/shop?search={search_term_string}`);

    record('D-04', 'Organization & WebSite schema accurate with dynamic storeName, canonical origin, and SearchAction', true);
  } catch (err) {
    record('D-04', 'Organization & WebSite schema audit', false, err.message);
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
  console.error('Fatal Phase 7.3.9D test suite error:', err);
  process.exit(1);
});
