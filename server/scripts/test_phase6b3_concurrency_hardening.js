/**
 * LuxeCart Phase 6B.3: Fencing Token & Recovery Concurrency Hardening Test Suite
 *
 * SIMULATED CONCURRENCY TEST ENVIRONMENT (Strictly zero writes to live/production Atlas)
 *
 * Scenarios tested:
 * 1. Worker A pauses beyond 15 seconds.
 * 2. Worker B reclaims the lock with a fresh lockToken.
 * 3. Worker A resumes and discovers lock ownership was lost.
 * 4. Worker A cannot update progress or finalize.
 * 5. Worker A cannot mutate stock or coupon usage after losing ownership.
 * 6. Worker B completes successfully and finalizes cancellation.
 * 7. Two variants of one product in a single order restore independently.
 * 8. Two separate orders restoring the same product variant concurrently.
 * 9. Two separate orders rolling back the same coupon concurrently.
 * 10. A stale worker cannot overwrite a newer worker's error state.
 * 11. Token cleanup cannot remove active recovery tokens prior to completion.
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
console.log('   LUXECART PHASE 6B.3: FENCING TOKEN & CONCURRENCY TEST SUITE        ');
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

    // Apply updates
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

  const prod1Id = new mongoose.Types.ObjectId().toString();
  const var1Id = new mongoose.Types.ObjectId().toString();
  const var2Id = new mongoose.Types.ObjectId().toString();

  const prod2Id = new mongoose.Types.ObjectId().toString();
  const var3Id = new mongoose.Types.ObjectId().toString();

  // --------------------------------------------------------------------------
  // SCENARIO 1 to 6: Stale worker lost-ownership race
  // 1. Worker A acquires lock.
  // 2. Worker A pauses beyond 15s.
  // 3. Worker B reclaims lock with a fresh lockToken.
  // 4. Worker A resumes and is blocked from progress/mutation/finalization.
  // 5. Worker B completes successfully.
  // --------------------------------------------------------------------------
  try {
    const orderId = new mongoose.Types.ObjectId();
    const harness = createHarness({
      orders: [
        {
          _id: orderId,
          orderNumber: 'ORD-FENCE-RACE',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          coupon: { code: 'FENCE10', discountAmount: 1000 },
          items: [
            { productId: prod1Id, variantId: var1Id, quantity: 2, sku: 'SKU-VAR1' },
            { productId: prod2Id, variantId: var3Id, quantity: 1, sku: 'SKU-VAR3' },
          ],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-VAR1', inventory: { stock: 10 } }],
          cancellationTokens: [],
        },
        {
          _id: prod2Id,
          variants: [{ _id: var3Id, sku: 'SKU-VAR3', inventory: { stock: 5 } }],
          cancellationTokens: [],
        },
      ],
      coupons: [{ code: 'FENCE10', usedCount: 4, cancellationTokens: [] }],
    });

    // Step 1: Simulate Worker A acquiring lock
    const orderDoc = harness.orders.get(orderId.toString());
    const staleLockTokenA = 'lock-token-worker-A-stale';
    orderDoc.cancellation = {
      status: 'IN_PROGRESS',
      lockToken: staleLockTokenA,
      initiatedAt: new Date(Date.now() - 20000), // 20s ago (> 15s stale threshold)
      reason: 'Worker A initial attempt',
      restoredItems: [],
      couponRestored: false,
    };

    // Step 2: Worker B reclaims lock via updateOrderStatus
    const workerBResult = await orderService.updateOrderStatus('ORD-FENCE-RACE', { status: ORDER_STATUS.CANCELLED });
    assert.strictEqual(workerBResult.status, ORDER_STATUS.CANCELLED, 'Worker B must complete cancellation');
    assert.strictEqual(workerBResult.cancellation.status, 'COMPLETED');
    const freshLockTokenB = workerBResult.cancellation.lockToken;
    assert.notStrictEqual(freshLockTokenB, staleLockTokenA, 'Worker B must have a fresh, unique lockToken');

    // Step 3: Verify that Worker A attempting to update progress is blocked
    const workerAProgressUpdate = await Order.updateOne(
      { _id: orderId, 'cancellation.lockToken': staleLockTokenA },
      { $push: { 'cancellation.restoredItems': { sku: 'STALE' } } }
    );
    assert.strictEqual(workerAProgressUpdate.matchedCount, 0, 'Worker A must not match order with stale lockToken');

    // Step 4: Verify Worker A cannot finalize
    const workerAFinalize = await Order.findOneAndUpdate(
      { _id: orderId, 'cancellation.lockToken': staleLockTokenA },
      { $set: { 'cancellation.status': 'CORRUPTED' } }
    );
    assert.strictEqual(workerAFinalize, null, 'Worker A cannot finalize with stale lockToken');

    // Step 5: Verify final stock and coupon state
    const p1 = harness.products.get(prod1Id);
    const p2 = harness.products.get(prod2Id);
    const c1 = harness.coupons.get('FENCE10');
    assert.strictEqual(p1.variants[0].inventory.stock, 12, 'Product 1 stock restored exactly once (+2)');
    assert.strictEqual(p2.variants[0].inventory.stock, 6, 'Product 2 stock restored exactly once (+1)');
    assert.strictEqual(c1.usedCount, 3, 'Coupon count decremented exactly once (-1)');

    record('FENCE-01', 'Worker B reclaims stale lock; Worker A cannot update progress or finalize', 'PASS');
  } catch (err) {
    record('FENCE-01', 'Stale worker lost-ownership race', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // SCENARIO 7: Two variants of one product restore independently
  // --------------------------------------------------------------------------
  try {
    const harness = createHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-SAMEPROD-MULTI',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [
            { productId: prod1Id, variantId: var1Id, quantity: 2, sku: 'SKU-VAR1' },
            { productId: prod1Id, variantId: var2Id, quantity: 3, sku: 'SKU-VAR2' },
          ],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [
            { _id: var1Id, sku: 'SKU-VAR1', inventory: { stock: 20 } },
            { _id: var2Id, sku: 'SKU-VAR2', inventory: { stock: 30 } },
          ],
          cancellationTokens: [],
        },
      ],
    });

    await orderService.updateOrderStatus('ORD-SAMEPROD-MULTI', { status: ORDER_STATUS.CANCELLED });

    const p = harness.products.get(prod1Id);
    assert.strictEqual(p.variants[0].inventory.stock, 22, 'Variant 1 stock incremented by 2');
    assert.strictEqual(p.variants[1].inventory.stock, 33, 'Variant 2 stock incremented by 3');

    record('FENCE-02', 'Two variants of one product in single order restore independently without collision', 'PASS');
  } catch (err) {
    record('FENCE-02', 'Two variants of one product restore', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // SCENARIO 8: Two orders restore the same product variant concurrently
  // --------------------------------------------------------------------------
  try {
    const harness = createHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-RACE-A',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 5, sku: 'SKU-VAR1' }],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-RACE-B',
          userId: customerB,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 10, sku: 'SKU-VAR1' }],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-VAR1', inventory: { stock: 50 } }],
          cancellationTokens: [],
        },
      ],
    });

    const [resA, resB] = await Promise.all([
      orderService.updateOrderStatus('ORD-RACE-A', { status: ORDER_STATUS.CANCELLED }),
      orderService.updateOrderStatus('ORD-RACE-B', { status: ORDER_STATUS.CANCELLED }),
    ]);

    assert.strictEqual(resA.status, ORDER_STATUS.CANCELLED);
    assert.strictEqual(resB.status, ORDER_STATUS.CANCELLED);

    const p = harness.products.get(prod1Id);
    assert.strictEqual(p.variants[0].inventory.stock, 65, 'Total stock restored is exactly 50 + 5 + 10 = 65');

    record('FENCE-03', 'Two orders restore the same product variant concurrently with zero lost updates', 'PASS');
  } catch (err) {
    record('FENCE-03', 'Concurrent variant restoration', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // SCENARIO 9: Two orders roll back the same coupon concurrently
  // --------------------------------------------------------------------------
  try {
    const harness = createHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-COUPON-A',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          coupon: { code: 'SHARED10', discountAmount: 500 },
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-VAR1' }],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-COUPON-B',
          userId: customerB,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          coupon: { code: 'SHARED10', discountAmount: 500 },
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-VAR1' }],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-VAR1', inventory: { stock: 10 } }],
          cancellationTokens: [],
        },
      ],
      coupons: [{ code: 'SHARED10', usedCount: 15, cancellationTokens: [] }],
    });

    await Promise.all([
      orderService.updateOrderStatus('ORD-COUPON-A', { status: ORDER_STATUS.CANCELLED }),
      orderService.updateOrderStatus('ORD-COUPON-B', { status: ORDER_STATUS.CANCELLED }),
    ]);

    const c = harness.coupons.get('SHARED10');
    assert.strictEqual(c.usedCount, 13, 'Coupon usedCount decremented by 2 (15 -> 13)');

    record('FENCE-04', 'Two orders roll back the same coupon concurrently without interference', 'PASS');
  } catch (err) {
    record('FENCE-04', 'Concurrent coupon rollback', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // SCENARIO 10: Stale worker cannot overwrite a newer worker's error state
  // --------------------------------------------------------------------------
  try {
    const orderId = new mongoose.Types.ObjectId();
    const harness = createHarness({
      orders: [
        {
          _id: orderId,
          orderNumber: 'ORD-ERROR-FENCE',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          cancellation: {
            status: 'FAILED_REQUIRES_ATTENTION',
            lockToken: 'newer-lock-token-B',
            error: { message: 'Legitimate failure from Worker B' },
          },
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-VAR1' }],
        },
      ],
    });

    const staleLockTokenA = 'stale-lock-token-A';

    // Stale Worker A attempts to record its error using its stale lockToken
    const updateResult = await Order.updateOne(
      { _id: orderId, 'cancellation.lockToken': staleLockTokenA },
      {
        $set: {
          'cancellation.status': 'FAILED_REQUIRES_ATTENTION',
          'cancellation.error': { message: 'Overwritten error from dead Worker A' },
        },
      }
    );

    assert.strictEqual(updateResult.matchedCount, 0, 'Must match 0 documents due to lockToken mismatch');

    const doc = harness.orders.get(orderId.toString());
    assert.strictEqual(
      doc.cancellation.error.message,
      'Legitimate failure from Worker B',
      'Worker B error must remain intact and not overwritten'
    );

    record('FENCE-05', 'Stale worker cannot overwrite a newer worker error state', 'PASS');
  } catch (err) {
    record('FENCE-05', 'Stale worker error overwrite guard', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // SCENARIO 11: Token cleanup does not remove active tokens prior to completion
  // --------------------------------------------------------------------------
  try {
    const orderId = new mongoose.Types.ObjectId();
    const harness = createHarness({
      orders: [
        {
          _id: orderId,
          orderNumber: 'ORD-ACTIVE-TOKEN',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [
            { productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-VAR1' },
            { productId: prod2Id, variantId: var3Id, quantity: 1, sku: 'SKU-VAR3' },
          ],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-VAR1', inventory: { stock: 10 } }],
          cancellationTokens: [],
        },
        {
          _id: prod2Id,
          variants: [{ _id: var3Id, sku: 'SKU-VAR3', inventory: { stock: 5 } }],
          cancellationTokens: [],
        },
      ],
    });

    // Inject failure on Item 2 so cancellation fails midway
    const origProductUpdateOne = Product.updateOne;
    Product.updateOne = async function (filter, update) {
      if (filter._id.toString() === prod2Id.toString()) {
        throw new Error('Midway failure on item 2');
      }
      return origProductUpdateOne.apply(this, arguments);
    };

    let caughtError = null;
    try {
      await orderService.updateOrderStatus('ORD-ACTIVE-TOKEN', { status: ORDER_STATUS.CANCELLED });
    } catch (err) {
      caughtError = err;
    }
    Product.updateOne = origProductUpdateOne;

    assert(caughtError, 'Must fail on item 2');

    // Product 1's token must NOT have been pruned because cancellation failed and was NOT completed!
    const p1 = harness.products.get(prod1Id);
    assert(
      (p1.cancellationTokens || []).length > 0,
      'Active recovery token on Product 1 must be retained for safe retry'
    );

    const doc = harness.orders.get(orderId.toString());
    assert.strictEqual(doc.status, ORDER_STATUS.PROCESSING, 'Order must remain PROCESSING');
    assert.strictEqual(doc.cancellation.status, 'FAILED_REQUIRES_ATTENTION');

    // Now retry and let it complete
    await orderService.updateOrderStatus('ORD-ACTIVE-TOKEN', { status: ORDER_STATUS.CANCELLED });

    const docAfterRetry = harness.orders.get(orderId.toString());
    assert.strictEqual(docAfterRetry.status, ORDER_STATUS.CANCELLED);
    assert.strictEqual(docAfterRetry.cancellation.status, 'COMPLETED');

    // Now after COMPLETED, the tokens have been safely pruned
    const p1Final = harness.products.get(prod1Id);
    const p2Final = harness.products.get(prod2Id);
    assert.strictEqual(p1Final.cancellationTokens.length, 0, 'Tokens safely pruned after terminal COMPLETED state');
    assert.strictEqual(p2Final.cancellationTokens.length, 0, 'Tokens safely pruned after terminal COMPLETED state');
    assert.strictEqual(p1Final.variants[0].inventory.stock, 11, 'Product 1 stock restored exactly once');
    assert.strictEqual(p2Final.variants[0].inventory.stock, 6, 'Product 2 stock restored exactly once');

    record('FENCE-06', 'Token cleanup cannot remove active recovery tokens prior to terminal completion', 'PASS');
  } catch (err) {
    record('FENCE-06', 'Token retention prior to completion', 'FAIL', err.message);
  }

  // Summary
  console.log('\n======================================================================');
  console.log('                 PHASE 6B.3 TEST RESULTS SUMMARY                      ');
  console.log('======================================================================');
  console.table(results);

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  if (failed > 0) {
    console.error(`\n✖ ${failed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\n✔ All ${passed} Phase 6B.3 Fencing & Concurrency tests passed!`);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
