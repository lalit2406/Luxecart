/**
 * LuxeCart Phase 6B.2: Standalone Cancellation Recovery Hardening Test Suite
 *
 * Fully isolated in-memory verification suite (Zero writes to live database):
 * 1. Coupon rollback failure.
 * 2. First inventory item failure.
 * 3. Later inventory item failure.
 * 4. Process interruption after an inventory mutation.
 * 5. Process interruption before an inventory mutation.
 * 6. Process interruption during coupon recovery.
 * 7. Repeated recovery execution.
 * 8. Two concurrent cancellation requests.
 * 9. Recovery after application restart.
 * 10. Missing product or variant during restoration.
 * 11. Duplicate customer cancellation.
 * 12. Admin cancellation compatibility.
 * 13. Demo order isolation.
 */

import assert from 'assert';
import mongoose from 'mongoose';

import orderService from '../src/modules/orders/order.service.js';
import Order from '../src/modules/orders/order.model.js';
import Product from '../src/modules/products/product.model.js';
import Coupon from '../src/modules/coupons/coupon.model.js';
import couponService from '../src/modules/coupons/coupon.service.js';
import { ORDER_STATUS } from '../src/modules/orders/orderStateMachine.js';

// Prevent Mongoose from attempting live network connections during mock tests
mongoose.set('bufferCommands', false);

console.log('======================================================================');
console.log('   LUXECART PHASE 6B.2: STANDALONE CANCELLATION RECOVERY TEST SUITE   ');
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

/**
 * Creates an in-memory test harness simulating MongoDB document operations
 */
function createInMemoryHarness(initialData = {}) {
  const orders = new Map();
  const products = new Map();
  const coupons = new Map();

  // Populate initial state
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

    // Apply update
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

    // Idempotency check with cancellationTokens
    const tokenCondition = filter.cancellationTokens?.$ne;
    if (tokenCondition && (prod.cancellationTokens || []).includes(tokenCondition)) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    // Check variant
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
  const adminUser = new mongoose.Types.ObjectId().toString();

  const prod1Id = new mongoose.Types.ObjectId().toString();
  const var1Id = new mongoose.Types.ObjectId().toString();
  const prod2Id = new mongoose.Types.ObjectId().toString();
  const var2Id = new mongoose.Types.ObjectId().toString();

  // --------------------------------------------------------------------------
  // TEST 1: Coupon rollback failure handling
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-COUPON-FAIL',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          coupon: { code: 'SAVE10', discountAmount: 1000 },
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
      coupons: [{ code: 'SAVE10', usedCount: 5, cancellationTokens: [] }],
    });

    // Inject failure into Coupon.updateOne
    const origCouponUpdateOne = Coupon.updateOne;
    Coupon.updateOne = async () => {
      throw new Error('Database network timeout during coupon rollback');
    };

    let caughtError = null;
    try {
      await orderService.updateOrderStatus('ORD-COUPON-FAIL', { status: ORDER_STATUS.CANCELLED });
    } catch (err) {
      caughtError = err;
    }
    Coupon.updateOne = origCouponUpdateOne;

    const orderAfter = harness.orders.get(Array.from(harness.orders.keys())[0]);
    const prodAfter = harness.products.get(prod1Id);
    const couponAfter = harness.coupons.get('SAVE10');

    assert(caughtError, 'Should throw error when coupon rollback fails');
    assert.strictEqual(orderAfter.status, ORDER_STATUS.PROCESSING, 'Order must remain PROCESSING');
    assert.strictEqual(orderAfter.cancellation?.status, 'FAILED_REQUIRES_ATTENTION');
    assert.strictEqual(prodAfter.variants[0].inventory.stock, 10, 'Stock must NOT be incremented if coupon rollback failed');
    assert.strictEqual(couponAfter.usedCount, 5, 'Coupon count must not be corrupted');

    record('HARDEN-01', 'Coupon rollback failure leaves order in PROCESSING and records FAILED_REQUIRES_ATTENTION', 'PASS');
  } catch (err) {
    record('HARDEN-01', 'Coupon rollback failure handling', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: First inventory item failure
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-ITEM1-FAIL',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          coupon: { code: 'SAVE10', discountAmount: 1000 },
          items: [
            { productId: prod1Id, variantId: var1Id, quantity: 2, sku: 'SKU-1' },
            { productId: prod2Id, variantId: var2Id, quantity: 1, sku: 'SKU-2' },
          ],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 10 } }],
          cancellationTokens: [],
        },
        {
          _id: prod2Id,
          variants: [{ _id: var2Id, sku: 'SKU-2', inventory: { stock: 5 } }],
          cancellationTokens: [],
        },
      ],
      coupons: [{ code: 'SAVE10', usedCount: 3, cancellationTokens: [] }],
    });

    const origProductUpdateOne = Product.updateOne;
    Product.updateOne = async function (filter) {
      if (filter._id.toString() === prod1Id.toString()) {
        throw new Error('Disk write error on Product 1');
      }
      return origProductUpdateOne.apply(this, arguments);
    };

    let caughtError = null;
    try {
      await orderService.updateOrderStatus('ORD-ITEM1-FAIL', { status: ORDER_STATUS.CANCELLED });
    } catch (err) {
      caughtError = err;
    }
    Product.updateOne = origProductUpdateOne;

    const orderAfter = harness.orders.get(Array.from(harness.orders.keys())[0]);
    const prod1After = harness.products.get(prod1Id);
    const prod2After = harness.products.get(prod2Id);
    const couponAfter = harness.coupons.get('SAVE10');

    assert(caughtError, 'Should throw error when item 1 fails');
    assert.strictEqual(orderAfter.status, ORDER_STATUS.PROCESSING, 'Order must remain PROCESSING');
    assert.strictEqual(orderAfter.cancellation?.status, 'FAILED_REQUIRES_ATTENTION');
    assert.strictEqual(prod1After.variants[0].inventory.stock, 10, 'Product 1 stock must remain 10');
    assert.strictEqual(prod2After.variants[0].inventory.stock, 5, 'Product 2 stock must remain 5');
    assert.strictEqual(couponAfter.usedCount, 2, 'Coupon was rolled back once');

    record('HARDEN-02', 'First inventory item failure leaves order in PROCESSING without corrupting stock', 'PASS');
  } catch (err) {
    record('HARDEN-02', 'First inventory item failure', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Later inventory item failure & idempotent retry resumption
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-ITEM2-FAIL',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          coupon: { code: 'SAVE10', discountAmount: 1000 },
          items: [
            { productId: prod1Id, variantId: var1Id, quantity: 2, sku: 'SKU-1' },
            { productId: prod2Id, variantId: var2Id, quantity: 3, sku: 'SKU-2' },
          ],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 10 } }],
          cancellationTokens: [],
        },
        {
          _id: prod2Id,
          variants: [{ _id: var2Id, sku: 'SKU-2', inventory: { stock: 20 } }],
          cancellationTokens: [],
        },
      ],
      coupons: [{ code: 'SAVE10', usedCount: 5, cancellationTokens: [] }],
    });

    let attempt = 0;
    const origProductUpdateOne = Product.updateOne;
    Product.updateOne = async function (filter, update) {
      if (filter._id.toString() === prod2Id.toString() && attempt === 0) {
        attempt++;
        throw new Error('Connection closed while updating Product 2');
      }
      return origProductUpdateOne.apply(this, arguments);
    };

    // First attempt fails at item 2
    let firstError = null;
    try {
      await orderService.updateOrderStatus('ORD-ITEM2-FAIL', { status: ORDER_STATUS.CANCELLED });
    } catch (err) {
      firstError = err;
    }
    Product.updateOne = origProductUpdateOne;

    assert(firstError, 'Attempt 1 must throw');
    const prod1Mid = harness.products.get(prod1Id);
    const prod2Mid = harness.products.get(prod2Id);
    assert.strictEqual(prod1Mid.variants[0].inventory.stock, 12, 'Product 1 stock was incremented by 2');
    assert.strictEqual(prod2Mid.variants[0].inventory.stock, 20, 'Product 2 stock was untouched');

    // Second attempt: Client retries after transient failure resolved
    const secondResult = await orderService.updateOrderStatus('ORD-ITEM2-FAIL', { status: ORDER_STATUS.CANCELLED });

    assert.strictEqual(secondResult.status, ORDER_STATUS.CANCELLED);
    assert.strictEqual(secondResult.cancellation.status, 'COMPLETED');

    const prod1Final = harness.products.get(prod1Id);
    const prod2Final = harness.products.get(prod2Id);
    const couponFinal = harness.coupons.get('SAVE10');

    assert.strictEqual(prod1Final.variants[0].inventory.stock, 12, 'Product 1 stock must NOT be incremented again (exact 12)');
    assert.strictEqual(prod2Final.variants[0].inventory.stock, 23, 'Product 2 stock must be incremented by 3 (20 -> 23)');
    assert.strictEqual(couponFinal.usedCount, 4, 'Coupon must only be decremented once (5 -> 4, NOT 3)');

    record('HARDEN-03', 'Later item failure resumes on retry and restores remaining item with zero duplication', 'PASS');
  } catch (err) {
    record('HARDEN-03', 'Later inventory item failure and retry', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Process interruption after an inventory mutation (crash simulation)
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-CRASH-POST-INV',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          cancellation: {
            status: 'IN_PROGRESS',
            initiatedAt: new Date(Date.now() - 30000), // Crashed 30 seconds ago
            couponRestored: true,
            restoredItems: [
              {
                productId: prod1Id,
                variantId: var1Id,
                sku: 'SKU-1',
                quantity: 2,
                restoredAt: new Date(Date.now() - 30000),
              },
            ],
          },
          items: [
            { productId: prod1Id, variantId: var1Id, quantity: 2, sku: 'SKU-1' },
            { productId: prod2Id, variantId: var2Id, quantity: 4, sku: 'SKU-2' },
          ],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 12 } }],
          cancellationTokens: [`ORD-CRASH-POST-INV:${var1Id}:item1`],
        },
        {
          _id: prod2Id,
          variants: [{ _id: var2Id, sku: 'SKU-2', inventory: { stock: 30 } }],
          cancellationTokens: [],
        },
      ],
    });

    // Server restarted, retry is invoked
    const res = await orderService.updateOrderStatus('ORD-CRASH-POST-INV', { status: ORDER_STATUS.CANCELLED });

    assert.strictEqual(res.status, ORDER_STATUS.CANCELLED);
    assert.strictEqual(res.cancellation.status, 'COMPLETED');

    const p1 = harness.products.get(prod1Id);
    const p2 = harness.products.get(prod2Id);
    assert.strictEqual(p1.variants[0].inventory.stock, 12, 'P1 stock must remain 12');
    assert.strictEqual(p2.variants[0].inventory.stock, 34, 'P2 stock must be incremented by 4 (30 -> 34)');

    record('HARDEN-04', 'Interruption after inventory mutation resumes cleanly without duplicate restoration', 'PASS');
  } catch (err) {
    record('HARDEN-04', 'Interruption after inventory mutation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Process interruption before an inventory mutation
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-CRASH-PRE-INV',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          cancellation: {
            status: 'IN_PROGRESS',
            initiatedAt: new Date(Date.now() - 25000), // Crashed 25 seconds ago
            couponRestored: true,
            restoredItems: [], // Zero items restored yet
          },
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 5, sku: 'SKU-1' }],
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

    const res = await orderService.updateOrderStatus('ORD-CRASH-PRE-INV', { status: ORDER_STATUS.CANCELLED });
    assert.strictEqual(res.status, ORDER_STATUS.CANCELLED);

    const p1 = harness.products.get(prod1Id);
    assert.strictEqual(p1.variants[0].inventory.stock, 15, 'P1 stock incremented from 10 to 15 exactly once');

    record('HARDEN-05', 'Interruption before inventory mutation resumes and restores all items', 'PASS');
  } catch (err) {
    record('HARDEN-05', 'Interruption before inventory mutation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Process interruption during coupon recovery
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-CRASH-COUPON',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          coupon: { code: 'CRASHCODE' },
          cancellation: {
            status: 'IN_PROGRESS',
            initiatedAt: new Date(Date.now() - 20000),
            couponRestored: false,
            restoredItems: [],
          },
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
      coupons: [{ code: 'CRASHCODE', usedCount: 1, cancellationTokens: [] }],
    });

    const res = await orderService.updateOrderStatus('ORD-CRASH-COUPON', { status: ORDER_STATUS.CANCELLED });
    assert.strictEqual(res.status, ORDER_STATUS.CANCELLED);

    const coup = harness.coupons.get('CRASHCODE');
    assert.strictEqual(coup.usedCount, 0, 'Coupon restored on resumption');
    const p1 = harness.products.get(prod1Id);
    assert.strictEqual(p1.variants[0].inventory.stock, 11, 'Stock restored on resumption');

    record('HARDEN-06', 'Interruption during coupon recovery resumes and restores coupon and stock', 'PASS');
  } catch (err) {
    record('HARDEN-06', 'Interruption during coupon recovery', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Repeated recovery execution (idempotency check)
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-RECOVERY-REPEAT',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          coupon: { code: 'REPEATCODE' },
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 2, sku: 'SKU-1' }],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 50 } }],
          cancellationTokens: [],
        },
      ],
      coupons: [{ code: 'REPEATCODE', usedCount: 10, cancellationTokens: [] }],
    });

    // 1st run
    await orderService.updateOrderStatus('ORD-RECOVERY-REPEAT', { status: ORDER_STATUS.CANCELLED });
    const pAfter1 = harness.products.get(prod1Id);
    const cAfter1 = harness.coupons.get('REPEATCODE');
    assert.strictEqual(pAfter1.variants[0].inventory.stock, 52);
    assert.strictEqual(cAfter1.usedCount, 9);

    // 2nd run (duplicate cancellation request on already CANCELLED order)
    let caughtError = null;
    try {
      await orderService.updateOrderStatus('ORD-RECOVERY-REPEAT', { status: ORDER_STATUS.CANCELLED });
    } catch (err) {
      caughtError = err;
    }

    assert(caughtError, 'Duplicate request must be rejected with 409');
    assert.strictEqual(caughtError.statusCode, 409);

    const pAfter2 = harness.products.get(prod1Id);
    const cAfter2 = harness.coupons.get('REPEATCODE');
    assert.strictEqual(pAfter2.variants[0].inventory.stock, 52, 'Stock must remain 52, never incremented twice');
    assert.strictEqual(cAfter2.usedCount, 9, 'Coupon must remain 9, never decremented twice');

    record('HARDEN-07', 'Repeated execution preserves strict idempotency on stock and coupon', 'PASS');
  } catch (err) {
    record('HARDEN-07', 'Repeated recovery execution', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Two concurrent cancellation requests
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-CONCURRENT-RACE',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 3, sku: 'SKU-1' }],
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

    const p1 = orderService.updateOrderStatus('ORD-CONCURRENT-RACE', { status: ORDER_STATUS.CANCELLED });
    const p2 = orderService.updateOrderStatus('ORD-CONCURRENT-RACE', { status: ORDER_STATUS.CANCELLED });

    const settled = await Promise.allSettled([p1, p2]);
    const fulfilled = settled.filter((s) => s.status === 'fulfilled');
    const rejected = settled.filter((s) => s.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent request must succeed');
    assert.strictEqual(rejected.length, 1, 'Exactly one concurrent request must be rejected');
    assert.strictEqual(rejected[0].reason.statusCode, 409, 'Rejection must be HTTP 409 Conflict');

    const pFinal = harness.products.get(prod1Id);
    assert.strictEqual(pFinal.variants[0].inventory.stock, 103, 'Stock must only be incremented once (+3)');

    record('HARDEN-08', 'Concurrent cancellation requests lock out cleanly without double restoration', 'PASS');
  } catch (err) {
    record('HARDEN-08', 'Two concurrent cancellation requests', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Recovery after application restart
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-RESTART-RECOVER',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          cancellation: {
            status: 'FAILED_REQUIRES_ATTENTION',
            error: { message: 'Node process SIGKILL' },
            couponRestored: true,
            restoredItems: [],
          },
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-1' }],
        },
      ],
      products: [
        {
          _id: prod1Id,
          variants: [{ _id: var1Id, sku: 'SKU-1', inventory: { stock: 25 } }],
          cancellationTokens: [],
        },
      ],
    });

    const res = await orderService.cancelCustomerOrder(customerA, 'ORD-RESTART-RECOVER');
    assert.strictEqual(res.status, ORDER_STATUS.CANCELLED);
    assert.strictEqual(res.cancellation.status, 'COMPLETED');

    const p = harness.products.get(prod1Id);
    assert.strictEqual(p.variants[0].inventory.stock, 26, 'Stock restored upon restart recovery');

    record('HARDEN-09', 'Application restart recovery succeeds via customer retry', 'PASS');
  } catch (err) {
    record('HARDEN-09', 'Recovery after application restart', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Missing product or variant during restoration
  // --------------------------------------------------------------------------
  try {
    const missingProdId = new mongoose.Types.ObjectId().toString();
    const missingVarId = new mongoose.Types.ObjectId().toString();

    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-MISSING-PROD',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: missingProdId, variantId: missingVarId, quantity: 1, sku: 'MISSING-SKU' }],
        },
      ],
      products: [], // Product does not exist
    });

    let caughtError = null;
    try {
      await orderService.updateOrderStatus('ORD-MISSING-PROD', { status: ORDER_STATUS.CANCELLED });
    } catch (err) {
      caughtError = err;
    }

    assert(caughtError, 'Must throw error when product is missing');
    assert.strictEqual(caughtError.statusCode, 500);
    assert.strictEqual(caughtError.code, 'CANCELLATION_RECOVERY_FAILED');

    const orderAfter = harness.orders.get(Array.from(harness.orders.keys())[0]);
    assert.strictEqual(orderAfter.status, ORDER_STATUS.PROCESSING, 'Order must NOT be marked CANCELLED');
    assert.strictEqual(orderAfter.cancellation.status, 'FAILED_REQUIRES_ATTENTION');
    assert(orderAfter.cancellation.error.message.includes('not found'), 'Error message must record missing product details');

    record('HARDEN-10', 'Missing product captures diagnostic info and marks FAILED_REQUIRES_ATTENTION', 'PASS');
  } catch (err) {
    record('HARDEN-10', 'Missing product or variant during restoration', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Duplicate customer cancellation
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-CUST-DUP',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.CANCELLED,
          cancellation: { status: 'COMPLETED' },
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-1' }],
        },
      ],
    });

    let caughtError = null;
    try {
      await orderService.cancelCustomerOrder(customerA, 'ORD-CUST-DUP');
    } catch (err) {
      caughtError = err;
    }

    assert(caughtError);
    assert.strictEqual(caughtError.statusCode, 409);
    assert.strictEqual(caughtError.code, 'ORDER_ALREADY_CANCELLED');

    record('HARDEN-11', 'Duplicate customer cancellation is rejected with 409 Conflict', 'PASS');
  } catch (err) {
    record('HARDEN-11', 'Duplicate customer cancellation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Admin cancellation compatibility
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-ADMIN-CANCEL',
          userId: customerA,
          isDemo: false,
          status: ORDER_STATUS.CONFIRMED,
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
    });

    const adminCancelled = await orderService.updateOrderStatus(
      'ORD-ADMIN-CANCEL',
      { status: ORDER_STATUS.CANCELLED, note: 'Admin phone request' },
      adminUser
    );

    assert.strictEqual(adminCancelled.status, ORDER_STATUS.CANCELLED);
    assert.strictEqual(adminCancelled.cancellation.status, 'COMPLETED');

    const p = harness.products.get(prod1Id);
    assert.strictEqual(p.variants[0].inventory.stock, 17, 'Admin cancellation restores inventory accurately');

    record('HARDEN-12', 'Admin cancellation maintains full compatibility with hardened recovery', 'PASS');
  } catch (err) {
    record('HARDEN-12', 'Admin cancellation compatibility', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 13: Demo order isolation
  // --------------------------------------------------------------------------
  try {
    const harness = createInMemoryHarness({
      orders: [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'DEMO-20261101-001',
          userId: customerA,
          isDemo: true,
          status: ORDER_STATUS.PROCESSING,
          items: [{ productId: prod1Id, variantId: var1Id, quantity: 1, sku: 'SKU-1' }],
        },
      ],
    });

    let caughtError = null;
    try {
      await orderService.cancelCustomerOrder(customerA, 'DEMO-20261101-001');
    } catch (err) {
      caughtError = err;
    }

    assert(caughtError);
    assert.strictEqual(caughtError.statusCode, 400);
    assert.strictEqual(caughtError.code, 'DEMO_ORDER_NOT_ALLOWED');

    record('HARDEN-13', 'Demo order cancellation is strictly rejected via customer endpoint', 'PASS');
  } catch (err) {
    record('HARDEN-13', 'Demo order isolation', 'FAIL', err.message);
  }

  console.log('\n======================================================================');
  console.log('                 PHASE 6B.2 TEST RESULTS SUMMARY                      ');
  console.log('======================================================================');
  console.table(results);

  const failed = results.filter((r) => r.status === 'FAIL');
  if (failed.length > 0) {
    console.error(`\n✖ ${failed.length} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\n✔ All ${results.length} Phase 6B.2 Hardened Recovery tests passed!`);
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
