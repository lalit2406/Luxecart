/**
 * LuxeCart Phase 3B Test Suite: Delivery Estimate UI (State-Aware Implementation)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  getDeliveryEstimateMessage,
  getConfirmedEvent,
  getFormattedConfirmedDate,
} from '../../client/src/features/orders/constants/orderStatus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('   LUXECART PHASE 3B DELIVERY ESTIMATE VERIFICATION SUITE       ');
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
  const checkoutPagePath = path.resolve(__dirname, '../../client/src/pages/CheckoutPage.jsx');
  const checkoutPageCode = fs.readFileSync(checkoutPagePath, 'utf8');

  const orderSuccessPagePath = path.resolve(__dirname, '../../client/src/pages/OrderSuccessPage.jsx');
  const orderSuccessPageCode = fs.readFileSync(orderSuccessPagePath, 'utf8');

  const orderTimelinePath = path.resolve(__dirname, '../../client/src/components/orders/OrderTimeline.jsx');
  const orderTimelineCode = fs.readFileSync(orderTimelinePath, 'utf8');

  const orderDetailPagePath = path.resolve(__dirname, '../../client/src/pages/OrderDetailPage.jsx');
  const orderDetailPageCode = fs.readFileSync(orderDetailPagePath, 'utf8');

  const adminOrderDetailPagePath = path.resolve(__dirname, '../../client/src/pages/admin/AdminOrderDetailPage.jsx');
  const adminOrderDetailPageCode = fs.readFileSync(adminOrderDetailPagePath, 'utf8');

  // --------------------------------------------------------------------------
  // TEST 1: Checkout estimate wording
  // --------------------------------------------------------------------------
  await runTest('EST-01', 'Checkout page displays concise delivery estimate notice', () => {
    assert.match(
      checkoutPageCode,
      /Estimated delivery within 7 business days after order confirmation\./,
      'CheckoutPage must display approved relative estimate wording'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 2: Order success shows “Order Placed,” not premature confirmation
  // --------------------------------------------------------------------------
  await runTest('EST-02', 'Order success page shows "Order Placed" and received notice', () => {
    // Must NOT have static "Order Confirmed" badge for newly placed orders
    assert.doesNotMatch(
      orderSuccessPageCode,
      /<span[^>]*>\s*Order Confirmed\s*<\/span>/,
      'OrderSuccessPage must not hardcode "Order Confirmed"'
    );

    // Must show conditional Order Placed
    assert.match(
      orderSuccessPageCode,
      /order\.status && order\.status !== 'PLACED'[\s\S]*?'Order Confirmed'\s*:\s*'Order Placed'/,
      'OrderSuccessPage must default to "Order Placed" when order is in PLACED status'
    );

    // Must show exact approved notice
    assert.match(
      orderSuccessPageCode,
      /Your order has been received\.\s*Estimated delivery is within 7 business days after order confirmation\./,
      'OrderSuccessPage must display exact approved receipt notice'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 3: PLACED order displays the awaiting-confirmation message
  // --------------------------------------------------------------------------
  await runTest('EST-03', 'PLACED status returns exact awaiting-confirmation message', () => {
    const msg = getDeliveryEstimateMessage('PLACED');
    assert.strictEqual(
      msg,
      'Awaiting store confirmation. Estimated delivery is within 7 business days after order confirmation.'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 4: CONFIRMED and PROCESSING display appropriate estimate
  // --------------------------------------------------------------------------
  await runTest('EST-04', 'CONFIRMED and PROCESSING return exact state-aware estimates', () => {
    const confirmedMsg = getDeliveryEstimateMessage('CONFIRMED');
    assert.strictEqual(
      confirmedMsg,
      'Order confirmed. Estimated delivery within 7 business days after confirmation.'
    );

    const processingMsg = getDeliveryEstimateMessage('PROCESSING');
    assert.strictEqual(
      processingMsg,
      'Your order is being prepared. Estimated delivery within 7 business days after confirmation.'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 5: SHIPPED displays dispatch wording without promising an arrival date
  // --------------------------------------------------------------------------
  await runTest('EST-05', 'SHIPPED status returns dispatch progress wording', () => {
    const msg = getDeliveryEstimateMessage('SHIPPED');
    assert.strictEqual(
      msg,
      'Your order has been dispatched. Check available order updates for delivery progress.'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 6: DELIVERED displays delivered wording without a future estimate
  // --------------------------------------------------------------------------
  await runTest('EST-06', 'DELIVERED status returns delivered confirmation without future estimate', () => {
    const msg = getDeliveryEstimateMessage('DELIVERED');
    assert.strictEqual(msg, 'Your order has been delivered.');
  });

  // --------------------------------------------------------------------------
  // TEST 7: CANCELLED suppresses the delivery estimate
  // --------------------------------------------------------------------------
  await runTest('EST-07', 'CANCELLED status returns cancellation notice and timeline suppresses estimate', () => {
    const msg = getDeliveryEstimateMessage('CANCELLED');
    assert.strictEqual(msg, 'Your order has been cancelled.');

    // In OrderTimeline, if cancelled, early return prevents delivery notice render
    assert.match(
      orderTimelineCode,
      /if\s*\(\s*isCancelled\s*\)\s*\{[\s\S]*?Your order has been cancelled\.[\s\S]*?return\s*\(/,
      'OrderTimeline must short-circuit and render cancelled card without delivery estimate'
    );
  });

  // --------------------------------------------------------------------------
  // TEST 8: Missing or malformed statusHistory does not crash or fabricate date
  // --------------------------------------------------------------------------
  await runTest('EST-08', 'Missing, null, or malformed history safely returns null without crash or date fabrication', () => {
    assert.strictEqual(getConfirmedEvent(null), null);
    assert.strictEqual(getConfirmedEvent(undefined), null);
    assert.strictEqual(getConfirmedEvent('not-an-array'), null);
    assert.strictEqual(getConfirmedEvent([]), null);
    assert.strictEqual(getConfirmedEvent([{ status: 'PLACED', changedAt: new Date() }]), null);

    // Malformed Date
    assert.strictEqual(
      getFormattedConfirmedDate([{ status: 'CONFIRMED', changedAt: 'invalid-date-string' }]),
      null
    );

    // Valid Date extraction
    const testDate = new Date('2026-10-27T10:00:00Z');
    const validHistory = [
      { status: 'PLACED', changedAt: new Date('2026-10-26T09:00:00Z') },
      { status: 'CONFIRMED', changedAt: testDate },
    ];
    const event = getConfirmedEvent(validHistory);
    assert.ok(event);
    assert.strictEqual(event.status, 'CONFIRMED');
    const formatted = getFormattedConfirmedDate(validHistory);
    assert.ok(typeof formatted === 'string' && formatted.length > 0);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Customer and admin views use consistent status-aware wording
  // --------------------------------------------------------------------------
  await runTest('EST-09', 'Customer and admin views use shared status-aware constants and differentiate dates', () => {
    assert.match(
      orderTimelineCode,
      /getDeliveryEstimateMessage/,
      'OrderTimeline must use getDeliveryEstimateMessage'
    );
    assert.match(
      adminOrderDetailPageCode,
      /getDeliveryEstimateMessage/,
      'AdminOrderDetailPage must use getDeliveryEstimateMessage'
    );

    assert.match(
      adminOrderDetailPageCode,
      /Customer Delivery Expectation:/,
      'AdminOrderDetailPage must explicitly show customer delivery expectation'
    );
    assert.match(
      adminOrderDetailPageCode,
      /Order placed on/,
      'AdminOrderDetailPage must clearly distinguish order placement date'
    );
  });

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('   PHASE 3B TEST RESULTS SUMMARY                                ');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
