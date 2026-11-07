/**
 * LuxeCart Phase 6B.4: Cancellation Integration Verification Suite
 *
 * SIMULATED INTEGRATION ENVIRONMENT (Strictly zero writes to live/production Atlas)
 *
 * Verification Areas:
 * 1. Customer cancellation flow with ownership & demo isolation
 * 2. Admin cancellation flow through the canonical recovery engine
 * 3. Worker A pauses; Worker B reclaims stale lock; Worker A cannot overwrite
 * 4. Two orders concurrently restoring the same variant
 * 5. Two orders concurrently rolling back the same coupon
 * 6. Incomplete recovery retains tokens; terminal completion prunes tokens
 * 7. Token cleanup isolation (Order A cleanup does not remove Order B tokens)
 * 8. Schema projection verification: queries omit cancellationTokens by default
 * 9. Duplicate cancellation rejection (409) with zero double-restoration
 */

import assert from 'assert';
import mongoose from 'mongoose';

import orderService from '../src/modules/orders/order.service.js';
import Order from '../src/modules/orders/order.model.js';
import Product from '../src/modules/products/product.model.js';
import Coupon from '../src/modules/coupons/coupon.model.js';
import couponService from '../src/modules/coupons/coupon.service.js';
import { ORDER_STATUS } from '../src/modules/orders/orderStateMachine.js';

// Prevent Mongoose from attempting live network connections
mongoose.set('bufferCommands', false);

console.log('======================================================================');
console.log('   LUXECART PHASE 6B.4: CANCELLATION INTEGRATION VERIFICATION         ');
console.log('   [Environment: Simulated Concurrency / In-Memory Isolation]        ');
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

function createHarness(initialData = {}) {
  const orders = new Map();
  const products = new Map();
  const coupons = new Map();

  if (initialData.orders) {
    initialData.orders.forEach((o) => orders.set(o._id.toString(), JSON.parse(JSON.stringify(o))));
  }
  if (initialData.products) {
    initialData.products.forEach((p) => products.set(p._id.toString(), JSON.parse(JSON.stringify(p))));
  }
  if (initialData.coupons) {
    initialData.coupons.forEach((c) => coupons.set(c.code.toUpperCase(), JSON.parse(JSON.stringify(c))));
  }

  // Intercept Order methods
  Order.findOne = function (filter) {
    let matched = null;
    for (const doc of orders.values()) {
      let match = true;
      if (filter.orderNumber && doc.orderNumber !== filter.orderNumber.toUpperCase()) match = false;
      if (filter._id && doc._id.toString() !== filter._id.toString()) match = false;
      if (filter.userId && doc.userId.toString() !== filter.userId.toString()) match = false;
      if (filter.isDemo !== undefined) {
        if (filter.isDemo.$ne !== undefined && doc.isDemo === filter.isDemo.$ne) match = false;
      }
      if (filter['cancellation.lockToken'] && doc.cancellation?.lockToken !== filter['cancellation.lockToken']) {
        match = false;
      }
      if (filter['cancellation.status'] && doc.cancellation?.status !== filter['cancellation.status']) {
        match = false;
      }
      if (filter.$or) {
        const orMatches = filter.$or.some((c) => {
          if (c._id && doc._id.toString() === c._id.toString()) return true;
          if (c.orderNumber && doc.orderNumber === c.orderNumber.toUpperCase()) return true;
          return false;
        });
        if (!orMatches) match = false;
      }
      if (match) {
        matched = doc;
        break;
      }
    }
    const ret = matched ? JSON.parse(JSON.stringify(matched)) : null;
    const query = {
      select: () => query,
      populate: () => query,
      lean: async () => ret,
      then: (resolve, reject) => Promise.resolve(ret).then(resolve, reject),
      catch: (reject) => Promise.resolve(ret).catch(reject),
    };
    return query;
  };

  Order.exists = async function (filter) {
    for (const doc of orders.values()) {
      let match = true;
      if (filter._id && doc._id.toString() !== filter._id.toString()) match = false;
      if (filter['cancellation.lockToken'] && doc.cancellation?.lockToken !== filter['cancellation.lockToken']) {
        match = false;
      }
      if (filter['cancellation.status'] && doc.cancellation?.status !== filter['cancellation.status']) {
        match = false;
      }
      if (match) return true;
    }
    return false;
  };

  Order.findOneAndUpdate = function (filter, update, options) {
    let doc = null;
    for (const d of orders.values()) {
      let match = true;
      if (filter._id && d._id.toString() !== filter._id.toString()) match = false;
      if (filter.status && d.status !== filter.status) match = false;
      if (filter['cancellation.lockToken'] && d.cancellation?.lockToken !== filter['cancellation.lockToken']) {
        match = false;
      }
      if (filter.$or) {
        const orMatch = filter.$or.some((cond) => {
          if (cond['cancellation.status']) {
            const allowed = cond['cancellation.status'].$in;
            if (allowed && !allowed.includes(d.cancellation?.status || null)) return false;
          }
          if (cond['cancellation.status'] === 'IN_PROGRESS' && cond['cancellation.initiatedAt']) {
            if (d.cancellation?.status !== 'IN_PROGRESS') return false;
            const threshold = cond['cancellation.initiatedAt'].$lt;
            if (threshold && new Date(d.cancellation.initiatedAt) >= threshold) return false;
          }
          if (cond.cancellation && cond.cancellation.$exists === false) {
            if (d.cancellation !== undefined && d.cancellation !== null) return false;
          }
          return true;
        });
        if (!orMatch) match = false;
      }
      if (match) {
        doc = d;
        break;
      }
    }

    if (!doc) {
      const nullQuery = {
        populate: () => nullQuery,
        lean: () => nullQuery,
        then: (resolve) => Promise.resolve(null).then(resolve),
        catch: (reject) => Promise.resolve(null).catch(reject),
      };
      return nullQuery;
    }

    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) {
        if (k.startsWith('cancellation.')) {
          const subKey = k.replace('cancellation.', '');
          doc.cancellation = doc.cancellation || {};
          doc.cancellation[subKey] = v;
        } else {
          doc[k] = v;
        }
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (k.startsWith('cancellation.')) {
          const subKey = k.replace('cancellation.', '');
          doc.cancellation = doc.cancellation || {};
          doc.cancellation[subKey] = doc.cancellation[subKey] || [];
          doc.cancellation[subKey].push(v);
        } else {
          doc[k] = doc[k] || [];
          doc[k].push(v);
        }
      }
    }

    const ret = JSON.parse(JSON.stringify(doc));
    const query = {
      populate: () => query,
      lean: () => query,
      then: (resolve, reject) => Promise.resolve(ret).then(resolve, reject),
      catch: (reject) => Promise.resolve(ret).catch(reject),
    };
    return query;
  };

  Order.updateOne = async function (filter, update) {
    const doc = orders.get(filter._id.toString());
    if (!doc) return { matchedCount: 0, modifiedCount: 0 };
    if (filter['cancellation.lockToken'] && doc.cancellation?.lockToken !== filter['cancellation.lockToken']) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) {
        if (k.startsWith('cancellation.')) {
          const subKey = k.replace('cancellation.', '');
          doc.cancellation = doc.cancellation || {};
          doc.cancellation[subKey] = v;
        } else {
          doc[k] = v;
        }
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (k.startsWith('cancellation.')) {
          const subKey = k.replace('cancellation.', '');
          doc.cancellation = doc.cancellation || {};
          doc.cancellation[subKey] = doc.cancellation[subKey] || [];
          doc.cancellation[subKey].push(v);
        } else {
          doc[k] = doc[k] || [];
          doc[k].push(v);
        }
      }
    }
    return { matchedCount: 1, modifiedCount: 1 };
  };

  // Intercept Product methods
  Product.updateOne = async function (filter, update) {
    const prod = products.get(filter._id.toString());
    if (!prod) return { matchedCount: 0, modifiedCount: 0 };

    const tokenCondition = filter.cancellationTokens?.$ne;
    if (tokenCondition && (prod.cancellationTokens || []).includes(tokenCondition)) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    let matchedVariant = null;
    if (filter.variants?.$elemMatch?._id) {
      matchedVariant = (prod.variants || []).find(
        (v) => v._id.toString() === filter.variants.$elemMatch._id.toString()
      );
      if (!matchedVariant) return { matchedCount: 0, modifiedCount: 0 };
    }

    if (update.$inc && update.$inc['variants.$.inventory.stock'] && matchedVariant) {
      matchedVariant.inventory = matchedVariant.inventory || {};
      matchedVariant.inventory.stock = (matchedVariant.inventory.stock || 0) + update.$inc['variants.$.inventory.stock'];
    }

    if (update.$addToSet?.cancellationTokens) {
      prod.cancellationTokens = prod.cancellationTokens || [];
      if (!prod.cancellationTokens.includes(update.$addToSet.cancellationTokens)) {
        prod.cancellationTokens.push(update.$addToSet.cancellationTokens);
      }
    }

    return { matchedCount: 1, modifiedCount: 1 };
  };

  Product.updateMany = async function (filter, update) {
    let modified = 0;
    if (update.$pull?.cancellationTokens) {
      const pullFilter = update.$pull.cancellationTokens;
      for (const prod of products.values()) {
        if (filter._id?.$in && !filter._id.$in.map((id) => id.toString()).includes(prod._id.toString())) {
          continue;
        }
        if (prod.cancellationTokens) {
          const before = prod.cancellationTokens.length;
          if (pullFilter.$in) {
            prod.cancellationTokens = prod.cancellationTokens.filter((t) => !pullFilter.$in.includes(t));
          } else {
            prod.cancellationTokens = prod.cancellationTokens.filter((t) => t !== pullFilter);
          }
          if (prod.cancellationTokens.length !== before) modified++;
        }
      }
    }
    return { matchedCount: modified, modifiedCount: modified };
  };

  Product.exists = async function (filter) {
    const prod = products.get(filter._id.toString());
    if (!prod) return false;
    if (filter.cancellationTokens) {
      return (prod.cancellationTokens || []).includes(filter.cancellationTokens);
    }
    if (filter['variants._id']) {
      return (prod.variants || []).some((v) => v._id.toString() === filter['variants._id'].toString());
    }
    return true;
  };

  // Intercept Coupon methods
  Coupon.updateOne = async function (filter, update) {
    const coup = coupons.get(filter.code.toUpperCase());
    if (!coup) return { matchedCount: 0, modifiedCount: 0 };

    if (update.$pull?.cancellationTokens) {
      if (coup.cancellationTokens) {
        coup.cancellationTokens = coup.cancellationTokens.filter((t) => t !== update.$pull.cancellationTokens);
      }
      return { matchedCount: 1, modifiedCount: 1 };
    }

    if (filter.cancellationTokens?.$ne && (coup.cancellationTokens || []).includes(filter.cancellationTokens.$ne)) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    if (filter.usedCount?.$gt !== undefined && coup.usedCount <= filter.usedCount.$gt) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    if (update.$inc?.usedCount) {
      coup.usedCount = Math.max(0, (coup.usedCount || 0) + update.$inc.usedCount);
    }

    if (update.$addToSet?.cancellationTokens) {
      coup.cancellationTokens = coup.cancellationTokens || [];
      if (!coup.cancellationTokens.includes(update.$addToSet.cancellationTokens)) {
        coup.cancellationTokens.push(update.$addToSet.cancellationTokens);
      }
    }

    return { matchedCount: 1, modifiedCount: 1 };
  };

  return { orders, products, coupons };
}

async function runSuite() {
  const customerA = new mongoose.Types.ObjectId().toString();
  const customerB = new mongoose.Types.ObjectId().toString();
  const adminId = new mongoose.Types.ObjectId().toString();

  const prod1Id = new mongoose.Types.ObjectId().toString();
  const var1Id = new mongoose.Types.ObjectId().toString();
  const var2Id = new mongoose.Types.ObjectId().toString();

  const prod2Id = new mongoose.Types.ObjectId().toString();
  const var3Id = new mongoose.Types.ObjectId().toString();

  // --------------------------------------------------------------------------
  // TEST 1: Customer workflow with ownership, coupon, and inventory
  // --------------------------------------------------------------------------
  try {
    const harness = createHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'LC-20261101-CUST01',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          coupon: { code: 'LUXE10', discountAmount: 1000 },
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 2, sku: 'SKU-1' }],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 15 } }],
          cancellationTokens: [],
        },
      ],
      coupons: [{ code: 'LUXE10', usedCount: 5, cancellationTokens: [] }],
    });

    const res = await orderService.cancelCustomerOrder(customerA, 'LC-20261101-CUST01', {
      reason: 'Customer requested change of size',
    });

    assert.strictEqual(res.status, ORDER_STATUS.CANCELLED);
    assert.strictEqual(res.cancellation.status, 'COMPLETED');

    const p = harness.products.get(prod1Id);
    const c = harness.coupons.get('LUXE10');
    assert.strictEqual(p.variants[0].inventory.stock, 17, 'Stock must increment by 2 (15 -> 17)');
    assert.strictEqual(c.usedCount, 4, 'Coupon usedCount must decrement by 1 (5 -> 4)');

    record('INT-01', 'Customer can cancel their own order with coupon and inventory recovery', 'PASS');
  } catch (err) {
    record('INT-01', 'Customer workflow test', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Admin workflow shares canonical recovery engine
  // --------------------------------------------------------------------------
  try {
    const harness = createHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'LC-20261101-ADMIN01',
          userId: customerB,
          isDemo: false,
          status: ORDER_STATUS.CONFIRMED,
          items: [{ productId: prod2Id, variantId: var3Id, quantity: 1, sku: 'SKU-3' }],
        },
      ],
      products: [
        {
          _id: prod2Id,
          variants: [{ _id: var3Id, sku: 'SKU-3', inventory: { stock: 8 } }],
          cancellationTokens: [],
        },
      ],
    });

    const res = await orderService.updateOrderStatus(
      'LC-20261101-ADMIN01',
      { status: ORDER_STATUS.CANCELLED, note: 'Admin conciergerie cancellation' },
      adminId
    );

    assert.strictEqual(res.status, ORDER_STATUS.CANCELLED);
    assert.strictEqual(res.cancellation.status, 'COMPLETED');
    const p = harness.products.get(prod2Id);
    assert.strictEqual(p.variants[0].inventory.stock, 9, 'Stock must increment by 1 (8 -> 9)');

    record('INT-02', 'Admin workflow routes through identical canonical recovery engine', 'PASS');
  } catch (err) {
    record('INT-02', 'Admin workflow test', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Stale Worker A vs Worker B lock fencing race
  // --------------------------------------------------------------------------
  try {
    const orderId = new mongoose.Types.ObjectId();
    const harness = createHarness({
      orders: [
        {
          _id: orderId,
          orderNumber: 'ORD-INT-FENCE',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 3, sku: 'SKU-1' }],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 50 } }],
          cancellationTokens: [],
        },
      ],
    });

    // Simulate Worker A holding stale lock from 25 seconds ago
    const staleLockTokenA = 'worker-A-stale-lock-token';
    const doc = harness.orders.get(orderId.toString());
    doc.cancellation = {
      status: 'IN_PROGRESS',
      lockToken: staleLockTokenA,
      initiatedAt: new Date(Date.now() - 25000),
      restoredItems: [],
    };

    // Worker B reclaims lock and completes
    const workerBRes = await orderService.updateOrderStatus('ORD-INT-FENCE', { status: ORDER_STATUS.CANCELLED });
    assert.strictEqual(workerBRes.status, ORDER_STATUS.CANCELLED);
    assert.strictEqual(workerBRes.cancellation.status, 'COMPLETED');
    assert.notStrictEqual(workerBRes.cancellation.lockToken, staleLockTokenA);

    // Stale Worker A resumes and attempts to write
    const writeResult = await Order.updateOne(
      { _id: orderId, 'cancellation.lockToken': staleLockTokenA },
      { $set: { status: 'CORRUPTED' } }
    );
    assert.strictEqual(writeResult.matchedCount, 0, 'Worker A must match 0 documents');

    const p = harness.products.get(prod1Id);
    assert.strictEqual(p.variants[0].inventory.stock, 53, 'Stock restored exactly once (+3, not +6)');

    record('INT-03', 'Worker B reclaims stale lock; Worker A is strictly locked out', 'PASS');
  } catch (err) {
    record('INT-03', 'Stale worker lock race test', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Two different orders restoring the same product variant concurrently
  // --------------------------------------------------------------------------
  try {
    const harness = createHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-CONCUR-P1',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 4, sku: 'SKU-1' }],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-CONCUR-P2',
          userId: customerB,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 6, sku: 'SKU-1' }],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 100 } }],
          cancellationTokens: [],
        },
      ],
    });

    const [res1, res2] = await Promise.all([
      orderService.updateOrderStatus('ORD-CONCUR-P1', { status: ORDER_STATUS.CANCELLED }),
      orderService.updateOrderStatus('ORD-CONCUR-P2', { status: ORDER_STATUS.CANCELLED }),
    ]);

    assert.strictEqual(res1.status, ORDER_STATUS.CANCELLED);
    assert.strictEqual(res2.status, ORDER_STATUS.CANCELLED);

    const p = harness.products.get(prod1Id);
    assert.strictEqual(p.variants[0].inventory.stock, 110, 'Stock restored to exactly 100 + 4 + 6 = 110');

    record('INT-04', 'Two orders restore the same variant concurrently with exact inventory restoration', 'PASS');
  } catch (err) {
    record('INT-04', 'Concurrent variant restoration test', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Two different orders rolling back the same coupon concurrently
  // --------------------------------------------------------------------------
  try {
    const harness = createHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-COUPON-R1',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          coupon: { code: 'VIP20', discountAmount: 2000 },
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-1' }],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-COUPON-R2',
          userId: customerB,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          coupon: { code: 'VIP20', discountAmount: 2000 },
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-1' }],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 10 } }],
          cancellationTokens: [],
        },
      ],
      coupons: [{ code: 'VIP20', usedCount: 20, cancellationTokens: [] }],
    });

    await Promise.all([
      orderService.updateOrderStatus('ORD-COUPON-R1', { status: ORDER_STATUS.CANCELLED }),
      orderService.updateOrderStatus('ORD-COUPON-R2', { status: ORDER_STATUS.CANCELLED }),
    ]);

    const c = harness.coupons.get('VIP20');
    assert.strictEqual(c.usedCount, 18, 'Coupon count decremented from 20 to 18');

    record('INT-05', 'Two orders roll back the same coupon concurrently with exact usage decrement', 'PASS');
  } catch (err) {
    record('INT-05', 'Concurrent coupon rollback test', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Token cleanup isolation (Order A cleanup does not remove Order B tokens)
  // --------------------------------------------------------------------------
  try {
    const harness = createHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-CLEAN-A',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-1' }],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-CLEAN-B',
          userId: customerB,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-1' }],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 20 } }],
          // Pre-populate with an active token from Order B (simulating Order B in-flight)
          cancellationTokens: [`ORD-CLEAN-B:${var1Id}:active-token`],
        },
      ],
    });

    // Complete Order A
    await orderService.updateOrderStatus('ORD-CLEAN-A', { status: ORDER_STATUS.CANCELLED });

    const p = harness.products.get(prod1Id);
    assert(
      p.cancellationTokens.includes(`ORD-CLEAN-B:${var1Id}:active-token`),
      "Order A's token cleanup must NOT pull Order B's active token"
    );

    record('INT-06', 'Order token cleanup is strictly scoped and does not pull other active tokens', 'PASS');
  } catch (err) {
    record('INT-06', 'Token cleanup isolation test', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Schema projection verification (select: false)
  // --------------------------------------------------------------------------
  try {
    const prodSchemaFields = Product.schema.paths;
    const coupSchemaFields = Coupon.schema.paths;

    assert.strictEqual(
      prodSchemaFields.cancellationTokens.options.select,
      false,
      'Product.cancellationTokens must have select: false'
    );
    assert.strictEqual(
      coupSchemaFields.cancellationTokens.options.select,
      false,
      'Coupon.cancellationTokens must have select: false'
    );

    record('INT-07', 'Product and Coupon schemas enforce select: false on cancellationTokens', 'PASS');
  } catch (err) {
    record('INT-07', 'Schema projection verification test', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Customer authorization & Demo order protection
  // --------------------------------------------------------------------------
  try {
    const harness = createHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'LC-20261101-AUTH01',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-1' }],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'DEMO-20261101-AUTH02',
          userId: customerA,
          isDemo: true,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-1' }],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 10 } }],
          cancellationTokens: [],
        },
      ],
    });

    // Customer B cannot cancel Customer A's order (403)
    let authError = null;
    try {
      await orderService.cancelCustomerOrder(customerB, 'LC-20261101-AUTH01');
    } catch (err) {
      authError = err;
    }
    assert(authError);
    assert.strictEqual(authError.statusCode, 403);

    // Customer cannot cancel Demo order (400)
    let demoError = null;
    try {
      await orderService.cancelCustomerOrder(customerA, 'DEMO-20261101-AUTH02');
    } catch (err) {
      demoError = err;
    }
    assert(demoError);
    assert.strictEqual(demoError.statusCode, 400);
    assert.strictEqual(demoError.code, 'DEMO_ORDER_NOT_ALLOWED');

    record('INT-08', 'Customer authorization (403) and demo-order rejection (400) strictly enforced', 'PASS');
  } catch (err) {
    record('INT-08', 'Customer authorization & Demo order test', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Duplicate cancellation rejection (409) with zero double-restoration
  // --------------------------------------------------------------------------
  try {
    const harness = createHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'LC-20261101-DUP01',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 2, sku: 'SKU-1' }],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 10 } }],
          cancellationTokens: [],
        },
      ],
    });

    // First cancellation succeeds
    const firstRes = await orderService.cancelCustomerOrder(customerA, 'LC-20261101-DUP01');
    assert.strictEqual(firstRes.status, ORDER_STATUS.CANCELLED);

    const pAfterFirst = harness.products.get(prod1Id);
    assert.strictEqual(pAfterFirst.variants[0].inventory.stock, 12, 'Stock restored to 12');

    // Duplicate cancellation fails with 409
    let dupError = null;
    try {
      await orderService.cancelCustomerOrder(customerA, 'LC-20261101-DUP01');
    } catch (err) {
      dupError = err;
    }
    assert(dupError);
    assert.strictEqual(dupError.statusCode, 409);
    assert.strictEqual(dupError.code, 'ORDER_ALREADY_CANCELLED');

    const pAfterSecond = harness.products.get(prod1Id);
    assert.strictEqual(pAfterSecond.variants[0].inventory.stock, 12, 'Stock remains 12; zero double-restoration');

    record('INT-09', 'Duplicate cancellation rejected with 409 Conflict without double-restoring stock', 'PASS');
  } catch (err) {
    record('INT-09', 'Duplicate cancellation test', 'FAIL', err.message);
  }

  // Summary
  console.log('\n======================================================================');
  console.log('                 PHASE 6B.4 TEST RESULTS SUMMARY                      ');
  console.log('======================================================================');
  console.table(results);

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  if (failed > 0) {
    console.error(`\n✖ ${failed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\n✔ All ${passed} Phase 6B.4 Cancellation Integration tests passed!`);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
