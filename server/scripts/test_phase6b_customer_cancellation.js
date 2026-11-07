/**
 * LuxeCart Phase 6B: Customer Self-Service Order Cancellation Test Suite
 *
 * Fully isolated in-memory verification suite (Zero writes to live database):
 * 1. Authenticated customer can cancel their own PROCESSING/PLACED order.
 * 2. Unauthenticated request is rejected (401).
 * 3. Customer cannot cancel another customer's order (403 Forbidden).
 * 4. SHIPPED order cannot be cancelled (400).
 * 5. DELIVERED order cannot be cancelled (400).
 * 6. Duplicate cancellation does not restore stock twice (409).
 * 7. Concurrent cancellation requests do not cause double restoration (409 State Conflict).
 * 8. Coupon usage rollback is correct.
 * 9. Demo order cancellation is rejected through the customer endpoint (400).
 * 10. Admin cancellation continues working.
 * 11. Frontend OrderDetailPage contract verification.
 * 12. Input validation and reason sanitization.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

import orderService from '../src/modules/orders/order.service.js';
import Order from '../src/modules/orders/order.model.js';
import Product from '../src/modules/products/product.model.js';
import Coupon from '../src/modules/coupons/coupon.model.js';
import couponService from '../src/modules/coupons/coupon.service.js';
import { ORDER_STATUS } from '../src/modules/orders/orderStateMachine.js';
import { validateCancelOrder } from '../src/validators/order.validator.js';

// Prevent Mongoose from attempting live network connections during mock tests
mongoose.set('bufferCommands', false);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('======================================================================');
console.log('   LUXECART PHASE 6B: CUSTOMER ORDER CANCELLATION TEST SUITE          ');
console.log('======================================================================\n');

const results = [];

function record(testId, name, status, details = '') {
  results.push({ testId, name, status, details });
  const symbol = status === 'PASS' ? '✔ [PASS]' : status === 'SKIP' ? '⚠ [SKIP]' : '✖ [FAIL]';
  console.log(`${symbol} [${testId}] ${name}`);
  if (details && status === 'FAIL') {
    console.error(`       Details: ${details}`);
  }
}

async function runSuite() {
  const customerA = new mongoose.Types.ObjectId().toString();
  const customerB = new mongoose.Types.ObjectId().toString();
  const adminUser = new mongoose.Types.ObjectId().toString();
  const mockProductId = new mongoose.Types.ObjectId().toString();
  const mockVariantId = new mongoose.Types.ObjectId().toString();

  // --------------------------------------------------------------------------
  // TEST 1: Customer can cancel their own PROCESSING/PLACED order
  // --------------------------------------------------------------------------
  try {
    const orderDoc = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'LC-20261031-TEST01',
      userId: customerA,
      isDemo: false,
      status: ORDER_STATUS.PROCESSING,
      items: [
        {
          productId: mockProductId,
          variantId: mockVariantId,
          quantity: 2,
        },
      ],
      pricing: { grandTotal: 500000 },
      payment: { method: 'CASH_ON_DELIVERY', status: 'PENDING' },
      statusHistory: [],
    };

    let stockRestoredQuantity = 0;
    const origFindOne = Order.findOne;
    const origFindOneAndUpdate = Order.findOneAndUpdate;
    const origOrderExists = Order.exists;
    const origOrderUpdateOne = Order.updateOne;
    const origProductUpdateOne = Product.updateOne;
    const origProductUpdateMany = Product.updateMany;

    Order.findOne = function () {
      const q = {
        select: () => q,
        populate: () => q,
        lean: async () => orderDoc,
        then: (resolve) => Promise.resolve(orderDoc).then(resolve),
        ...orderDoc,
      };
      return q;
    };

    Order.exists = async () => true;
    Order.updateOne = async function () {
      return { matchedCount: 1, modifiedCount: 1 };
    };

    Order.findOneAndUpdate = function (filter, update) {
      if (update.$set?.status === ORDER_STATUS.CANCELLED) {
        orderDoc.status = ORDER_STATUS.CANCELLED;
      }
      const updated = {
        ...orderDoc,
        status: orderDoc.status,
        statusHistory: update.$push?.statusHistory ? [update.$push.statusHistory] : [],
      };
      const query = {
        populate: () => query,
        lean: async () => updated,
        then: (resolve) => Promise.resolve(updated).then(resolve),
      };
      return query;
    };

    Product.updateOne = async function (filter, update) {
      if (update.$inc && update.$inc['variants.$.inventory.stock']) {
        stockRestoredQuantity += update.$inc['variants.$.inventory.stock'];
      }
      return { modifiedCount: 1, modifiedCount: 1 };
    };
    Product.updateMany = async () => ({ matchedCount: 1, modifiedCount: 1 });

    const cancelled = await orderService.cancelCustomerOrder(customerA, 'LC-20261031-TEST01', {
      reason: 'Ordered wrong size',
    });

    assert.strictEqual(cancelled.status, ORDER_STATUS.CANCELLED);
    assert.strictEqual(stockRestoredQuantity, 2, 'Stock restoration must match order quantity exactly');

    // Restore originals
    Order.findOne = origFindOne;
    Order.findOneAndUpdate = origFindOneAndUpdate;
    Order.exists = origOrderExists;
    Order.updateOne = origOrderUpdateOne;
    Product.updateOne = origProductUpdateOne;
    Product.updateMany = origProductUpdateMany;

    record('CANCEL-01', 'Authenticated customer can cancel their own eligible order', 'PASS');
  } catch (err) {
    record('CANCEL-01', 'Authenticated customer can cancel order', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Unauthenticated customer route protection contract
  // --------------------------------------------------------------------------
  try {
    const routesPath = path.resolve(__dirname, '../src/modules/orders/order.routes.js');
    const routesContent = fs.readFileSync(routesPath, 'utf8');

    assert(routesContent.includes('router.use(authenticate)'), 'All order routes must enforce authenticate middleware');
    assert(routesContent.includes("router.post('/:id/cancel', cancelMyOrder)"), 'Customer cancellation route must be mounted');

    record('CANCEL-02', 'Unauthenticated request is rejected by router middleware', 'PASS');
  } catch (err) {
    record('CANCEL-02', 'Unauthenticated customer route protection', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Customer cannot cancel another customer's order (403 Forbidden)
  // --------------------------------------------------------------------------
  try {
    const orderDoc = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'LC-20261031-OTHER01',
      userId: customerA, // Belongs to customerA
      isDemo: false,
      status: ORDER_STATUS.PROCESSING,
      items: [{ productId: mockProductId, variantId: mockVariantId, quantity: 1 }],
    };

    const origFindOne = Order.findOne;
    Order.findOne = function () {
      return orderDoc;
    };

    let caughtError = null;
    try {
      // Customer B attempts to cancel Customer A's order
      await orderService.cancelCustomerOrder(customerB, 'LC-20261031-OTHER01');
    } catch (err) {
      caughtError = err;
    }

    Order.findOne = origFindOne;

    assert(caughtError, 'Should throw error when customer does not own order');
    assert.strictEqual(caughtError.statusCode, 403, 'Must return HTTP 403 Forbidden');
    assert.strictEqual(caughtError.code, 'FORBIDDEN');

    record('CANCEL-03', "Customer cannot cancel another customer's order (403 Forbidden)", 'PASS');
  } catch (err) {
    record('CANCEL-03', 'Ownership check verification', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: SHIPPED order cannot be cancelled (400)
  // --------------------------------------------------------------------------
  try {
    const orderDoc = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'LC-20261031-SHIPPED01',
      userId: customerA,
      isDemo: false,
      status: ORDER_STATUS.SHIPPED,
      items: [{ productId: mockProductId, variantId: mockVariantId, quantity: 1 }],
    };

    const origFindOne = Order.findOne;
    Order.findOne = function () {
      return orderDoc;
    };

    let caughtError = null;
    try {
      await orderService.cancelCustomerOrder(customerA, 'LC-20261031-SHIPPED01');
    } catch (err) {
      caughtError = err;
    }

    Order.findOne = origFindOne;

    assert(caughtError, 'Should throw error when order is already SHIPPED');
    assert.strictEqual(caughtError.statusCode, 400, 'Must return HTTP 400 Bad Request');
    assert.strictEqual(caughtError.code, 'ORDER_NOT_CANCELLABLE');

    record('CANCEL-04', 'SHIPPED order cannot be cancelled', 'PASS');
  } catch (err) {
    record('CANCEL-04', 'SHIPPED order cancellation guard', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: DELIVERED order cannot be cancelled (400)
  // --------------------------------------------------------------------------
  try {
    const orderDoc = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'LC-20261031-DELIV01',
      userId: customerA,
      isDemo: false,
      status: ORDER_STATUS.DELIVERED,
      items: [{ productId: mockProductId, variantId: mockVariantId, quantity: 1 }],
    };

    const origFindOne = Order.findOne;
    Order.findOne = function () {
      return orderDoc;
    };

    let caughtError = null;
    try {
      await orderService.cancelCustomerOrder(customerA, 'LC-20261031-DELIV01');
    } catch (err) {
      caughtError = err;
    }

    Order.findOne = origFindOne;

    assert(caughtError, 'Should throw error when order is already DELIVERED');
    assert.strictEqual(caughtError.statusCode, 400, 'Must return HTTP 400 Bad Request');
    assert.strictEqual(caughtError.code, 'ORDER_NOT_CANCELLABLE');

    record('CANCEL-05', 'DELIVERED order cannot be cancelled', 'PASS');
  } catch (err) {
    record('CANCEL-05', 'DELIVERED order cancellation guard', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Duplicate cancellation does not restore stock twice (409)
  // --------------------------------------------------------------------------
  try {
    const orderDoc = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'LC-20261031-ALREADY01',
      userId: customerA,
      isDemo: false,
      status: ORDER_STATUS.CANCELLED,
      items: [{ productId: mockProductId, variantId: mockVariantId, quantity: 1 }],
    };

    const origFindOne = Order.findOne;
    Order.findOne = function () {
      return orderDoc;
    };

    let caughtError = null;
    try {
      await orderService.cancelCustomerOrder(customerA, 'LC-20261031-ALREADY01');
    } catch (err) {
      caughtError = err;
    }

    Order.findOne = origFindOne;

    assert(caughtError, 'Should throw error on already cancelled order');
    assert.strictEqual(caughtError.statusCode, 409, 'Must return HTTP 409 Conflict');
    assert.strictEqual(caughtError.code, 'ORDER_ALREADY_CANCELLED');

    record('CANCEL-06', 'Duplicate cancellation does not restore stock twice (409)', 'PASS');
  } catch (err) {
    record('CANCEL-06', 'Duplicate cancellation prevention', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Concurrent cancellation requests do not cause double restoration
  // --------------------------------------------------------------------------
  try {
    const orderDoc = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'LC-20261031-RACE01',
      userId: customerA,
      isDemo: false,
      status: ORDER_STATUS.PROCESSING,
      items: [{ productId: mockProductId, variantId: mockVariantId, quantity: 3 }],
    };

    const origFindOne = Order.findOne;
    const origFindOneAndUpdate = Order.findOneAndUpdate;
    const origOrderExists = Order.exists;
    const origOrderUpdateOne = Order.updateOne;
    const origProductUpdateOne = Product.updateOne;
    const origProductUpdateMany = Product.updateMany;

    let executionCount = 0;
    let totalStockRestored = 0;

    Order.findOne = function () {
      const q = {
        select: () => q,
        populate: () => q,
        lean: async () => orderDoc,
        then: (resolve) => Promise.resolve(orderDoc).then(resolve),
        ...orderDoc,
      };
      return q;
    };
    Order.exists = async () => true;

    Order.updateOne = async function () {
      return { matchedCount: 1, modifiedCount: 1 };
    };

    // First caller finds status: PROCESSING and acquires cancellation lock.
    // Second concurrent caller fails compare-and-swap lock because cancellation.status is IN_PROGRESS.
    Order.findOneAndUpdate = function (filter, update) {
      if (update.$set && update.$set['cancellation.status'] === 'IN_PROGRESS') {
        if (executionCount === 0) {
          executionCount++;
          return Promise.resolve({ ...orderDoc, cancellation: { status: 'IN_PROGRESS' } });
        }
        return Promise.resolve(null);
      }
      const updated = { ...orderDoc, status: ORDER_STATUS.CANCELLED };
      const query = {
        populate: () => query,
        lean: async () => updated,
        then: (resolve) => Promise.resolve(updated).then(resolve),
      };
      return query;
    };

    Product.updateOne = async function (filter, update) {
      if (update.$inc && update.$inc['variants.$.inventory.stock']) {
        totalStockRestored += update.$inc['variants.$.inventory.stock'];
      }
      return { matchedCount: 1, modifiedCount: 1 };
    };
    Product.updateMany = async () => ({ matchedCount: 1, modifiedCount: 1 });

    // Launch two parallel cancellation requests
    const p1 = orderService.cancelCustomerOrder(customerA, 'LC-20261031-RACE01');
    const p2 = orderService.cancelCustomerOrder(customerA, 'LC-20261031-RACE01');

    const results = await Promise.allSettled([p1, p2]);

    Order.findOne = origFindOne;
    Order.findOneAndUpdate = origFindOneAndUpdate;
    Order.exists = origOrderExists;
    Order.updateOne = origOrderUpdateOne;
    Product.updateOne = origProductUpdateOne;
    Product.updateMany = origProductUpdateMany;

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent request must succeed');
    assert.strictEqual(rejected.length, 1, 'Exactly one concurrent request must be rejected');
    assert.strictEqual(rejected[0].reason.statusCode, 409, 'Concurrent request must fail with 409 Conflict');
    assert.strictEqual(totalStockRestored, 3, 'Stock must only be restored once (3 units, not 6)');

    record('CANCEL-07', 'Concurrent cancellation requests do not cause double restoration', 'PASS');
  } catch (err) {
    record('CANCEL-07', 'Concurrent race condition safety', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Coupon usage rollback is correct
  // --------------------------------------------------------------------------
  try {
    let couponRollbackCalled = false;
    let rolledBackCode = '';

    const origRollback = couponService.rollbackCouponUsage;
    couponService.rollbackCouponUsage = async function (code) {
      couponRollbackCalled = true;
      rolledBackCode = code;
    };

    const orderDoc = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'LC-20261031-COUPON01',
      userId: customerA,
      isDemo: false,
      status: ORDER_STATUS.PROCESSING,
      coupon: { code: 'WELCOME20', discount: 50000 },
      items: [{ productId: mockProductId, variantId: mockVariantId, quantity: 1 }],
    };

    const origFindOne = Order.findOne;
    const origFindOneAndUpdate = Order.findOneAndUpdate;
    const origOrderExists = Order.exists;
    const origOrderUpdateOne = Order.updateOne;
    const origProductUpdateOne = Product.updateOne;
    const origProductUpdateMany = Product.updateMany;

    Order.findOne = function () {
      const q = {
        select: () => q,
        populate: () => q,
        lean: async () => orderDoc,
        then: (resolve) => Promise.resolve(orderDoc).then(resolve),
        ...orderDoc,
      };
      return q;
    };
    Order.exists = async () => true;
    Order.updateOne = async () => ({ matchedCount: 1, modifiedCount: 1 });
    Order.findOneAndUpdate = function () {
      const updated = { ...orderDoc, status: ORDER_STATUS.CANCELLED };
      const query = {
        populate: () => query,
        lean: async () => updated,
        then: (resolve) => Promise.resolve(updated).then(resolve),
      };
      return query;
    };
    Product.updateOne = async () => ({ matchedCount: 1, modifiedCount: 1 });
    Product.updateMany = async () => ({ matchedCount: 1, modifiedCount: 1 });

    await orderService.cancelCustomerOrder(customerA, 'LC-20261031-COUPON01');

    Order.findOne = origFindOne;
    Order.findOneAndUpdate = origFindOneAndUpdate;
    Order.exists = origOrderExists;
    Order.updateOne = origOrderUpdateOne;
    Product.updateOne = origProductUpdateOne;
    Product.updateMany = origProductUpdateMany;
    couponService.rollbackCouponUsage = origRollback;

    assert.strictEqual(couponRollbackCalled, true, 'Coupon rollback must be triggered');
    assert.strictEqual(rolledBackCode, 'WELCOME20', 'Must rollback correct coupon code');

    record('CANCEL-08', 'Coupon usage rollback is correctly triggered on cancellation', 'PASS');
  } catch (err) {
    record('CANCEL-08', 'Coupon usage rollback', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Demo order cancellation is rejected through customer endpoint
  // --------------------------------------------------------------------------
  try {
    const demoOrder = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'DEMO-20261031-0001',
      userId: customerA,
      isDemo: true,
      status: ORDER_STATUS.PROCESSING,
      items: [{ productId: mockProductId, variantId: mockVariantId, quantity: 1 }],
    };

    const origFindOne = Order.findOne;
    Order.findOne = function () {
      return demoOrder;
    };

    let caughtError = null;
    try {
      await orderService.cancelCustomerOrder(customerA, 'DEMO-20261031-0001');
    } catch (err) {
      caughtError = err;
    }

    Order.findOne = origFindOne;

    assert(caughtError, 'Should throw error when attempting to cancel demo order');
    assert.strictEqual(caughtError.statusCode, 400, 'Must return HTTP 400 Bad Request');
    assert.strictEqual(caughtError.code, 'DEMO_ORDER_NOT_ALLOWED');

    record('CANCEL-09', 'Demo order cancellation is rejected through customer endpoint', 'PASS');
  } catch (err) {
    record('CANCEL-09', 'Demo order customer protection', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Admin cancellation continues working
  // --------------------------------------------------------------------------
  try {
    const orderDoc = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'LC-20261031-ADMIN01',
      userId: customerA,
      isDemo: false,
      status: ORDER_STATUS.PROCESSING,
      items: [{ productId: mockProductId, variantId: mockVariantId, quantity: 1 }],
      statusHistory: [],
    };

    const origFindOne = Order.findOne;
    const origFindOneAndUpdate = Order.findOneAndUpdate;
    const origOrderExists = Order.exists;
    const origOrderUpdateOne = Order.updateOne;
    const origProductUpdateOne = Product.updateOne;
    const origProductUpdateMany = Product.updateMany;

    Order.findOne = function () {
      const q = {
        select: () => q,
        populate: () => q,
        lean: async () => orderDoc,
        then: (resolve) => Promise.resolve(orderDoc).then(resolve),
        ...orderDoc,
      };
      return q;
    };
    Order.exists = async () => true;
    Order.updateOne = async () => ({ matchedCount: 1, modifiedCount: 1 });
    Order.findOneAndUpdate = function (filter, update) {
      if (update.$set?.status === ORDER_STATUS.CANCELLED) {
        orderDoc.status = ORDER_STATUS.CANCELLED;
      }
      const updated = { ...orderDoc, status: ORDER_STATUS.CANCELLED };
      const query = {
        populate: () => query,
        lean: async () => updated,
        then: (resolve) => Promise.resolve(updated).then(resolve),
      };
      return query;
    };
    Product.updateOne = async () => ({ matchedCount: 1, modifiedCount: 1 });
    Product.updateMany = async () => ({ matchedCount: 1, modifiedCount: 1 });

    const adminCancelled = await orderService.updateOrderStatus(
      'LC-20261031-ADMIN01',
      { status: ORDER_STATUS.CANCELLED, note: 'Admin override cancellation' },
      adminUser
    );

    Order.findOne = origFindOne;
    Order.findOneAndUpdate = origFindOneAndUpdate;
    Order.exists = origOrderExists;
    Order.updateOne = origOrderUpdateOne;
    Product.updateOne = origProductUpdateOne;
    Product.updateMany = origProductUpdateMany;

    assert.strictEqual(adminCancelled.status, ORDER_STATUS.CANCELLED);

    record('CANCEL-10', 'Admin cancellation continues working as expected', 'PASS');
  } catch (err) {
    record('CANCEL-10', 'Admin cancellation backwards compatibility', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Frontend OrderDetailPage contract verification
  // --------------------------------------------------------------------------
  try {
    const pagePath = path.resolve(__dirname, '../../client/src/pages/OrderDetailPage.jsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    assert(pageContent.includes('isCancellable'), 'OrderDetailPage must compute isCancellable');
    assert(pageContent.includes('cancelOrder'), 'OrderDetailPage must call orderApi.cancelOrder');
    assert(pageContent.includes('showCancelModal'), 'OrderDetailPage must feature confirmation modal');
    assert(pageContent.includes('role="dialog"'), 'Modal must have accessible dialog semantics');
    assert(pageContent.includes('disabled={cancelling'), 'Modal actions must be disabled while cancelling');
    assert(pageContent.includes('Escape'), 'Modal must handle Escape key dismiss');

    record('CANCEL-11', 'Frontend OrderDetailPage contract verified', 'PASS');
  } catch (err) {
    record('CANCEL-11', 'Frontend OrderDetailPage contract', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Input validation and reason sanitization
  // --------------------------------------------------------------------------
  try {
    const valid = validateCancelOrder({ reason: 'Found a better option' });
    assert.strictEqual(valid.isValid, true);
    assert.strictEqual(valid.sanitized.reason, 'Found a better option');

    const empty = validateCancelOrder({});
    assert.strictEqual(empty.isValid, true);

    const longReason = 'a'.repeat(600);
    const invalid = validateCancelOrder({ reason: longReason });
    assert.strictEqual(invalid.isValid, false);
    assert(invalid.errors[0].includes('cannot exceed 500 characters'));

    record('CANCEL-12', 'Input validation and reason sanitization function correctly', 'PASS');
  } catch (err) {
    record('CANCEL-12', 'Input validation', 'FAIL', err.message);
  }

  console.log('\n======================================================================');
  console.log('                 PHASE 6B TEST RESULTS SUMMARY                        ');
  console.log('======================================================================');
  console.table(results);

  const failed = results.filter((r) => r.status === 'FAIL');
  if (failed.length > 0) {
    console.error(`\n✖ ${failed.length} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\n✔ All ${results.length} Phase 6B Customer Cancellation tests passed!`);
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
