/**
 * LuxeCart Phase 6A: Storefront Category Navigation Decoupling Test Suite
 *
 * Verifies:
 * 1. Complete removal of hardcoded ObjectIds from Navbar and HomePage.
 * 2. Navigation items correctly map to canonical category slugs.
 * 3. Backend catalog query resolution for all category slugs (footwear, beauty, accessories, lifestyle, men, women).
 * 4. Error handling for non-existent and malformed slugs.
 * 5. Composition of category slug filtering with search, sort, price, and pagination.
 * 6. Backward compatibility for legacy 24-hex ObjectIds.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { validateCatalogQuery } from '../src/validators/product.validator.js';
import Category from '../src/modules/categories/category.model.js';
import productService from '../src/modules/products/product.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('======================================================================');
console.log('   LUXECART PHASE 6A: CATEGORY NAVIGATION DECOUPLING TEST SUITE       ');
console.log('======================================================================\n');

const results = [];

async function runTest(testId, name, fn) {
  try {
    await fn();
    results.push({ testId, name, status: 'PASS' });
    console.log(`✔ [PASS] [${testId}] ${name}`);
  } catch (err) {
    results.push({ testId, name, status: 'FAIL', error: err.message });
    console.error(`✖ [FAIL] [${testId}] ${name}`);
    console.error(`    ↳ ${err.message}`);
  }
}

async function runSuite() {
  const navbarPath = path.resolve(__dirname, '../../client/src/components/Navbar.jsx');
  const navbarContent = fs.readFileSync(navbarPath, 'utf8');

  const homePagePath = path.resolve(__dirname, '../../client/src/pages/HomePage.jsx');
  const homePageContent = fs.readFileSync(homePagePath, 'utf8');

  // --------------------------------------------------------------------------
  // Group 1: Storefront Code Decoupling & Static Contract
  // --------------------------------------------------------------------------
  console.log('--- Group 1: Storefront Code Decoupling & Static Contract ---');

  await runTest('NAV-01', 'Navbar contains zero 24-hex MongoDB ObjectIds', () => {
    const objectIdRegex = /\b[0-9a-fA-F]{24}\b/g;
    const matches = navbarContent.match(objectIdRegex);
    assert.strictEqual(matches, null, `Found hardcoded ObjectIds in Navbar.jsx: ${matches}`);
  });

  await runTest('NAV-02', 'Navbar primary navigation items use canonical category slugs', () => {
    assert(navbarContent.includes("path: '/shop?category=footwear'"), 'Navbar must link to /shop?category=footwear');
    assert(navbarContent.includes("path: '/shop?category=beauty'"), 'Navbar must link to /shop?category=beauty');
    assert(navbarContent.includes("path: '/shop?category=accessories'"), 'Navbar must link to /shop?category=accessories');
    assert(navbarContent.includes("path: '/shop?category=lifestyle'"), 'Navbar must link to /shop?category=lifestyle');
  });

  await runTest('NAV-03', 'HomePage contains zero 24-hex MongoDB ObjectIds', () => {
    const objectIdRegex = /\b[0-9a-fA-F]{24}\b/g;
    const matches = homePageContent.match(objectIdRegex);
    assert.strictEqual(matches, null, `Found hardcoded ObjectIds in HomePage.jsx: ${matches}`);
  });

  await runTest('NAV-04', 'HomePage department tiles use canonical category slugs & gender parameters', () => {
    assert(homePageContent.includes("link: '/shop?category=footwear'"), 'Department tile must link to /shop?category=footwear');
    assert(homePageContent.includes("link: '/shop?category=beauty'"), 'Department tile must link to /shop?category=beauty');
    assert(homePageContent.includes("link: '/shop?category=accessories'"), 'Department tile must link to /shop?category=accessories');
    assert(homePageContent.includes("link: '/shop?category=lifestyle'"), 'Department tile must link to /shop?category=lifestyle');
    assert(homePageContent.includes("link: '/shop?gender=MEN'"), 'Department tile must link to /shop?gender=MEN');
    assert(homePageContent.includes("link: '/shop?gender=WOMEN'"), 'Department tile must link to /shop?gender=WOMEN');
  });

  await runTest('NAV-05', 'HomePage promo banner and footer links use canonical category slugs', () => {
    assert(homePageContent.includes('to="/shop?category=footwear"'), 'Promo banner / footer must link to footwear slug');
    assert(homePageContent.includes('to="/shop?category=beauty"'), 'Footer must link to beauty slug');
    assert(homePageContent.includes('to="/shop?category=accessories"'), 'Footer must link to accessories slug');
  });

  // --------------------------------------------------------------------------
  // Group 2: Backend Slug Resolution & Error Safeguards
  // --------------------------------------------------------------------------
  console.log('\n--- Group 2: Backend Slug Resolution & Error Safeguards ---');

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const canonicalSlugs = ['footwear', 'beauty', 'accessories', 'lifestyle', 'men', 'women'];

    for (const slug of canonicalSlugs) {
      await runTest(`SLUG-${slug.toUpperCase()}`, `Resolves canonical category slug "${slug}" to active category document`, async () => {
        const catDoc = await Category.findOne({ slug }).lean();
        assert(catDoc, `Seed category "${slug}" must exist in MongoDB`);
        assert.strictEqual(catDoc.isActive, true, `Category "${slug}" must be active`);

        const parsed = await validateCatalogQuery({ category: slug });
        assert.strictEqual(parsed.filter.status, 'ACTIVE');
        assert.strictEqual(parsed.filter.categoryTree.toString(), catDoc._id.toString());
      });
    }

    await runTest('SLUG-ERR-01', 'Rejects non-existent category slug with VALIDATION_ERROR (400)', async () => {
      let threw = false;
      try {
        await validateCatalogQuery({ category: 'non-existent-luxury-brand' });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'VALIDATION_ERROR');
      }
      assert(threw, 'Should throw 400 for non-existent slug');
    });

    await runTest('SLUG-ERR-02', 'Rejects malformed category slug with punctuation or unsafe characters', async () => {
      let threw = false;
      try {
        await validateCatalogQuery({ category: 'footwear<script>alert(1)</script>' });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'VALIDATION_ERROR');
      }
      assert(threw, 'Should throw 400 for malformed slug');
    });

    await runTest('SLUG-BACKCOMPAT', 'Preserves backward compatibility for 24-hex ObjectIds', async () => {
      const catDoc = await Category.findOne({ slug: 'footwear' }).lean();
      const parsed = await validateCatalogQuery({ category: catDoc._id.toString() });
      assert.strictEqual(parsed.filter.categoryTree.toString(), catDoc._id.toString());
    });

    // --------------------------------------------------------------------------
    // Group 3: Catalog Query Execution, Search & Filter Composition
    // --------------------------------------------------------------------------
    console.log('\n--- Group 3: Catalog Query Execution, Search & Filter Composition ---');

    await runTest('FILTER-01', 'Filters products accurately using category slug "footwear"', async () => {
      const footwearCat = await Category.findOne({ slug: 'footwear' }).lean();
      const queryPromise = validateCatalogQuery({ category: 'footwear' });
      const result = await productService.getProducts(queryPromise);

      assert(Array.isArray(result.products), 'Result must contain products array');
      assert(result.products.length > 0, 'Must find products in footwear category');
      for (const prod of result.products) {
        const treeIds = (prod.categoryTree || []).map((id) => id.toString());
        assert(treeIds.includes(footwearCat._id.toString()), 'Product must belong to footwear categoryTree');
      }
    });

    await runTest('FILTER-02', 'Combines category slug with price range, sorting, and inStock filters', async () => {
      const queryPromise = validateCatalogQuery({
        category: 'footwear',
        minPrice: '2000',
        maxPrice: '20000',
        sort: 'price-low',
        inStock: 'true',
      });
      const result = await productService.getProducts(queryPromise);
      assert(Array.isArray(result.products), 'Result must return valid array');
    });

    await runTest('FILTER-03', 'Combines category slug with text search keyword', async () => {
      const queryPromise = validateCatalogQuery({
        category: 'footwear',
        search: 'leather',
      });
      const result = await productService.getProducts(queryPromise);
      assert(Array.isArray(result.products), 'Search within category must succeed');
    });

    // --------------------------------------------------------------------------
    // Group 4: Client URL Synchronization Simulation
    // --------------------------------------------------------------------------
    console.log('\n--- Group 4: Client URL Synchronization Simulation ---');

    await runTest('URL-01', 'URLSearchParams round-trips category slug without mutation', () => {
      const params = new URLSearchParams('category=footwear&sort=price-high&page=2');
      assert.strictEqual(params.get('category'), 'footwear');
      assert.strictEqual(params.get('sort'), 'price-high');
      assert.strictEqual(params.get('page'), '2');

      // Update category to beauty
      params.set('category', 'beauty');
      params.set('page', '1');
      assert.strictEqual(params.toString(), 'category=beauty&sort=price-high&page=1');
    });

    await runTest('URL-02', 'Clearing category leaves other search and sort parameters intact', () => {
      const params = new URLSearchParams('category=accessories&search=leather&sort=newest');
      params.delete('category');
      assert.strictEqual(params.get('category'), null);
      assert.strictEqual(params.get('search'), 'leather');
      assert.strictEqual(params.get('sort'), 'newest');
    });

  } finally {
    await mongoose.disconnect();
  }

  console.log('\n======================================================================');
  console.log('                 PHASE 6A TEST RESULTS SUMMARY                        ');
  console.log('======================================================================');
  console.table(results);

  const failed = results.filter((r) => r.status === 'FAIL');
  if (failed.length > 0) {
    console.error(`\n✖ ${failed.length} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\n✔ All ${results.length} Phase 6A Category Navigation tests passed!`);
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
