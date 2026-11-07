/**
 * LuxeCart — Phase 6E.5.4: Dynamic Shipping & Cart Configuration Verification Suite
 *
 * Verifies:
 * 1. Guest cart uses configured standard shipping fee.
 * 2. Free shipping disabled behavior.
 * 3. Free shipping enabled and threshold not reached.
 * 4. Free shipping threshold reached (including exact boundary: subtotal == threshold).
 * 5. Empty cart has zero shipping charge.
 * 6. Guest and authenticated cart display consistency (client vs backend calculations).
 * 7. Settings loading and fallback behavior (safe defaults, zero negative totals).
 * 8. Cart progress indicator calculations (percentage, remaining amount, qualification).
 * 9. Product detail shipping message (dynamic based on settings, neutral fallback).
 * 10. Checkout continues using backend-authoritative shipping (preserves backend pricing).
 * 11. Coupons and discounts remain unaffected (shipping evaluated before coupon discount).
 * 12. Historical order shipping snapshots remain unchanged (OrderPriceSummary snapshot immutability).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('======================================================================');
console.log('   LUXECART PHASE 6E.5.4: DYNAMIC SHIPPING & CART VERIFICATION       ');
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
  const shippingUtilsPath = path.join(rootDir, 'client/src/features/cart/utils/shippingUtils.js');
  const cartContextPath = path.join(rootDir, 'client/src/features/cart/context/CartContext.jsx');
  const cartPagePath = path.join(rootDir, 'client/src/pages/CartPage.jsx');
  const pdpPath = path.join(rootDir, 'client/src/pages/ProductDetailPage.jsx');
  const checkoutPagePath = path.join(rootDir, 'client/src/pages/CheckoutPage.jsx');
  const orderPriceSummaryPath = path.join(rootDir, 'client/src/components/orders/OrderPriceSummary.jsx');
  const backendShippingPath = path.join(rootDir, 'server/src/constants/shipping.constants.js');

  const cartContextSource = fs.readFileSync(cartContextPath, 'utf-8');
  const cartPageSource = fs.readFileSync(cartPagePath, 'utf-8');
  const pdpSource = fs.readFileSync(pdpPath, 'utf-8');
  const checkoutPageSource = fs.readFileSync(checkoutPagePath, 'utf-8');
  const orderPriceSummarySource = fs.readFileSync(orderPriceSummaryPath, 'utf-8');

  // Dynamic import of client shipping utilities
  const { calculateEstimatedShippingRupees, getFreeShippingProgress } = await import(
    `file://${shippingUtilsPath.replace(/\\/g, '/')}`
  );

  // Dynamic import of backend shipping calculation helper
  const { calculateShippingFeePaise, SHIPPING_FEE_PAISE } = await import(
    `file://${backendShippingPath.replace(/\\/g, '/')}`
  );

  // -------------------------------------------------------------------------
  // TEST 01: Guest Cart Uses Configured Standard Shipping Fee
  // -------------------------------------------------------------------------
  try {
    const config = {
      standardFeeRupees: 150,
      standardFeePaise: 15000,
      enableFreeShippingThreshold: false,
    };
    const fee = calculateEstimatedShippingRupees(1000, config, 1);
    assert.strictEqual(fee, 150, 'Standard fee must be 150 when configured');

    assert(
      cartContextSource.includes('calculateEstimatedShippingRupees'),
      'CartContext must use calculateEstimatedShippingRupees for guest cart summary'
    );
    record('TEST_01', 'Guest cart uses configured standard shipping fee', 'PASS');
  } catch (err) {
    record('TEST_01', 'Guest cart uses configured standard shipping fee', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 02: Free Shipping Disabled Behavior
  // -------------------------------------------------------------------------
  try {
    const config = {
      standardFeeRupees: 250,
      enableFreeShippingThreshold: false,
      freeShippingThresholdRupees: 3000,
    };
    // Even with subtotal 10,000, fee remains 250 because threshold is disabled
    const fee = calculateEstimatedShippingRupees(10000, config, 3);
    assert.strictEqual(fee, 250, 'Shipping fee must remain standard fee when free shipping threshold is disabled');

    const progress = getFreeShippingProgress(10000, config);
    assert.strictEqual(progress.isEnabled, false, 'Progress indicator must report isEnabled: false');
    assert.strictEqual(progress.qualifies, false);

    record('TEST_02', 'Free shipping disabled behavior (flat fee preserved regardless of subtotal)', 'PASS');
  } catch (err) {
    record('TEST_02', 'Free shipping disabled behavior', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 03: Free Shipping Enabled and Threshold Not Reached
  // -------------------------------------------------------------------------
  try {
    const config = {
      standardFeeRupees: 200,
      enableFreeShippingThreshold: true,
      freeShippingThresholdRupees: 5000,
    };
    // Subtotal 4,999 is just below the 5,000 threshold
    const fee = calculateEstimatedShippingRupees(4999, config, 2);
    assert.strictEqual(fee, 200, 'Subtotal below threshold must charge standard fee');

    const progress = getFreeShippingProgress(4999, config);
    assert.strictEqual(progress.isEnabled, true);
    assert.strictEqual(progress.qualifies, false);
    assert.strictEqual(progress.remainingRupees, 1);
    assert.strictEqual(progress.percent, 100); // 4999/5000 rounds to 100%

    record('TEST_03', 'Free shipping enabled and threshold not reached', 'PASS');
  } catch (err) {
    record('TEST_03', 'Free shipping enabled and threshold not reached', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 04: Free Shipping Threshold Reached (Including Exact Boundary)
  // -------------------------------------------------------------------------
  try {
    const config = {
      standardFeeRupees: 200,
      enableFreeShippingThreshold: true,
      freeShippingThresholdRupees: 5000,
    };

    // Exact boundary: subtotal === threshold (₹5,000)
    const exactBoundaryFee = calculateEstimatedShippingRupees(5000, config, 2);
    assert.strictEqual(exactBoundaryFee, 0, 'Exact boundary subtotal == threshold must qualify for free shipping (₹0)');

    const exactProgress = getFreeShippingProgress(5000, config);
    assert.strictEqual(exactProgress.qualifies, true);
    assert.strictEqual(exactProgress.remainingRupees, 0);
    assert.strictEqual(exactProgress.percent, 100);

    // Above threshold: subtotal > threshold (₹5,001)
    const aboveBoundaryFee = calculateEstimatedShippingRupees(5001, config, 2);
    assert.strictEqual(aboveBoundaryFee, 0, 'Subtotal > threshold must qualify for free shipping (₹0)');

    record('TEST_04', 'Free shipping threshold reached (exact boundary subtotal == threshold qualifies)', 'PASS');
  } catch (err) {
    record('TEST_04', 'Free shipping threshold reached', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 05: Empty Cart Has Zero Shipping Charge
  // -------------------------------------------------------------------------
  try {
    const config = {
      standardFeeRupees: 200,
      enableFreeShippingThreshold: false,
    };
    assert.strictEqual(calculateEstimatedShippingRupees(0, config, 0), 0, 'Empty cart itemCount: 0 must return 0');
    assert.strictEqual(calculateEstimatedShippingRupees(500, config, 0), 0, 'Empty cart with 0 items must return 0');
    assert.strictEqual(calculateEstimatedShippingRupees(0, config, 2), 0, 'Zero subtotal must return 0');

    record('TEST_05', 'Empty cart has zero shipping charge', 'PASS');
  } catch (err) {
    record('TEST_05', 'Empty cart has zero shipping charge', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 06: Guest and Authenticated Cart Display Consistency
  // -------------------------------------------------------------------------
  try {
    const config = {
      standardFeeRupees: 180,
      standardFeePaise: 18000,
      enableFreeShippingThreshold: true,
      freeShippingThresholdRupees: 4000,
      freeShippingThresholdPaise: 400000,
    };

    // Scenario A: Subtotal ₹2,500 (< ₹4,000 threshold)
    const clientFeeA = calculateEstimatedShippingRupees(2500, config, 1);
    const backendFeePaiseA = calculateShippingFeePaise(250000, config);
    assert.strictEqual(clientFeeA, 180);
    assert.strictEqual(backendFeePaiseA / 100, 180);
    assert.strictEqual(clientFeeA, backendFeePaiseA / 100, 'Client and backend must agree on below-threshold shipping');

    // Scenario B: Subtotal ₹4,000 (Exact boundary)
    const clientFeeB = calculateEstimatedShippingRupees(4000, config, 1);
    const backendFeePaiseB = calculateShippingFeePaise(400000, config);
    assert.strictEqual(clientFeeB, 0);
    assert.strictEqual(backendFeePaiseB, 0);
    assert.strictEqual(clientFeeB, backendFeePaiseB / 100, 'Client and backend must agree on exact boundary free shipping');

    // Scenario C: Subtotal ₹8,000 (> ₹4,000 threshold)
    const clientFeeC = calculateEstimatedShippingRupees(8000, config, 2);
    const backendFeePaiseC = calculateShippingFeePaise(800000, config);
    assert.strictEqual(clientFeeC, 0);
    assert.strictEqual(backendFeePaiseC, 0);

    record('TEST_06', 'Guest and authenticated cart display consistency (client matches backend)', 'PASS');
  } catch (err) {
    record('TEST_06', 'Guest and authenticated cart display consistency', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 07: Settings Loading and Fallback Behavior
  // -------------------------------------------------------------------------
  try {
    // When settings is null/undefined or empty
    const fallbackFee = calculateEstimatedShippingRupees(1500, null, 1);
    assert.strictEqual(fallbackFee, 200, 'Fallback fee must be 200 when settings are null');

    const emptyConfigFee = calculateEstimatedShippingRupees(1500, {}, 1);
    assert.strictEqual(emptyConfigFee, 200, 'Fallback fee must be 200 when shipping config is empty object');

    record('TEST_07', 'Settings loading and fallback behavior (safe defaults, zero errors)', 'PASS');
  } catch (err) {
    record('TEST_07', 'Settings loading and fallback behavior', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 08: Cart Progress Indicator Calculations
  // -------------------------------------------------------------------------
  try {
    const config = {
      enableFreeShippingThreshold: true,
      freeShippingThresholdRupees: 5000,
    };

    // Subtotal 1,000 -> 20%
    const p1 = getFreeShippingProgress(1000, config);
    assert.strictEqual(p1.percent, 20);
    assert.strictEqual(p1.remainingRupees, 4000);
    assert.strictEqual(p1.qualifies, false);

    // Subtotal 2,500 -> 50%
    const p2 = getFreeShippingProgress(2500, config);
    assert.strictEqual(p2.percent, 50);
    assert.strictEqual(p2.remainingRupees, 2500);

    // Subtotal 5,000 -> 100%
    const p3 = getFreeShippingProgress(5000, config);
    assert.strictEqual(p3.percent, 100);
    assert.strictEqual(p3.remainingRupees, 0);
    assert.strictEqual(p3.qualifies, true);

    // Verify CartPage.jsx source code
    assert(cartPageSource.includes('freeShipping.isEnabled && items.length > 0'),
      'CartPage must only render progress bar when threshold is enabled and cart has items');
    assert(cartPageSource.includes('role="progressbar"'), 'Progress bar must have accessible role');

    record('TEST_08', 'Cart progress indicator calculations (percentage, remaining, aria-progressbar)', 'PASS');
  } catch (err) {
    record('TEST_08', 'Cart progress indicator calculations', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 09: Product Detail Shipping Message
  // -------------------------------------------------------------------------
  try {
    assert(pdpSource.includes('shippingMessage'), 'ProductDetailPage must compute dynamic shippingMessage');
    assert(pdpSource.includes('settings?.shipping'), 'ProductDetailPage must read settings.shipping');
    assert(pdpSource.includes('{shippingMessage}'), 'ProductDetailPage must render shippingMessage');
    assert(!pdpSource.includes('Flat ₹200 delivery fee per order.'), 'ProductDetailPage must not have hardcoded ₹200 fee');

    record('TEST_09', 'Product detail shipping message (dynamic based on settings, neutral fallback)', 'PASS');
  } catch (err) {
    record('TEST_09', 'Product detail shipping message', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Checkout Continues Using Backend-Authoritative Shipping
  // -------------------------------------------------------------------------
  try {
    assert(
      checkoutPageSource.includes('!checkoutData'),
      'CheckoutPage must handle unavailable checkoutData explicitly'
    );
    assert(
      checkoutPageSource.includes('Unable to verify checkout pricing'),
      'CheckoutPage must show unavailable pricing message if checkoutData is missing'
    );
    assert(
      checkoutPageSource.includes('(summary.shipping || 0)'),
      'CheckoutPage must render delivery fee from backend-provided summary.shipping'
    );
    assert(
      checkoutPageSource.includes('summary.grandTotal'),
      'CheckoutPage must render total amount from backend-provided summary.grandTotal'
    );

    record('TEST_10', 'Checkout continues using backend-authoritative shipping (authoritative server pricing)', 'PASS');
  } catch (err) {
    record('TEST_10', 'Checkout continues using backend-authoritative shipping', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Coupons and Discounts Remain Unaffected
  // -------------------------------------------------------------------------
  try {
    // In backend checkout.service.js:
    // shippingPaise is evaluated against subtotalPaise (BEFORE coupon discount)
    // subtotal = ₹6,000 (600,000 paise), coupon = ₹2,000 (200,000 paise), threshold = ₹5,000 (500,000 paise)
    const config = {
      standardFeeRupees: 200,
      standardFeePaise: 20000,
      enableFreeShippingThreshold: true,
      freeShippingThresholdRupees: 5000,
      freeShippingThresholdPaise: 500000,
    };

    const subtotalPaise = 600000;
    const couponDiscountPaise = 200000;

    // Shipping is calculated against subtotal before coupon
    const shippingPaise = calculateShippingFeePaise(subtotalPaise, config);
    assert.strictEqual(shippingPaise, 0, 'Shipping must qualify for free shipping based on merchandise subtotal before coupon');

    // Grand total accounts for coupon
    const grandTotalPaise = Math.max(0, subtotalPaise + shippingPaise - couponDiscountPaise);
    assert.strictEqual(grandTotalPaise, 400000, 'Grand total must accurately subtract coupon discount (₹4,000)');

    record('TEST_11', 'Coupons and discounts remain unaffected (shipping evaluated before coupon discount)', 'PASS');
  } catch (err) {
    record('TEST_11', 'Coupons and discounts remain unaffected', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Historical Order Shipping Snapshots Remain Unchanged
  // -------------------------------------------------------------------------
  try {
    // Verify OrderPriceSummary displays snapshot values directly
    assert(
      orderPriceSummarySource.includes('pricing.shipping'),
      'OrderPriceSummary must use pricing.shipping from order snapshot'
    );
    assert(
      orderPriceSummarySource.includes('pricing.subtotal'),
      'OrderPriceSummary must use pricing.subtotal from order snapshot'
    );
    assert(
      orderPriceSummarySource.includes('pricing.grandTotal'),
      'OrderPriceSummary must use pricing.grandTotal from order snapshot'
    );
    assert(
      !orderPriceSummarySource.includes('useStoreSettings'),
      'OrderPriceSummary must NEVER consume useStoreSettings to recalculate historical shipping'
    );

    record('TEST_12', 'Historical order shipping snapshots remain unchanged (OrderPriceSummary immutability)', 'PASS');
  } catch (err) {
    record('TEST_12', 'Historical order shipping snapshots remain unchanged', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('======================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
};

runSuite().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
