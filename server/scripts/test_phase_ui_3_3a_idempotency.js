import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../src/modules/products/product.model.js';
import Category from '../src/modules/categories/category.model.js';
import User from '../src/modules/users/user.model.js';
import Address from '../src/modules/addresses/address.model.js';
import Order from '../src/modules/orders/order.model.js';
import Cart from '../src/modules/cart/cart.model.js';
import Coupon from '../src/modules/coupons/coupon.model.js';
import cartService from '../src/modules/cart/cart.service.js';
import orderService from '../src/modules/orders/order.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runIdempotencyTests() {
  console.log('================================================================');
  console.log('   LUXECART PHASE UI-3.3A CHECKOUT IDEMPOTENCY TEST SUITE       ');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✔ Connected to MongoDB.\n');

  const results = [];
  function record(id, name, status, details = {}) {
    results.push({ id, name, status, details });
    const mark = status === 'PASS' ? '✔ [PASS]' : status === 'FAIL' ? '✖ [FAIL]' : '○ [NOT TESTED]';
    console.log(`${mark} [${id}] ${name}`);
    if (status !== 'PASS') {
      console.log('       Details:', details);
    }
  }

  let testCategoryId = null;
  let testProductId = null;
  let testVariantId = null;
  let testVariant2Id = null;
  let testUserId = null;
  let testAddressId = null;
  let testCouponCode = null;
  const initialStock = 10;

  try {
    const timestamp = Date.now();

    // 1. Create fixtures
    const cat = await Category.create({
      name: `Idempotency Test Cat ${timestamp}`,
      slug: `idemp-test-cat-${timestamp}`,
      level: 0,
    });
    testCategoryId = cat._id;

    const prod = await Product.create({
      name: `Idempotency Test Loafers ${timestamp}`,
      slug: `idemp-test-loafers-${timestamp}`,
      brand: 'LuxeCart Signature',
      category: cat._id,
      categoryTree: [cat._id],
      gender: 'UNISEX',
      description: 'Comprehensive test fixture for idempotency',
      shortDescription: 'Idempotency test product',
      status: 'ACTIVE',
      images: [{ url: 'https://res.cloudinary.com/luxecart-india/image/upload/v1/test.jpg', isPrimary: true, alt: 'Test' }],
      variants: [
        {
          sku: `SKU-IDEMP-A-${timestamp}`,
          price: 24000,
          mrp: 30000,
          inventory: { stock: initialStock, lowStockThreshold: 2 },
          attributes: { size: 'UK 9', color: { name: 'Cognac', hex: '#8B4513' } },
          isActive: true,
        },
        {
          sku: `SKU-IDEMP-B-${timestamp}`,
          price: 26000,
          mrp: 32000,
          inventory: { stock: initialStock, lowStockThreshold: 2 },
          attributes: { size: 'UK 10', color: { name: 'Espresso', hex: '#3B2219' } },
          isActive: true,
        },
      ],
      tags: ['idempotency', 'test'],
    });
    testProductId = prod._id;
    testVariantId = prod.variants[0]._id;
    testVariant2Id = prod.variants[1]._id;

    const user = await User.create({
      name: 'Idemp Tester',
      email: `idemp_user_${timestamp}@example.com`,
      password: 'Password123!@#',
      role: 'CUSTOMER',
    });
    testUserId = user._id;

    const addr = await Address.create({
      userId: user._id,
      fullName: 'Idemp Tester',
      phone: '9876543210',
      addressLine1: '42 Test Promenade',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
      isDefault: true,
    });
    testAddressId = addr._id;

    testCouponCode = `IDEMP10_${timestamp}`;
    await Coupon.create({
      code: testCouponCode,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderValue: 100,
      usageLimit: 5,
      usedCount: 0,
      startDate: new Date(Date.now() - 86400000),
      expirationDate: new Date(Date.now() + 86400000),
      isActive: true,
    });

    // -------------------------------------------------------------------------
    // TEST 1: Initial order creation with idempotency key
    // -------------------------------------------------------------------------
    await cartService.addItem(
      testUserId,
      testProductId.toString(),
      testVariantId.toString(),
      1
    );

    const key1 = `idemp-key-single-${timestamp}`;
    const order1 = await orderService.placeCodOrder(testUserId, {
      addressId: testAddressId.toString(),
      idempotencyKey: key1,
      couponCode: testCouponCode,
    });

    if (order1 && order1._id && order1.orderNumber && order1.idempotencyKey === key1) {
      record('IDEMP-01', 'Initial order created with idempotency key', 'PASS', { orderNumber: order1.orderNumber });
    } else {
      record('IDEMP-01', 'Initial order created with idempotency key', 'FAIL', { order1 });
    }

    // -------------------------------------------------------------------------
    // TEST 2: Repeated submission with identical key returns existing order
    // -------------------------------------------------------------------------
    // Even if cart was cleared, calling placeCodOrder with same idempotencyKey returns existing order
    const order1Retry = await orderService.placeCodOrder(testUserId, {
      addressId: testAddressId.toString(),
      idempotencyKey: key1,
      couponCode: testCouponCode,
    });

    const totalOrdersWithKey1 = await Order.countDocuments({ userId: testUserId, idempotencyKey: key1 });
    if (
      order1Retry &&
      order1Retry._id.toString() === order1._id.toString() &&
      order1Retry.orderNumber === order1.orderNumber &&
      totalOrdersWithKey1 === 1
    ) {
      record('IDEMP-02', 'Repeated submission with identical key returns existing order (deduplication)', 'PASS');
    } else {
      record('IDEMP-02', 'Repeated submission with identical key returns existing order (deduplication)', 'FAIL', {
        sameId: order1Retry?._id?.toString() === order1._id.toString(),
        totalOrdersWithKey1,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 3: Inventory stock deducted exactly once across retries
    // -------------------------------------------------------------------------
    const updatedProdAfterRetry = await Product.findById(testProductId).lean();
    const v1Stock = updatedProdAfterRetry.variants.find((v) => v._id.toString() === testVariantId.toString()).inventory.stock;
    if (v1Stock === initialStock - 1) {
      record('IDEMP-03', 'Inventory stock decremented exactly once across retries', 'PASS', {
        initialStock,
        currentStock: v1Stock,
      });
    } else {
      record('IDEMP-03', 'Inventory stock decremented exactly once across retries', 'FAIL', {
        expected: initialStock - 1,
        actual: v1Stock,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 4: Coupon usage reserved exactly once across retries
    // -------------------------------------------------------------------------
    const updatedCoupon = await Coupon.findOne({ code: testCouponCode }).lean();
    if (updatedCoupon.usedCount === 1) {
      record('IDEMP-04', 'Coupon usage incremented exactly once across retries', 'PASS', {
        usedCount: updatedCoupon.usedCount,
      });
    } else {
      record('IDEMP-04', 'Coupon usage incremented exactly once across retries', 'FAIL', {
        expected: 1,
        actual: updatedCoupon.usedCount,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 5: Concurrent requests with identical idempotency key resolve safely
    // -------------------------------------------------------------------------
    // Reset cart for concurrent test
    await cartService.addItem(
      testUserId,
      testProductId.toString(),
      testVariantId.toString(),
      1
    );

    const concurrentKey = `idemp-concurrent-${timestamp}`;
    const concurrentPromises = [
      orderService.placeCodOrder(testUserId, {
        addressId: testAddressId.toString(),
        idempotencyKey: concurrentKey,
      }),
      orderService.placeCodOrder(testUserId, {
        addressId: testAddressId.toString(),
        idempotencyKey: concurrentKey,
      }),
      orderService.placeCodOrder(testUserId, {
        addressId: testAddressId.toString(),
        idempotencyKey: concurrentKey,
      }),
    ];

    const concurrentResults = await Promise.allSettled(concurrentPromises);
    const fulfilled = concurrentResults.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const rejected = concurrentResults.filter((r) => r.status === 'rejected').map((r) => r.reason);

    const allFulfilled = fulfilled.length === 3;
    const allSameOrder = allFulfilled && fulfilled.every((o) => o._id.toString() === fulfilled[0]._id.toString());
    const orderDocCount = await Order.countDocuments({ userId: testUserId, idempotencyKey: concurrentKey });

    if (allSameOrder && orderDocCount === 1) {
      record('IDEMP-05', 'Concurrent requests with identical idempotency key safely return single order without E11000 error', 'PASS');
    } else {
      record('IDEMP-05', 'Concurrent requests with identical idempotency key safely return single order without E11000 error', 'FAIL', {
        fulfilledCount: fulfilled.length,
        rejectedCount: rejected.length,
        rejections: rejected.map((err) => err?.message),
        orderDocCount,
      });
    }

    // Check stock after concurrent calls (should be decremented by 1 more, so initialStock - 2)
    const prodAfterConcurrent = await Product.findById(testProductId).lean();
    const v1StockAfterConcurrent = prodAfterConcurrent.variants.find((v) => v._id.toString() === testVariantId.toString()).inventory.stock;
    if (v1StockAfterConcurrent === initialStock - 2) {
      record('IDEMP-06', 'Concurrent requests do not double-decrement inventory', 'PASS', {
        expected: initialStock - 2,
        actual: v1StockAfterConcurrent,
      });
    } else {
      record('IDEMP-06', 'Concurrent requests do not double-decrement inventory', 'FAIL', {
        expected: initialStock - 2,
        actual: v1StockAfterConcurrent,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 7: Payload/cart item change creates a distinct order with a new key
    // -------------------------------------------------------------------------
    await cartService.addItem(
      testUserId,
      testProductId.toString(),
      testVariant2Id.toString(),
      2
    );

    const key2 = `idemp-key-new-payload-${timestamp}`;
    const order2 = await orderService.placeCodOrder(testUserId, {
      addressId: testAddressId.toString(),
      idempotencyKey: key2,
    });

    if (
      order2 &&
      order2._id.toString() !== order1._id.toString() &&
      order2.idempotencyKey === key2 &&
      order2.items.length === 1 &&
      order2.items[0].sku === `SKU-IDEMP-B-${timestamp}` &&
      order2.items[0].quantity === 2
    ) {
      record('IDEMP-07', 'Distinct idempotency key with modified cart creates fresh distinct order', 'PASS');
    } else {
      record('IDEMP-07', 'Distinct idempotency key with modified cart creates fresh distinct order', 'FAIL', {
        order2,
      });
    }

  } catch (err) {
    console.error('Test execution error:', err);
    record('FATAL', 'Test execution completed without uncaught exceptions', 'FAIL', { error: err.message });
  } finally {
    // Cleanup fixtures
    if (testUserId) {
      await Order.deleteMany({ userId: testUserId });
      await Cart.deleteMany({ userId: testUserId });
      await Address.deleteMany({ userId: testUserId });
      await User.findByIdAndDelete(testUserId);
    }
    if (testProductId) {
      await Product.findByIdAndDelete(testProductId);
    }
    if (testCategoryId) {
      await Category.findByIdAndDelete(testCategoryId);
    }
    if (testCouponCode) {
      await Coupon.deleteMany({ code: testCouponCode });
    }

    await mongoose.disconnect();
    console.log('\n✔ Disconnected from MongoDB.');
  }

  console.log('\n================================================================');
  console.log('   IDEMPOTENCY TEST RESULTS SUMMARY                             ');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runIdempotencyTests();
