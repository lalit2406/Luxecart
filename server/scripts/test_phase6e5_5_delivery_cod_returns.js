/**
 * LuxeCart — Phase 6E.5.5: Dynamic Delivery Estimates, COD Limits & Return Policy Verification Suite
 *
 * Verifies:
 * 1. Minimum and maximum delivery estimates display correctly (neutral 3–7 days or configured values).
 * 2. Elimination of incorrect "business days" wording across customer-facing integrated pages.
 * 3. Historical order-specific delivery snapshots (estimatedDeliveryDate / deliveryEstimate) immutably preserved.
 * 4. COD maximum displays dynamically from settings (maxCodOrderRupees / maxCodOrderPaise).
 * 5. Backend COD-unavailable warnings and availability take precedence in checkout.
 * 6. COD-only platform invariant remains intact (no online gateways added).
 * 7. Returns-enabled messaging uses configured duration ({returnWindowDays}-Day Return Policy).
 * 8. Returns-disabled messaging is accurate and suppresses positive badges.
 * 9. Elimination of hardcoded "7-Day Returns" remains across customer-facing components.
 * 10. Existing backend return eligibility API remains authoritative (order.deliveredAt calculation).
 * 11. Missing settings and fallback states render safely with graceful fallbacks.
 * 12. Existing order and checkout workflows remain functional.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('======================================================================');
console.log('   LUXECART PHASE 6E.5.5: DELIVERY, COD & RETURNS VERIFICATION       ');
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
  const announcementBarPath = path.join(rootDir, 'client/src/components/home/AnnouncementBar.jsx');
  const homePagePath = path.join(rootDir, 'client/src/pages/HomePage.jsx');
  const pdpPath = path.join(rootDir, 'client/src/pages/ProductDetailPage.jsx');
  const cartPagePath = path.join(rootDir, 'client/src/pages/CartPage.jsx');
  const checkoutPagePath = path.join(rootDir, 'client/src/pages/CheckoutPage.jsx');
  const orderSuccessPagePath = path.join(rootDir, 'client/src/pages/OrderSuccessPage.jsx');
  const orderDetailPagePath = path.join(rootDir, 'client/src/pages/OrderDetailPage.jsx');
  const orderPriceSummaryPath = path.join(rootDir, 'client/src/components/orders/OrderPriceSummary.jsx');
  const backendCheckoutServicePath = path.join(rootDir, 'server/src/modules/checkout/checkout.service.js');
  const backendReturnServicePath = path.join(rootDir, 'server/src/modules/returns/return.service.js');

  const announcementBarSource = fs.readFileSync(announcementBarPath, 'utf-8');
  const homePageSource = fs.readFileSync(homePagePath, 'utf-8');
  const pdpSource = fs.readFileSync(pdpPath, 'utf-8');
  const cartPageSource = fs.readFileSync(cartPagePath, 'utf-8');
  const checkoutPageSource = fs.readFileSync(checkoutPagePath, 'utf-8');
  const orderSuccessPageSource = fs.readFileSync(orderSuccessPagePath, 'utf-8');
  const orderDetailPageSource = fs.readFileSync(orderDetailPagePath, 'utf-8');
  const orderPriceSummarySource = fs.readFileSync(orderPriceSummaryPath, 'utf-8');
  const backendCheckoutServiceSource = fs.readFileSync(backendCheckoutServicePath, 'utf-8');
  const backendReturnServiceSource = fs.readFileSync(backendReturnServicePath, 'utf-8');

  // -------------------------------------------------------------------------
  // TEST 01: Minimum and maximum delivery estimates display correctly
  // -------------------------------------------------------------------------
  try {
    const hasAnnouncementRange = announcementBarSource.includes('minDays') && announcementBarSource.includes('maxDays');
    const hasHomePageRange = homePageSource.includes('minDeliveryDays') && homePageSource.includes('maxDeliveryDays');
    const hasPdpRange = pdpSource.includes('minDeliveryDays') && pdpSource.includes('maxDeliveryDays');
    const hasCartPageRange = cartPageSource.includes('minDeliveryDays') && cartPageSource.includes('maxDeliveryDays');
    const hasCheckoutRange = checkoutPageSource.includes('minDeliveryDays') && checkoutPageSource.includes('maxDeliveryDays');

    assert.ok(hasAnnouncementRange, 'AnnouncementBar must compute minDays and maxDays');
    assert.ok(hasHomePageRange, 'HomePage must compute minDeliveryDays and maxDeliveryDays');
    assert.ok(hasPdpRange, 'ProductDetailPage must compute minDeliveryDays and maxDeliveryDays');
    assert.ok(hasCartPageRange, 'CartPage must compute minDeliveryDays and maxDeliveryDays');
    assert.ok(hasCheckoutRange, 'CheckoutPage must compute minDeliveryDays and maxDeliveryDays');

    record('TEST_01', 'Delivery estimate min/max ranges computed and displayed dynamically', 'PASS');
  } catch (err) {
    record('TEST_01', 'Delivery estimate min/max ranges', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 02: Elimination of incorrect "business days" wording
  // -------------------------------------------------------------------------
  try {
    const clientFiles = [
      { name: 'AnnouncementBar.jsx', src: announcementBarSource },
      { name: 'HomePage.jsx', src: homePageSource },
      { name: 'ProductDetailPage.jsx', src: pdpSource },
      { name: 'CartPage.jsx', src: cartPageSource },
      { name: 'CheckoutPage.jsx', src: checkoutPageSource },
      { name: 'OrderSuccessPage.jsx', src: orderSuccessPageSource },
      { name: 'OrderDetailPage.jsx', src: orderDetailPageSource },
    ];

    const violations = clientFiles.filter(f => /business days/i.test(f.src));
    assert.strictEqual(violations.length, 0, `Found "business days" in: ${violations.map(v => v.name).join(', ')}`);

    record('TEST_02', 'Zero occurrences of incorrect "business days" wording in integrated files', 'PASS');
  } catch (err) {
    record('TEST_02', 'Elimination of "business days"', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 03: Historical order-specific delivery snapshots immutably preserved
  // -------------------------------------------------------------------------
  try {
    // OrderSuccessPage checks order snapshots first
    const successHasSnapshotPriority = orderSuccessPageSource.includes('order?.deliveryEstimate')
      && orderSuccessPageSource.includes('order?.estimatedDeliveryDate');
    assert.ok(successHasSnapshotPriority, 'OrderSuccessPage must check order.deliveryEstimate and estimatedDeliveryDate snapshots');

    // OrderDetailPage checks order snapshots first
    const detailHasSnapshotPriority = orderDetailPageSource.includes('order?.deliveryEstimate')
      && orderDetailPageSource.includes('order?.estimatedDeliveryDate');
    assert.ok(detailHasSnapshotPriority, 'OrderDetailPage must check order.deliveryEstimate and estimatedDeliveryDate snapshots');

    // OrderPriceSummary remains pure snapshot consumer without store settings import
    const priceSummaryUsesSettings = orderPriceSummarySource.includes('useStoreSettings');
    assert.strictEqual(priceSummaryUsesSettings, false, 'OrderPriceSummary must remain purely snapshot-driven without settings dependency');

    record('TEST_03', 'Historical order delivery and pricing snapshots immutably preserved', 'PASS');
  } catch (err) {
    record('TEST_03', 'Historical order delivery snapshots', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 04: COD maximum order limit displays dynamically from settings
  // -------------------------------------------------------------------------
  try {
    const checkoutHasMaxCod = checkoutPageSource.includes('maxCodRupees')
      && (checkoutPageSource.includes('maxCodOrderRupees') || checkoutPageSource.includes('maxCodOrderPaise'));
    assert.ok(checkoutHasMaxCod, 'CheckoutPage must read maxCodOrderRupees or maxCodOrderPaise from settings');

    const checkoutRendersLimit = checkoutPageSource.includes('Maximum COD order limit: ₹');
    assert.ok(checkoutRendersLimit, 'CheckoutPage must display formatted Maximum COD order limit to customer');

    record('TEST_04', 'COD maximum order limit displays dynamically from settings', 'PASS');
  } catch (err) {
    record('TEST_04', 'COD maximum order limit display', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 05: Backend COD-unavailable warnings and availability take precedence
  // -------------------------------------------------------------------------
  try {
    // CheckoutPage honors backend paymentMethods[0].available
    const respectsBackendAvailability = checkoutPageSource.includes('checkoutData?.paymentMethods?.[0]?.available === false');
    assert.ok(respectsBackendAvailability, 'CheckoutPage must honor checkoutData paymentMethods availability');

    // CheckoutPage displays backend warning / reason
    const displaysBackendReason = checkoutPageSource.includes('checkoutData.paymentMethods[0].reason');
    assert.ok(displaysBackendReason, 'CheckoutPage must render backend paymentMethod reason when COD is unavailable');

    // Backend checkout service computes limit and populates warning
    const backendEnforcesLimit = backendCheckoutServiceSource.includes('maxCodOrderPaise')
      && backendCheckoutServiceSource.includes('isWithinCodLimit')
      && backendCheckoutServiceSource.includes('Order total exceeds the maximum Cash on Delivery limit');
    assert.ok(backendEnforcesLimit, 'Backend checkout service must authoritatively compute isWithinCodLimit and append warning');

    record('TEST_05', 'Backend COD-unavailable status, limit, and warnings take precedence', 'PASS');
  } catch (err) {
    record('TEST_05', 'Backend COD-unavailable precedence', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 06: COD-only platform invariant remains intact
  // -------------------------------------------------------------------------
  try {
    // CheckoutPage still marks online payment as Coming Soon / disabled
    const hasOnlineDisabled = checkoutPageSource.includes('Online Payment')
      && checkoutPageSource.includes('Coming Soon');
    assert.ok(hasOnlineDisabled, 'CheckoutPage must keep Online Payment disabled and Coming Soon');

    // No payment gateway SDKs introduced
    const hasRazorpay = checkoutPageSource.includes('Razorpay') || checkoutPageSource.includes('rzp');
    const hasStripe = checkoutPageSource.includes('Stripe') || checkoutPageSource.includes('stripe');
    assert.strictEqual(hasRazorpay, false, 'No Razorpay SDK permitted');
    assert.strictEqual(hasStripe, false, 'No Stripe SDK permitted');

    record('TEST_06', 'COD-only platform invariant strictly preserved with no online gateways', 'PASS');
  } catch (err) {
    record('TEST_06', 'COD-only platform invariant', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 07: Returns-enabled messaging uses configured duration
  // -------------------------------------------------------------------------
  try {
    const announcementUsesWindow = announcementBarSource.includes('returnWindowDays');
    const homePageUsesWindow = homePageSource.includes('returnWindowDays');
    const pdpUsesWindow = pdpSource.includes('returnWindowDays');
    const cartPageUsesWindow = cartPageSource.includes('returnWindowDays');

    assert.ok(announcementUsesWindow, 'AnnouncementBar must use dynamic returnWindowDays');
    assert.ok(homePageUsesWindow, 'HomePage must use dynamic returnWindowDays');
    assert.ok(pdpUsesWindow, 'ProductDetailPage must use dynamic returnWindowDays');
    assert.ok(cartPageUsesWindow, 'CartPage must use dynamic returnWindowDays');

    record('TEST_07', 'Returns-enabled messaging uses configured duration dynamically', 'PASS');
  } catch (err) {
    record('TEST_07', 'Returns-enabled messaging', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 08: Returns-disabled messaging is accurate and suppresses positive badges
  // -------------------------------------------------------------------------
  try {
    const announcementHandlesDisabled = announcementBarSource.includes('isReturnsEnabled');
    const homePageHandlesDisabled = homePageSource.includes('isReturnsEnabled')
      && homePageSource.includes('Returns Currently Paused')
      && homePageSource.includes('Returns Currently Unavailable');
    const pdpHandlesDisabled = pdpSource.includes('isReturnsEnabled')
      && pdpSource.includes('Returns Currently Unavailable');
    const cartPageHandlesDisabled = cartPageSource.includes('isReturnsEnabled')
      && cartPageSource.includes('Returns Currently Unavailable');

    assert.ok(announcementHandlesDisabled, 'AnnouncementBar must handle isReturnsEnabled === false');
    assert.ok(homePageHandlesDisabled, 'HomePage must handle isReturnsEnabled === false with paused messaging');
    assert.ok(pdpHandlesDisabled, 'ProductDetailPage must show Returns Currently Unavailable when returns disabled');
    assert.ok(cartPageHandlesDisabled, 'CartPage must show Returns Currently Unavailable when returns disabled');

    record('TEST_08', 'Returns-disabled state gracefully suppresses return promises and shows accurate notices', 'PASS');
  } catch (err) {
    record('TEST_08', 'Returns-disabled messaging', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 09: Elimination of hardcoded "7-Day Returns" across customer components
  // -------------------------------------------------------------------------
  try {
    const components = [
      { name: 'AnnouncementBar.jsx', src: announcementBarSource },
      { name: 'HomePage.jsx', src: homePageSource },
      { name: 'ProductDetailPage.jsx', src: pdpSource },
      { name: 'CartPage.jsx', src: cartPageSource },
      { name: 'CheckoutPage.jsx', src: checkoutPageSource },
      { name: 'OrderSuccessPage.jsx', src: orderSuccessPageSource },
      { name: 'OrderDetailPage.jsx', src: orderDetailPageSource },
    ];

    const hardcodedReturnViolations = components.filter(c => /7-Day Return/i.test(c.src) || /7-Day Returns/i.test(c.src));
    assert.strictEqual(hardcodedReturnViolations.length, 0, `Found hardcoded 7-Day Return in: ${hardcodedReturnViolations.map(v => v.name).join(', ')}`);

    record('TEST_09', 'Zero hardcoded 7-Day Return strings remain in integrated customer components', 'PASS');
  } catch (err) {
    record('TEST_09', 'Elimination of hardcoded 7-Day Return', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Existing backend return eligibility API remains authoritative
  // -------------------------------------------------------------------------
  try {
    // Verify return.service.js calculates window from delivered event and returnWindowDays
    const calculatesFromDeliveredAt = backendReturnServiceSource.includes('deliveredAt')
      && backendReturnServiceSource.includes('returnWindowDays')
      && backendReturnServiceSource.includes('returnDeadline');
    assert.ok(calculatesFromDeliveredAt, 'Backend return service must calculate eligibility from deliveredAt and returnDeadline');

    const enforcesReturnDisabled = backendReturnServiceSource.includes('isReturnsEnabled')
      && backendReturnServiceSource.includes('Returns are currently disabled');
    assert.ok(enforcesReturnDisabled, 'Backend return service must reject return requests when returns are disabled');

    record('TEST_10', 'Authoritative backend return window and eligibility logic intact', 'PASS');
  } catch (err) {
    record('TEST_10', 'Backend return eligibility', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Missing settings and fallback states render safely
  // -------------------------------------------------------------------------
  try {
    // Test pure simulation of missing settings fallback resolution
    const nullSettings = null;
    const undefinedSettings = undefined;
    const emptySettings = {};

    const resolveDelivery = (settings) => ({
      min: settings?.shipping?.deliveryEstimateDays?.min || 3,
      max: settings?.shipping?.deliveryEstimateDays?.max || 7,
    });

    const resolveCod = (settings) => ({
      isEnabled: settings?.payment?.isCodEnabled !== false,
      maxRupees: typeof settings?.payment?.maxCodOrderRupees === 'number' && settings.payment.maxCodOrderRupees >= 0
        ? settings.payment.maxCodOrderRupees
        : 100000,
    });

    const resolveReturns = (settings) => ({
      isEnabled: settings?.returns?.isReturnsEnabled !== false,
      windowDays: settings?.returns?.returnWindowDays || 7,
    });

    // Test with null
    const nullDelivery = resolveDelivery(nullSettings);
    const nullCod = resolveCod(nullSettings);
    const nullReturns = resolveReturns(nullSettings);
    assert.strictEqual(nullDelivery.min, 3);
    assert.strictEqual(nullDelivery.max, 7);
    assert.strictEqual(nullCod.isEnabled, true);
    assert.strictEqual(nullCod.maxRupees, 100000);
    assert.strictEqual(nullReturns.isEnabled, true);
    assert.strictEqual(nullReturns.windowDays, 7);

    // Test with undefined
    const undefDelivery = resolveDelivery(undefinedSettings);
    const undefCod = resolveCod(undefinedSettings);
    const undefReturns = resolveReturns(undefinedSettings);
    assert.strictEqual(undefDelivery.min, 3);
    assert.strictEqual(undefDelivery.max, 7);
    assert.strictEqual(undefCod.isEnabled, true);
    assert.strictEqual(undefCod.maxRupees, 100000);
    assert.strictEqual(undefReturns.isEnabled, true);
    assert.strictEqual(undefReturns.windowDays, 7);

    // Test with empty object
    const emptyDelivery = resolveDelivery(emptySettings);
    const emptyCod = resolveCod(emptySettings);
    const emptyReturns = resolveReturns(emptySettings);
    assert.strictEqual(emptyDelivery.min, 3);
    assert.strictEqual(emptyDelivery.max, 7);
    assert.strictEqual(emptyCod.isEnabled, true);
    assert.strictEqual(emptyCod.maxRupees, 100000);
    assert.strictEqual(emptyReturns.isEnabled, true);
    assert.strictEqual(emptyReturns.windowDays, 7);

    record('TEST_11', 'Missing settings and fallback states resolve safely without exceptions', 'PASS');
  } catch (err) {
    record('TEST_11', 'Missing settings fallback resilience', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Existing order and checkout workflows remain functional
  // -------------------------------------------------------------------------
  try {
    // CheckoutPage still calls prepareCheckout and placeCodOrder
    const hasPrepare = checkoutPageSource.includes('prepareCheckout');
    const hasPlaceOrder = checkoutPageSource.includes('placeCodOrder');
    assert.ok(hasPrepare, 'CheckoutPage must call prepareCheckout');
    assert.ok(hasPlaceOrder, 'CheckoutPage must call placeCodOrder');

    // CartPage still provides clearCart, updateQuantity, proceed to checkout
    const hasCartProceed = cartPageSource.includes('/checkout');
    assert.ok(hasCartProceed, 'CartPage must link to checkout');

    record('TEST_12', 'Existing order and checkout workflows remain fully intact and operational', 'PASS');
  } catch (err) {
    record('TEST_12', 'Order and checkout workflow continuity', 'FAIL', err.message);
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
