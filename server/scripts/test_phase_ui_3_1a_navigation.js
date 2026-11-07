/**
 * LuxeCart Phase UI-3.1A Test Suite: Authentication Redirects & Catalog Navigation
 */

import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { getSafeRedirectPath } from '../../client/src/utils/navigation.js';
import { validateCatalogQuery } from '../src/validators/product.validator.js';
import Category from '../src/modules/categories/category.model.js';
import productService from '../src/modules/products/product.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('================================================================');
console.log('   LUXECART PHASE UI-3.1A NAVIGATION & REDIRECT TEST SUITE      ');
console.log('================================================================\n');

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
  // --------------------------------------------------------------------------
  // SECTION 1: Safe Redirect Path Validation
  // --------------------------------------------------------------------------
  await runTest('TEST-1', 'getSafeRedirectPath accepts valid string path', () => {
    const res = getSafeRedirectPath('/products/aurelia-structured-shoulder-bag');
    assert.strictEqual(res, '/products/aurelia-structured-shoulder-bag');
  });

  await runTest('TEST-2', 'getSafeRedirectPath accepts string path with query parameters', () => {
    const res = getSafeRedirectPath('/shop?category=footwear&sort=price-low');
    assert.strictEqual(res, '/shop?category=footwear&sort=price-low');
  });

  await runTest('TEST-3', 'getSafeRedirectPath accepts React Router location object', () => {
    const res = getSafeRedirectPath({ pathname: '/checkout', search: '?step=review', hash: '#details' });
    assert.strictEqual(res, '/checkout?step=review#details');
  });

  await runTest('TEST-4', 'getSafeRedirectPath rejects external open redirects (https://...)', () => {
    const res = getSafeRedirectPath('https://malicious-external-site.com');
    assert.strictEqual(res, '/');
  });

  await runTest('TEST-5', 'getSafeRedirectPath rejects protocol-relative URLs (//...)', () => {
    const res = getSafeRedirectPath('//attacker.com/steal-token');
    assert.strictEqual(res, '/');
  });

  await runTest('TEST-6', 'getSafeRedirectPath rejects Windows backslash evasion (/\\...)', () => {
    const res = getSafeRedirectPath('/\\evil.com');
    assert.strictEqual(res, '/');
  });

  await runTest('TEST-7', 'getSafeRedirectPath prevents redirect loops on auth routes (/login, /register)', () => {
    assert.strictEqual(getSafeRedirectPath('/login'), '/');
    assert.strictEqual(getSafeRedirectPath('/register'), '/');
    assert.strictEqual(getSafeRedirectPath({ pathname: '/LOGIN' }), '/');
  });

  await runTest('TEST-8', 'getSafeRedirectPath falls back to / on null/undefined/empty input', () => {
    assert.strictEqual(getSafeRedirectPath(null), '/');
    assert.strictEqual(getSafeRedirectPath(undefined), '/');
    assert.strictEqual(getSafeRedirectPath(''), '/');
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Category Slug & ObjectId Backend Resolution
  // --------------------------------------------------------------------------
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('\n Connected to MongoDB for Catalog Validation tests.\n');

  try {
    // Look up an existing real category in MongoDB
    const footwearCat = await Category.findOne({ slug: 'footwear' }).lean();
    assert(footwearCat, 'Seed category "footwear" must exist in database');

    await runTest('TEST-9', 'validateCatalogQuery resolves valid category slug to ObjectId', async () => {
      const parsed = await validateCatalogQuery({ category: 'footwear' });
      assert.strictEqual(parsed.filter.status, 'ACTIVE');
      assert.strictEqual(parsed.filter.categoryTree.toString(), footwearCat._id.toString());
    });

    await runTest('TEST-10', 'validateCatalogQuery resolves valid 24-hex category ObjectId', async () => {
      const parsed = await validateCatalogQuery({ category: footwearCat._id.toString() });
      assert.strictEqual(parsed.filter.categoryTree.toString(), footwearCat._id.toString());
    });

    await runTest('TEST-11', 'validateCatalogQuery rejects non-existent category slug with VALIDATION_ERROR (400)', async () => {
      let threw = false;
      try {
        await validateCatalogQuery({ category: 'non-existent-luxury-category' });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'VALIDATION_ERROR');
      }
      assert(threw, 'Should throw VALIDATION_ERROR for missing slug');
    });

    await runTest('TEST-12', 'validateCatalogQuery rejects non-existent 24-hex ObjectId with VALIDATION_ERROR (400)', async () => {
      let threw = false;
      try {
        await validateCatalogQuery({ category: '000000000000000000000000' });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'VALIDATION_ERROR');
      }
      assert(threw, 'Should throw VALIDATION_ERROR for missing ObjectId');
    });

    await runTest('TEST-13', 'validateCatalogQuery rejects malformed category slug with VALIDATION_ERROR (400)', async () => {
      let threw = false;
      try {
        await validateCatalogQuery({ category: 'Invalid Slug!@#$' });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, 'VALIDATION_ERROR');
      }
      assert(threw, 'Should throw VALIDATION_ERROR for malformed slug');
    });

    await runTest('TEST-14', 'productService.getProducts resolves promise-based query transparently', async () => {
      const queryPromise = validateCatalogQuery({ category: 'footwear', limit: 4 });
      const result = await productService.getProducts(queryPromise);
      assert(Array.isArray(result.products), 'Should return products array');
      assert(result.products.length > 0, 'Should find products in footwear category');
      for (const p of result.products) {
        const treeStr = (p.categoryTree || []).map((c) => c.toString());
        assert(treeStr.includes(footwearCat._id.toString()), 'Product categoryTree must include footwear category ID');
      }
    });

  } finally {
    await mongoose.disconnect();
    console.log('\n MongoDB disconnected.\n');
  }

  console.log('================================================================');
  console.log('                 PHASE UI-3.1A TEST RESULTS SUMMARY             ');
  console.log('================================================================');
  console.table(results);

  const failed = results.filter((r) => r.status === 'FAIL');
  if (failed.length > 0) {
    console.error(`\n✖ ${failed.length} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\n✔ All ${results.length} Phase UI-3.1A Navigation & Redirect tests passed!`);
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
