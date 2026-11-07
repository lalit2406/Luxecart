/**
 * LuxeCart Phase UI-2: Product Card Polish & Data Integrity Verification Suite
 */

import assert from 'assert';

console.log('================================================================');
console.log('   LUXECART PHASE UI-2 PRODUCT CARD INTEGRITY TEST SUITE        ');
console.log('================================================================\n');

const results = [];

function runTest(testId, name, fn) {
  try {
    fn();
    results.push({ testId, name, status: 'PASS' });
    console.log(`✔ [PASS] [${testId}] ${name}`);
  } catch (err) {
    results.push({ testId, name, status: 'FAIL', error: err.message });
    console.error(`✖ [FAIL] [${testId}] ${name}`);
    console.error(`    ↳ ${err.message}`);
  }
}

// Emulate the ProductCard pricing, badge, and availability resolution logic
function resolveProductCardState(product) {
  if (!product) return null;

  const productId = product.id || product._id;
  const productUrl = product.slug ? `/products/${product.slug}` : (productId ? `/products/${productId}` : '/shop');

  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const rawImageUrl = primaryImage?.url || 'LUXE_PLACEHOLDER_IMAGE';

  const activeVariants = Array.isArray(product.variants)
    ? product.variants.filter((v) => v.isActive !== false)
    : [];

  let minPrice = 0;
  let minMrp = 0;

  if (activeVariants.length > 0) {
    const sortedVariants = [...activeVariants].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    const lowestPriceVariant = sortedVariants[0];
    minPrice = typeof lowestPriceVariant.price === 'number' && lowestPriceVariant.price >= 0 ? lowestPriceVariant.price : 0;
    minMrp = typeof lowestPriceVariant.mrp === 'number' && lowestPriceVariant.mrp >= 0
      ? lowestPriceVariant.mrp
      : (typeof product.priceSummary?.minMrp === 'number' && product.priceSummary.minMrp >= 0
          ? product.priceSummary.minMrp
          : minPrice);
  } else {
    minPrice =
      typeof product.priceSummary?.minPrice === 'number' && product.priceSummary.minPrice >= 0
        ? product.priceSummary.minPrice
        : 0;

    minMrp =
      typeof product.priceSummary?.minMrp === 'number' && product.priceSummary.minMrp >= 0
        ? product.priceSummary.minMrp
        : minPrice;
  }

  const discountPercent =
    minMrp > minPrice && minPrice > 0
      ? Math.round(((minMrp - minPrice) / minMrp) * 100)
      : 0;

  const hasValidDiscount = discountPercent > 0 && minMrp > minPrice && minPrice > 0;

  const hasStockFlag = typeof product.priceSummary?.hasStock === 'boolean'
    ? product.priceSummary.hasStock
    : (typeof product.priceSummary?.totalStock === 'number'
        ? product.priceSummary.totalStock > 0
        : (activeVariants.length > 0
            ? activeVariants.some((v) => (v.inventory?.stock ?? 0) > 0)
            : true));

  const isArchivedOrDraft = product.status && product.status !== 'ACTIVE';
  const isAvailable = hasStockFlag && !isArchivedOrDraft;

  const isNew = Boolean(product.isNewArrival);

  const hasValidRating =
    typeof product.ratings?.average === 'number' &&
    product.ratings.average > 0 &&
    product.ratings.average <= 5 &&
    typeof product.ratings?.count === 'number' &&
    product.ratings.count > 0;

  return {
    productId,
    productUrl,
    rawImageUrl,
    minPrice,
    minMrp,
    discountPercent,
    hasValidDiscount,
    isAvailable,
    isNew,
    hasValidRating,
  };
}

// TEST 1: Standard product with valid discount from priceSummary
runTest('TEST-1', 'Computes valid discount only when minMrp > minPrice && minPrice > 0', () => {
  const prod = {
    _id: 'prod1',
    name: 'Silk Slip Dress',
    slug: 'silk-slip-dress',
    priceSummary: { minPrice: 2000, minMrp: 2500, maxDiscountPercent: 20, hasStock: true },
    isNewArrival: true,
  };
  const state = resolveProductCardState(prod);
  assert.strictEqual(state.minPrice, 2000);
  assert.strictEqual(state.minMrp, 2500);
  assert.strictEqual(state.discountPercent, 20);
  assert.strictEqual(state.hasValidDiscount, true);
  assert.strictEqual(state.isAvailable, true);
  assert.strictEqual(state.isNew, true);
});

// TEST 2: Hides discount when MRP equals selling price
runTest('TEST-2', 'Hides discount badge and strikethrough when minMrp <= minPrice', () => {
  const prod = {
    _id: 'prod2',
    name: 'Classic Oxford Shirt',
    slug: 'classic-oxford-shirt',
    priceSummary: { minPrice: 3000, minMrp: 3000, maxDiscountPercent: 0, hasStock: true },
  };
  const state = resolveProductCardState(prod);
  assert.strictEqual(state.minPrice, 3000);
  assert.strictEqual(state.minMrp, 3000);
  assert.strictEqual(state.discountPercent, 0);
  assert.strictEqual(state.hasValidDiscount, false);
});

// TEST 3: Variant-level pricing precedence
runTest('TEST-3', 'Calculates variant-specific lowest price and matching comparable MRP', () => {
  const prod = {
    _id: 'prod3',
    name: 'Tailored Wool Trousers',
    slug: 'tailored-wool-trousers',
    variants: [
      { sku: 'T-S', price: 4000, mrp: 5000, isActive: true, inventory: { stock: 5 } },
      { sku: 'T-M', price: 3500, mrp: 4500, isActive: true, inventory: { stock: 2 } },
      { sku: 'T-L', price: 5000, mrp: 5000, isActive: false, inventory: { stock: 0 } },
    ],
    priceSummary: { minPrice: 3500, minMrp: 4500, hasStock: true },
  };
  const state = resolveProductCardState(prod);
  assert.strictEqual(state.minPrice, 3500);
  assert.strictEqual(state.minMrp, 4500);
  assert.strictEqual(state.discountPercent, 22); // round((4500 - 3500) / 4500 * 100) = 22%
  assert.strictEqual(state.hasValidDiscount, true);
  assert.strictEqual(state.isAvailable, true);
});

// TEST 4: Out of stock product detection
runTest('TEST-4', 'Flags out of stock when totalStock is 0 or hasStock is false', () => {
  const prod = {
    _id: 'prod4',
    name: 'Vanta Retro Runner',
    slug: 'vanta-retro-runner',
    priceSummary: { minPrice: 4299, minMrp: 5999, hasStock: false, totalStock: 0 },
    status: 'ACTIVE',
  };
  const state = resolveProductCardState(prod);
  assert.strictEqual(state.isAvailable, false);
});

// TEST 5: Draft or archived products are flagged unavailable
runTest('TEST-5', 'Draft or archived products are flagged unavailable even if stock flag is true', () => {
  const prod = {
    _id: 'prod5',
    name: 'Archived Trench Coat',
    slug: 'archived-trench-coat',
    priceSummary: { minPrice: 9999, minMrp: 12999, hasStock: true, totalStock: 10 },
    status: 'ARCHIVED',
  };
  const state = resolveProductCardState(prod);
  assert.strictEqual(state.isAvailable, false);
});

// TEST 6: Rating display validation
runTest('TEST-6', 'Shows ratings only when count > 0 and average > 0', () => {
  const withReviews = {
    _id: 'p6a',
    ratings: { average: 4.8, count: 12 },
  };
  const zeroReviews = {
    _id: 'p6b',
    ratings: { average: 0, count: 0 },
  };
  const missingReviews = {
    _id: 'p6c',
  };

  assert.strictEqual(resolveProductCardState(withReviews).hasValidRating, true);
  assert.strictEqual(resolveProductCardState(zeroReviews).hasValidRating, false);
  assert.strictEqual(resolveProductCardState(missingReviews).hasValidRating, false);
});

// TEST 7: Resilient ID and Wishlist mapping
runTest('TEST-7', 'Resolves ID properly whether id or _id is provided', () => {
  const prodIdOnly = { id: 'uuid-1234', slug: 'bag' };
  const prodUnderIdOnly = { _id: 'mongo-5678', slug: 'bag-2' };

  assert.strictEqual(resolveProductCardState(prodIdOnly).productId, 'uuid-1234');
  assert.strictEqual(resolveProductCardState(prodUnderIdOnly).productId, 'mongo-5678');
});

// TEST 8: Fallback image handling
runTest('TEST-8', 'Falls back to LUXE_PLACEHOLDER_IMAGE when images array is empty or missing', () => {
  const noImages = { _id: 'p8', name: 'No Image Product', images: [] };
  assert.strictEqual(resolveProductCardState(noImages).rawImageUrl, 'LUXE_PLACEHOLDER_IMAGE');
});

console.log('\n================================================================');
console.log('                 PHASE UI-2 TEST RESULTS SUMMARY                ');
console.log('================================================================');
console.table(results);

const failed = results.filter((r) => r.status === 'FAIL');
if (failed.length > 0) {
  console.error(`\n✖ ${failed.length} test(s) failed.`);
  process.exit(1);
} else {
  console.log(`\n✔ All ${results.length} Phase UI-2 Product Card tests passed!`);
  process.exit(0);
}
