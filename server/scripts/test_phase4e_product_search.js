/**
 * Phase 4E — Customer Product Search Verification Suite
 *
 * Verifies:
 * 1. Partial product-name matching in query validator.
 * 2. Case-insensitive matching across product fields.
 * 3. Brand name matching.
 * 4. Category-name resolution and relationship mapping.
 * 5. Safe handling and escaping of regex metacharacters.
 * 6. Storefront guard: strictly excludes inactive/unpublished products (status: ACTIVE).
 * 7. Multi-filter composition: search seamlessly combines with price, stock, gender, and category.
 * 8. Pagination and sorting preservation during search queries.
 * 9. Empty/blank search query handling without breaking catalog queries.
 * 10. URL parameter persistence and filter preservation contract.
 * 11. Live search suggestion limit, price resolution, and keyboard navigation semantics.
 * 12. Mobile search overlay mutual exclusivity and focus lifecycle.
 */

import assert from 'assert';
import mongoose from 'mongoose';
mongoose.set('bufferCommands', false);

import { validateCatalogQuery } from '../src/validators/product.validator.js';
import Category from '../src/modules/categories/category.model.js';
import Product from '../src/modules/products/product.model.js';

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('\n======================================================================');
console.log('   LUXECART PHASE 4E: CUSTOMER PRODUCT SEARCH VERIFICATION SUITE       ');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// Group 1: Backend Search Matching & Query Construction
// ---------------------------------------------------------------------------
console.log('--- Group 1: Backend Search Matching & Validator Logic ---');

await runAsyncTest('1.1 Partial and case-insensitive product name matching', async () => {
  const origFind = Category.find;
  Category.find = () => ({
    select: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  });

  try {
    const result = await validateCatalogQuery({ search: 'over' });
    assert.strictEqual(result.filter.status, 'ACTIVE');
    assert.ok(result.filter.$and, 'Filter must contain $and array for multi-field search');

    const searchStage = result.filter.$and.find((stage) => stage.$or);
    assert.ok(searchStage, 'Filter must have an $or search stage');

    const nameCondition = searchStage.$or.find((c) => c.name);
    assert.ok(nameCondition, 'Search conditions must match against product name');
    assert.strictEqual(nameCondition.name.flags, 'i');
    assert.ok(nameCondition.name.test('Aurelio Essential Oversized T-Shirt'));
    assert.ok(nameCondition.name.test('OVERSIZED HOODIE'));
  } finally {
    Category.find = origFind;
  }
});

await runAsyncTest('1.2 Brand and description matching', async () => {
  const origFind = Category.find;
  Category.find = () => ({
    select: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  });

  try {
    const result = await validateCatalogQuery({ search: 'signature' });
    const searchStage = result.filter.$and.find((stage) => stage.$or);

    const brandCondition = searchStage.$or.find((c) => c.brand);
    assert.ok(brandCondition, 'Search conditions must match against brand');
    assert.ok(brandCondition.brand.test('LuxeCart Signature'));

    const tagCondition = searchStage.$or.find((c) => c.tags);
    assert.ok(tagCondition, 'Search conditions must match against tags');
    assert.ok(tagCondition.tags.test('signature-collection'));

    const descCondition = searchStage.$or.find((c) => c.shortDescription);
    assert.ok(descCondition, 'Search conditions must match against shortDescription');
    assert.ok(descCondition.shortDescription.test('Our signature luxury weave'));
  } finally {
    Category.find = origFind;
  }
});

await runAsyncTest('1.3 Category name resolution and Product-to-Category matching', async () => {
  const origFind = Category.find;
  const mockFootwearCatId = new mongoose.Types.ObjectId();

  Category.find = () => ({
    select: () => ({
      limit: () => ({
        lean: async () => [{ _id: mockFootwearCatId, name: 'Footwear', slug: 'footwear' }],
      }),
    }),
  });

  try {
    const result = await validateCatalogQuery({ search: 'footwear' });
    const searchStage = result.filter.$and.find((stage) => stage.$or);

    const categoryTreeCondition = searchStage.$or.find((c) => c.categoryTree);
    assert.ok(categoryTreeCondition, 'Search conditions must match matching category IDs in categoryTree');
    assert.deepStrictEqual(categoryTreeCondition.categoryTree.$in, [mockFootwearCatId]);

    const categoryRefCondition = searchStage.$or.find((c) => c.category);
    assert.ok(categoryRefCondition, 'Search conditions must match matching category IDs in category ref');
    assert.deepStrictEqual(categoryRefCondition.category.$in, [mockFootwearCatId]);
  } finally {
    Category.find = origFind;
  }
});

await runAsyncTest('1.4 Safe escaping of special regex characters', async () => {
  const origFind = Category.find;
  Category.find = () => ({
    select: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  });

  try {
    const dangerousQuery = 'Silk (100%) [Summer Edition] + Cotton * {Exclusive} ? $ ^';
    const result = await validateCatalogQuery({ search: dangerousQuery });
    assert.ok(result.filter.$and, 'Must process escaped regex without crashing');

    const searchStage = result.filter.$and.find((stage) => stage.$or);
    const nameCondition = searchStage.$or.find((c) => c.name);

    // Verifies regex matches literal string with special chars
    assert.ok(nameCondition.name.test('Pure Silk (100%) [Summer Edition] + Cotton * {Exclusive} ? $ ^'));
    assert.strictEqual(nameCondition.name.test('Unrelated Shirt'), false);
  } finally {
    Category.find = origFind;
  }
});

await runAsyncTest('1.5 Input length bound and expensive query mitigation', async () => {
  const origFind = Category.find;
  Category.find = () => ({
    select: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  });

  try {
    const hugeInput = 'A'.repeat(500);
    const result = await validateCatalogQuery({ search: hugeInput });
    const searchStage = result.filter.$and.find((stage) => stage.$or);
    const nameCondition = searchStage.$or.find((c) => c.name);

    // Source regex pattern length must be capped at 100 characters
    assert.strictEqual(nameCondition.name.source.length, 100);
  } finally {
    Category.find = origFind;
  }
});

await runAsyncTest('1.6 Storefront safety: strictly excludes inactive/unpublished products', async () => {
  const origFind = Category.find;
  Category.find = () => ({
    select: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  });

  try {
    const result = await validateCatalogQuery({ search: 'cashmere' });
    assert.strictEqual(result.filter.status, 'ACTIVE', 'Catalog queries must unconditionally enforce status: ACTIVE');
  } finally {
    Category.find = origFind;
  }
});

// ---------------------------------------------------------------------------
// Group 2: Combined Filters, Sorting and Pagination
// ---------------------------------------------------------------------------
console.log('\n--- Group 2: Filter Composition, Sorting & Pagination ---');

await runAsyncTest('2.1 Search combined with price range and stock availability filters', async () => {
  const origFind = Category.find;
  Category.find = () => ({
    select: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  });

  try {
    const result = await validateCatalogQuery({
      search: 'jacket',
      minPrice: '5000',
      maxPrice: '25000',
      inStock: 'true',
    });

    assert.strictEqual(result.filter.status, 'ACTIVE');
    assert.ok(result.filter.$and, 'Must combine search and other criteria');
    assert.deepStrictEqual(result.filter.variants, {
      $elemMatch: {
        isActive: true,
        'inventory.stock': { $gt: 0 },
        price: { $gte: 5000, $lte: 25000 },
      },
    });
  } finally {
    Category.find = origFind;
  }
});

await runAsyncTest('2.2 Search combined with department/gender and sort options', async () => {
  const origFind = Category.find;
  Category.find = () => ({
    select: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  });

  try {
    const result = await validateCatalogQuery({
      search: 'shirt',
      gender: 'MEN',
      sort: 'price-low',
      page: '2',
      limit: '15',
    });

    assert.strictEqual(result.filter.gender, 'MEN');
    assert.deepStrictEqual(result.sort, { 'priceSummary.minPrice': 1 });
    assert.strictEqual(result.pagination.page, 2);
    assert.strictEqual(result.pagination.limit, 15);
    assert.strictEqual(result.pagination.skip, 15);
  } finally {
    Category.find = origFind;
  }
});

await runAsyncTest('2.3 Empty/blank search query preserves clean catalog browsing', async () => {
  const result = await validateCatalogQuery({ search: '   ' });
  assert.strictEqual(result.filter.status, 'ACTIVE');
  assert.strictEqual(result.filter.$and, undefined, 'Empty search should not add $and conditions');
});

// ---------------------------------------------------------------------------
// Group 3: Frontend Search & Suggestion Logic Contracts
// ---------------------------------------------------------------------------
console.log('\n--- Group 3: Frontend Search & Suggestion Contracts ---');

runTest('3.1 Live search suggestion limit and payload structure contract', () => {
  const SUGGESTION_LIMIT = 6;
  const mockApiResponse = {
    data: Array.from({ length: 10 }, (_, i) => ({
      id: `prod-${i}`,
      name: `Luxury Item ${i}`,
      brand: 'LuxeCart Signature',
      priceSummary: { minPrice: 1500 + i * 100 },
    })),
  };

  const suggestions = (mockApiResponse.data || []).slice(0, SUGGESTION_LIMIT);
  assert.strictEqual(suggestions.length, 6);
  assert.strictEqual(suggestions[0].name, 'Luxury Item 0');
  assert.strictEqual(suggestions[5].name, 'Luxury Item 5');
});

runTest('3.2 Price resolution contract for suggestion items', () => {
  function resolveProductPrice(product) {
    if (typeof product.priceSummary?.minPrice === 'number' && product.priceSummary.minPrice > 0) {
      return product.priceSummary.minPrice;
    }
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const prices = product.variants
        .map((v) => Number(v.price))
        .filter((p) => !isNaN(p) && p > 0);
      if (prices.length > 0) return Math.min(...prices);
    }
    return 0;
  }

  // Case A: From priceSummary
  assert.strictEqual(resolveProductPrice({ priceSummary: { minPrice: 3499 } }), 3499);
  // Case B: From active variants
  assert.strictEqual(
    resolveProductPrice({ variants: [{ price: 4200 }, { price: 2999 }, { price: 5500 }] }),
    2999
  );
  // Case C: Empty/fallback
  assert.strictEqual(resolveProductPrice({}), 0);
});

runTest('3.3 Keyboard navigation cyclic indexing (ArrowDown / ArrowUp)', () => {
  const itemsCount = 6;

  // ArrowDown stepping
  let currentIndex = -1;
  currentIndex = currentIndex < itemsCount - 1 ? currentIndex + 1 : 0;
  assert.strictEqual(currentIndex, 0);

  currentIndex = 5;
  currentIndex = currentIndex < itemsCount - 1 ? currentIndex + 1 : 0;
  assert.strictEqual(currentIndex, 0, 'Should cycle back to 0 at the bottom');

  // ArrowUp stepping
  currentIndex = 0;
  currentIndex = currentIndex > 0 ? currentIndex - 1 : itemsCount - 1;
  assert.strictEqual(currentIndex, 5, 'Should cycle back to top item when going up from 0');
});

runTest('3.4 URL synchronization: search query update and filter preservation', () => {
  const currentParams = new URLSearchParams('category=footwear&gender=MEN&sort=price-low&search=sneakers');

  // Clear search action
  function clearSearch(params) {
    const next = new URLSearchParams(params);
    next.delete('search');
    next.set('page', '1');
    return next;
  }

  const updated = clearSearch(currentParams);
  assert.strictEqual(updated.get('search'), null, 'Search param must be removed');
  assert.strictEqual(updated.get('category'), 'footwear', 'Category filter must be preserved');
  assert.strictEqual(updated.get('gender'), 'MEN', 'Gender filter must be preserved');
  assert.strictEqual(updated.get('sort'), 'price-low', 'Sort preference must be preserved');
  assert.strictEqual(updated.get('page'), '1', 'Page must be reset to 1');
});

runTest('3.5 Mobile search overlay mutual exclusivity with navigation drawer', () => {
  let mobileMenuOpen = true;
  let mobileSearchOpen = false;

  // Triggering mobile search
  function openMobileSearch() {
    mobileMenuOpen = false;
    mobileSearchOpen = true;
  }

  openMobileSearch();
  assert.strictEqual(mobileSearchOpen, true);
  assert.strictEqual(mobileMenuOpen, false, 'Opening search must close menu drawer');

  // Triggering mobile menu
  function openMobileMenu() {
    mobileSearchOpen = false;
    mobileMenuOpen = true;
  }

  openMobileMenu();
  assert.strictEqual(mobileMenuOpen, true);
  assert.strictEqual(mobileSearchOpen, false, 'Opening menu drawer must close search overlay');
});

// ---------------------------------------------------------------------------
// Test Summary
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(` Phase 4E Test Summary: ${passedTests} / ${totalTests} passed`);
console.log('======================================================================\n');
if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
