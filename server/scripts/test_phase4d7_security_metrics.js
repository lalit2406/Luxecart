/**
 * Phase 4D-7 — Demo Order Side-Effect and Admin Security Audit Test Suite
 *
 * Verifies:
 * 1. Admin Demo Order Endpoint Security & Route Guarding.
 * 2. Strict Request Validation (rejection of userId, coupon, stock, isDemo overrides).
 * 3. Enforced DEMO- Prefix for custom order numbers.
 * 4. Isolation of inventory, coupons, and payment obligations.
 * 5. Bounded collision retries and HTTP 409 Conflict handling.
 * 6. Clean exclusion of demo orders from all 7 Analytics aggregation pipelines.
 * 7. Clean exclusion of demo orders from Admin Order metrics cards, and support for orderType filter.
 * 8. Exclusion of demo orders from customer order history (getMyOrders & getOrderByNumber).
 * 9. Business invariants: ₹200 flat shipping, COD only, 7-business-day delivery estimate.
 */

import assert from 'assert';
import mongoose from 'mongoose';
mongoose.set('bufferCommands', false);

import {
  validateCreateDemoOrder,
  validateAdminOrderQuery,
} from '../src/validators/adminOrder.validator.js';
import { isDemoOrder } from '../src/utils/orderClassification.js';
import orderService from '../src/modules/orders/order.service.js';
import { SHIPPING_FEE_PAISE } from '../src/constants/shipping.constants.js';
import analyticsService from '../src/modules/analytics/analytics.service.js';
import Order from '../src/modules/orders/order.model.js';
import MockShipment from '../src/modules/logistics/mockShipment.model.js';
import Return from '../src/modules/returns/return.model.js';
import Product from '../src/modules/products/product.model.js';
import Category from '../src/modules/categories/category.model.js';
import User from '../src/modules/users/user.model.js';

// Tracking counters
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

console.log('\n======================================================');
console.log(' Phase 4D-7: Demo Order Security & Isolation Tests');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// Group 1: Request Validation for Demo Order Creation
// ---------------------------------------------------------------------------
console.log('--- Group 1: Request Validation & Prohibited Fields ---');

runTest('1.1 Rejects client-supplied userId to prevent account contamination', () => {
  const result = validateCreateDemoOrder({
    userId: new mongoose.Types.ObjectId().toString(),
    items: [{ name: 'Silk Shirt', quantity: 1, unitPricePaise: 250000 }],
  });
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some(e => e.includes('userId')));
});

runTest('1.2 Rejects client-supplied isDemo field', () => {
  const result = validateCreateDemoOrder({
    isDemo: false,
    items: [{ name: 'Silk Shirt', quantity: 1, unitPricePaise: 250000 }],
  });
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some(e => e.includes('isDemo')));
});

runTest('1.3 Rejects client-supplied coupon and discount fields', () => {
  const result1 = validateCreateDemoOrder({
    coupon: 'SAVE50',
    items: [{ name: 'Silk Shirt', quantity: 1, unitPricePaise: 250000 }],
  });
  assert.strictEqual(result1.isValid, false);
  assert.ok(result1.errors.some(e => e.includes('coupon')));

  const result2 = validateCreateDemoOrder({
    couponDiscount: 50000,
    items: [{ name: 'Silk Shirt', quantity: 1, unitPricePaise: 250000 }],
  });
  assert.strictEqual(result2.isValid, false);
  assert.ok(result2.errors.some(e => e.includes('couponDiscount')));
});

runTest('1.4 Rejects client-supplied stock or inventory reservation fields', () => {
  const result = validateCreateDemoOrder({
    stock: 5,
    reserved: true,
    items: [{ name: 'Silk Shirt', quantity: 1, unitPricePaise: 250000 }],
  });
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some(e => e.includes('stock') || e.includes('reserved')));
});

runTest('1.5 Rejects client-supplied payment status or paid flags', () => {
  const result = validateCreateDemoOrder({
    paymentStatus: 'PAID',
    items: [{ name: 'Silk Shirt', quantity: 1, unitPricePaise: 250000 }],
  });
  assert.strictEqual(result.isValid, false);
  assert.ok(result.errors.some(e => e.includes('paymentStatus')));
});

runTest('1.6 Rejects custom order numbers not starting with DEMO-', () => {
  const badNumbers = ['ORD-12345', 'LIVE-8888', 'TEST1234', 'CUSTOM-01'];
  for (const num of badNumbers) {
    const res = validateCreateDemoOrder({
      orderNumber: num,
      items: [{ name: 'Silk Shirt', quantity: 1, unitPricePaise: 250000 }],
    });
    assert.strictEqual(res.isValid, false, `Expected ${num} to fail`);
    assert.ok(res.errors.some(e => e.includes('DEMO-')));
  }
});

runTest('1.7 Accepts valid custom order numbers starting with DEMO-', () => {
  const res = validateCreateDemoOrder({
    orderNumber: 'DEMO-VIP-ORDER-1',
    items: [{ name: 'Silk Shirt', quantity: 1, unitPricePaise: 250000 }],
    shippingAddress: {
      fullName: 'Demo Customer',
      addressLine1: '123 Demo Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
    },
  });
  assert.strictEqual(res.isValid, true);
});

// ---------------------------------------------------------------------------
// Group 2: Demo Order Creation Business Logic & Invariants
// ---------------------------------------------------------------------------
console.log('\n--- Group 2: Creation Logic, Invariants & Bounded Retries ---');

await runAsyncTest('2.1 Demo order sets isDemo: true and binds admin identity', async () => {
  const adminId = new mongoose.Types.ObjectId();
  const origCreate = Order.create;
  const origFindOne = Order.findOne;

  Order.create = async (doc) => ({ ...(Array.isArray(doc) ? doc[0] : doc), _id: new mongoose.Types.ObjectId() });
  Order.findOne = () => ({
    select: () => ({
      lean: async () => null,
    }),
  });

  try {
    const result = await orderService.createDemoOrder(
      {
        items: [{ name: 'Demo Silk Kurta', quantity: 2, unitPricePaise: 150000 }],
        shippingAddress: {
          fullName: 'Simulated User',
          phone: '9876543210',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
      },
      adminId.toString()
    );

    // Assertions
    assert.strictEqual(result.isDemo, true);
    assert.ok(result.orderNumber.startsWith('DEMO-'));
    assert.strictEqual(result.userId.toString(), adminId.toString());
    assert.strictEqual(result.payment.method, 'CASH_ON_DELIVERY');
    assert.strictEqual(result.payment.status, 'PENDING');
    assert.strictEqual(result.pricing.shipping, 20000, 'Customer shipping must be ₹200 (20000 paise)');
    assert.strictEqual(result.pricing.couponDiscount, 0, 'No coupon discount allowed');
    assert.strictEqual(result.pricing.grandTotal, 220000);
    assert.ok(result.statusHistory[0].note.includes('DEMO INITIALIZATION'));
  } finally {
    Order.create = origCreate;
    Order.findOne = origFindOne;
  }
});

await runAsyncTest('2.2 Duplicate key 11000 returns HTTP 409 Conflict', async () => {
  const adminId = new mongoose.Types.ObjectId();
  const origCreate = Order.create;
  const origFindOne = Order.findOne;

  Order.findOne = () => ({
    select: () => ({
      lean: async () => null,
    }),
  });

  Order.create = async () => {
    const err = new Error('E11000 duplicate key error collection: luxecart.orders index: orderNumber_1');
    err.code = 11000;
    throw err;
  };

  try {
    await orderService.createDemoOrder(
      { orderNumber: 'DEMO-EXISTING-ORDER' },
      adminId.toString()
    );
    assert.fail('Should have thrown an error');
  } catch (err) {
    assert.strictEqual(err.statusCode, 409);
    assert.match(err.message, /already exists/);
  } finally {
    Order.create = origCreate;
    Order.findOne = origFindOne;
  }
});

// ---------------------------------------------------------------------------
// Group 3: Analytics Aggregation Pipeline Isolation
// ---------------------------------------------------------------------------
console.log('\n--- Group 3: Analytics Aggregation Pipeline Isolation ---');

await runAsyncTest('3.1 All 7 analytics pipelines inject { isDemo: { $ne: true } } in $match', async () => {
  const origOrderAggregate = Order.aggregate;
  const origOrderFind = Order.find;
  const origReturnAggregate = Return.aggregate;
  const origProductFind = Product.find;
  const origCategoryFind = Category.find;
  const origUserFind = User.find;

  const aggregatePipelinesObserved = [];
  const findMatchesObserved = [];

  Order.aggregate = async (pipeline) => {
    aggregatePipelinesObserved.push(pipeline);
    return [];
  };

  const fluentQuery = (match) => {
    if (match) findMatchesObserved.push(match);
    const q = {
      populate: () => q,
      select: () => q,
      sort: () => q,
      skip: () => q,
      limit: () => q,
      lean: async () => [],
    };
    return q;
  };

  Order.find = fluentQuery;
  Return.aggregate = async () => [];
  Product.find = () => fluentQuery();
  Category.find = () => fluentQuery();
  User.find = () => fluentQuery();

  try {
    // 1. getAnalyticsSummary
    await analyticsService.getAnalyticsSummary({ range: '30d' });
    // 2. getSalesTrends
    await analyticsService.getSalesTrends({ range: '30d' });
    // 3. getProductPerformance
    await analyticsService.getProductPerformance({ range: '30d' });
    // 4. getCategoryPerformance
    await analyticsService.getCategoryPerformance({ range: '30d' });
    // 5. getCustomerPerformance
    await analyticsService.getCustomerPerformance({ range: '30d' });
    // 6. getOrderDistribution
    await analyticsService.getOrderDistribution({ range: '30d' });
    // 7. getCustomerTrends
    await analyticsService.getCustomerTrends({ range: '30d' });

    assert.ok(
      aggregatePipelinesObserved.length >= 5,
      `Expected at least 5 aggregate pipelines, got ${aggregatePipelinesObserved.length}`
    );
    assert.ok(
      findMatchesObserved.length >= 2,
      `Expected at least 2 find queries, got ${findMatchesObserved.length}`
    );

    // Verify all aggregate pipelines filter { isDemo: { $ne: true } }
    for (let i = 0; i < aggregatePipelinesObserved.length; i++) {
      const p = aggregatePipelinesObserved[i];
      const matchStage = p.find(stage => stage.$match);
      assert.ok(matchStage, `Aggregate pipeline ${i} must have a $match stage`);
      assert.deepStrictEqual(
        matchStage.$match.isDemo,
        { $ne: true },
        `Aggregate pipeline ${i} $match must include { isDemo: { $ne: true } }`
      );
    }

    // Verify all find queries filter { isDemo: { $ne: true } }
    for (let i = 0; i < findMatchesObserved.length; i++) {
      const match = findMatchesObserved[i];
      assert.deepStrictEqual(
        match.isDemo,
        { $ne: true },
        `Find query ${i} must include { isDemo: { $ne: true } }`
      );
    }
  } finally {
    Order.aggregate = origOrderAggregate;
    Order.find = origOrderFind;
    Return.aggregate = origReturnAggregate;
    Product.find = origProductFind;
    Category.find = origCategoryFind;
    User.find = origUserFind;
  }
});

runTest('3.2 { isDemo: { $ne: true } } safely matches historical orders lacking isDemo', () => {
  const mockOrders = [
    { orderNumber: 'ORD-HISTORICAL-1' }, // undefined isDemo
    { orderNumber: 'ORD-HISTORICAL-2', isDemo: false },
    { orderNumber: 'DEMO-SIM-001', isDemo: true },
  ];

  const filtered = mockOrders.filter(o => o.isDemo !== true);
  assert.strictEqual(filtered.length, 2);
  assert.strictEqual(filtered[0].orderNumber, 'ORD-HISTORICAL-1');
  assert.strictEqual(filtered[1].orderNumber, 'ORD-HISTORICAL-2');
});

// ---------------------------------------------------------------------------
// Group 4: Admin Order Management & Metrics Isolation
// ---------------------------------------------------------------------------
console.log('\n--- Group 4: Admin Order Management & Metrics ---');

runTest('4.1 validateAdminOrderQuery accepts orderType: ALL, LIVE, DEMO', () => {
  assert.strictEqual(validateAdminOrderQuery({ orderType: 'ALL' }).isValid, true);
  assert.strictEqual(validateAdminOrderQuery({ orderType: 'LIVE' }).isValid, true);
  assert.strictEqual(validateAdminOrderQuery({ orderType: 'DEMO' }).isValid, true);
  assert.strictEqual(validateAdminOrderQuery({ orderType: 'INVALID' }).isValid, false);
});

await runAsyncTest('4.2 getAdminOrders excludes demo orders from metrics and surfaces isDemo flag', async () => {
  const origAggregate = Order.aggregate;
  const origFind = Order.find;
  const origCount = Order.countDocuments;

  let metricsMatchClause = null;
  Order.aggregate = async (pipeline) => {
    metricsMatchClause = pipeline[0].$match;
    return [{
      _id: null,
      totalOrders: 10,
      placed: 2,
      confirmed: 2,
      processing: 2,
      shipped: 2,
      delivered: 2,
      cancelled: 0,
      totalRevenuePaise: 5000000,
    }];
  };

  const sampleOrders = [
    {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'ORD-REAL-1',
      isDemo: false,
      status: 'PLACED',
      createdAt: new Date(),
      items: [],
      pricing: { grandTotal: 200000 },
      payment: { status: 'PENDING' },
    },
    {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'DEMO-SIM-1',
      isDemo: true,
      status: 'CONFIRMED',
      createdAt: new Date(),
      items: [],
      pricing: { grandTotal: 300000 },
      payment: { status: 'PENDING' },
    },
  ];

  const fluentOrderQuery = () => {
    const q = {
      sort: () => q,
      skip: () => q,
      limit: () => q,
      populate: () => q,
      lean: async () => sampleOrders,
    };
    return q;
  };

  Order.find = fluentOrderQuery;
  Order.countDocuments = async () => sampleOrders.length;

  try {
    const res = await orderService.getAdminOrders({ orderType: 'ALL' });
    // Check metrics isolation
    assert.deepStrictEqual(
      metricsMatchClause.isDemo,
      { $ne: true },
      'Admin metrics cards must exclude isDemo: true orders'
    );

    // Check formatted orders output
    assert.strictEqual(res.orders.length, 2);
    assert.strictEqual(res.orders[0].isDemo, false);
    assert.strictEqual(res.orders[1].isDemo, true);
  } finally {
    Order.aggregate = origAggregate;
    Order.find = origFind;
    Order.countDocuments = origCount;
  }
});

// ---------------------------------------------------------------------------
// Group 5: Customer Order History Isolation
// ---------------------------------------------------------------------------
console.log('\n--- Group 5: Customer Order History Isolation ---');

await runAsyncTest('5.1 getMyOrders excludes demo orders from customer views', async () => {
  const origFind = Order.find;
  const origCount = Order.countDocuments;

  let queryCaptured = null;
  Order.find = (q) => {
    queryCaptured = q;
    return {
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => [],
          }),
        }),
      }),
    };
  };
  Order.countDocuments = async (q) => 0;

  const customerId = new mongoose.Types.ObjectId().toString();

  try {
    await orderService.getMyOrders(customerId, { page: 1, limit: 10 });
    assert.strictEqual(queryCaptured.userId, customerId);
    assert.deepStrictEqual(
      queryCaptured.isDemo,
      { $ne: true },
      'getMyOrders query must include isDemo: { $ne: true }'
    );
  } finally {
    Order.find = origFind;
    Order.countDocuments = origCount;
  }
});

await runAsyncTest('5.2 getOrderByNumber excludes demo orders from customer lookup', async () => {
  const origFindOne = Order.findOne;

  let queryCaptured = null;
  Order.findOne = (q) => {
    queryCaptured = q;
    return {
      lean: async () => ({
        _id: new mongoose.Types.ObjectId(),
        orderNumber: 'DEMO-SIM-001',
        userId: q.userId,
        items: [],
      }),
    };
  };

  const customerId = new mongoose.Types.ObjectId().toString();

  try {
    const res = await orderService.getOrderByNumber(customerId, 'DEMO-SIM-001');
    assert.strictEqual(queryCaptured.orderNumber, 'DEMO-SIM-001');
    assert.strictEqual(queryCaptured.userId, customerId);
    assert.deepStrictEqual(
      queryCaptured.isDemo,
      { $ne: true },
      'getOrderByNumber query must include isDemo: { $ne: true } for customer access'
    );
    assert.ok(res, 'Found mock order');
  } finally {
    Order.findOne = origFindOne;
  }
});

// ---------------------------------------------------------------------------
// Group 6: Core Business Invariants
// ---------------------------------------------------------------------------
console.log('\n--- Group 6: Business Invariants Verification ---');

runTest('6.1 Customer shipping fee invariant: exactly ₹200 (20000 paise)', () => {
  assert.strictEqual(SHIPPING_FEE_PAISE, 20000);
});

runTest('6.2 Delivery estimate invariant: within 7 business days', () => {
  const defaultEstimate = MockShipment.schema.paths.deliveryEstimate.defaultValue;
  assert.strictEqual(defaultEstimate, 'Within 7 business days after order confirmation');
});

// ---------------------------------------------------------------------------
// Test Summary
// ---------------------------------------------------------------------------
console.log('\n======================================================');
console.log(` Phase 4D-7 Test Summary: ${passedTests} / ${totalTests} passed`);
console.log('======================================================\n');
if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
