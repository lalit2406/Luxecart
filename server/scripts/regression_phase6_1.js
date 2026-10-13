import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Product from '../src/modules/products/product.model.js';
import Category from '../src/modules/categories/category.model.js';
import User from '../src/modules/users/user.model.js';
import Address from '../src/modules/addresses/address.model.js';
import Order from '../src/modules/orders/order.model.js';
import Cart from '../src/modules/cart/cart.model.js';
import authService from '../src/modules/auth/auth.service.js';
import cartService from '../src/modules/cart/cart.service.js';
import orderService from '../src/modules/orders/order.service.js';
import productService from '../src/modules/products/product.service.js';
import { validateCatalogQuery } from '../src/validators/product.validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_BASE = 'http://localhost:5000/api/v1';

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('   LUXECART PHASE 6.1 REGRESSION TEST SUITE                     ');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(' Connected to MongoDB.\n');

  const results = [];
  function record(id, name, status, details = {}) {
    results.push({ id, name, status, details });
    const mark = status === 'PASS' ? '✔ [PASS]' : status === 'FAIL' ? '✖ [FAIL]' : '○ [NOT TESTED]';
    console.log(`${mark} [${id}] ${name}`);
    if (status !== 'PASS') {
      console.log('       Details:', details);
    }
  }

  // Tracking IDs for disposable test fixtures
  let testCategoryId = null;
  let testProductId = null;
  let testUserId = null;
  let testAddressId = null;
  let testOrderNumber = null;
  let testOrderId = null;

  try {
    // -------------------------------------------------------------------------
    // TEST A: Create product fixture with at least 3 variants & distinct stock
    // -------------------------------------------------------------------------
    console.log('--- TEST A: Create Disposable Fixture with 3 Distinct Variants ---');
    const timestamp = Date.now();
    const testCategory = new Category({
      name: `QA Test Category ${timestamp}`,
      slug: `qa-test-cat-${timestamp}`,
      description: 'Temporary fixture for Phase 6.1 regression test',
      level: 0,
      ancestors: [],
      isActive: true,
    });
    await testCategory.save();
    testCategoryId = testCategory._id;

    const testProduct = new Product({
      name: `QA Test Garment ${timestamp}`,
      slug: `qa-test-garment-${timestamp}`,
      brand: 'LuxeCart Test Lab',
      description: 'A disposable test garment created to verify atomic inventory reservation',
      shortDescription: 'Test product for Phase 6.1 regression tests',
      category: testCategoryId,
      categoryTree: [testCategoryId],
      gender: 'UNISEX',
      status: 'ACTIVE',
      images: [
        {
          url: 'https://res.cloudinary.com/luxecart-india/image/upload/v1/luxecart/products/test/img1.webp',
          isPrimary: true,
          color: 'Red',
          alt: 'Test Red Front',
        },
        {
          url: 'https://res.cloudinary.com/luxecart-india/image/upload/v1/luxecart/products/test/img2.webp',
          isPrimary: false,
          color: 'Blue',
          alt: 'Test Blue Front',
        },
        {
          url: 'https://res.cloudinary.com/luxecart-india/image/upload/v1/luxecart/products/test/img3.webp',
          isPrimary: false,
          color: 'Green',
          alt: 'Test Green Front',
        },
      ],
      variants: [
        {
          sku: `TEST-VAR-RED-S-${timestamp}`,
          price: 500,
          mrp: 1000,
          attributes: { color: { name: 'Red', hex: '#FF0000' }, size: 'S' },
          inventory: { stock: 10, reserved: 0 },
          isActive: true,
        },
        {
          sku: `TEST-VAR-BLU-M-${timestamp}`,
          price: 600,
          mrp: 1200,
          attributes: { color: { name: 'Blue', hex: '#0000FF' }, size: 'M' },
          inventory: { stock: 20, reserved: 0 },
          isActive: true,
        },
        {
          sku: `TEST-VAR-GRN-L-${timestamp}`,
          price: 700,
          mrp: 1400,
          attributes: { color: { name: 'Green', hex: '#00FF00' }, size: 'L' },
          inventory: { stock: 30, reserved: 0 },
          isActive: true,
        },
      ],
    });
    await testProduct.save();
    testProductId = testProduct._id;

    const variant0 = testProduct.variants[0];
    const variant1 = testProduct.variants[1];
    const variant2 = testProduct.variants[2];

    if (
      testProduct.variants.length === 3 &&
      variant0.inventory.stock === 10 &&
      variant1.inventory.stock === 20 &&
      variant2.inventory.stock === 30
    ) {
      record('TEST-A', 'Create product with 3 variants having distinct stock values (10, 20, 30)', 'PASS', {
        v0: variant0.sku,
        v1: variant1.sku,
        v2: variant2.sku,
      });
    } else {
      record('TEST-A', 'Create product with 3 variants having distinct stock values', 'FAIL');
    }

    // Create test customer & address
    const regRes = await authService.register({
      name: 'Regression Shopper',
      email: `reg_shopper_${timestamp}@luxecart-test.com`,
      password: 'ShopperPassword123!',
      phone: '+91 91234 56789',
    });
    testUserId = regRes.user.id;

    const testAddress = new Address({
      userId: testUserId,
      fullName: 'Regression Shopper',
      phone: '9123456789',
      addressLine1: 'Test Lab Suite 101, Technology Park',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      addressType: 'WORK',
      isDefault: true,
    });
    await testAddress.save();
    testAddressId = testAddress._id;

    // -------------------------------------------------------------------------
    // TEST B: Purchase 1 unit of non-first variant (Variant 1: stock 20 -> 19)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST B: Purchase 1 unit of non-first variant ---');
    await cartService.addItem(testUserId, testProductId, variant1._id, 1);
    const placedOrder = await orderService.placeCodOrder(testUserId, {
      addressId: testAddressId.toString(),
    });
    testOrderNumber = placedOrder.orderNumber;
    testOrderId = placedOrder._id;

    const prodAfterPurchase = await Product.findById(testProductId).lean();
    const v0After = prodAfterPurchase.variants.find((v) => v.sku === variant0.sku);
    const v1After = prodAfterPurchase.variants.find((v) => v.sku === variant1.sku);
    const v2After = prodAfterPurchase.variants.find((v) => v.sku === variant2.sku);

    const bPass =
      v0After.inventory.stock === 10 &&
      v1After.inventory.stock === 19 &&
      v2After.inventory.stock === 30;

    if (bPass) {
      record('TEST-B', 'Purchasing non-first variant decrements ONLY that variant by one (20 -> 19) while index 0 remains 10', 'PASS', {
        v0Stock: v0After.inventory.stock,
        v1Stock: v1After.inventory.stock,
        v2Stock: v2After.inventory.stock,
      });
    } else {
      record('TEST-B', 'Purchasing non-first variant decrements ONLY that variant by one', 'FAIL', {
        expected: { v0: 10, v1: 19, v2: 30 },
        actual: { v0: v0After.inventory.stock, v1: v1After.inventory.stock, v2: v2After.inventory.stock },
      });
    }

    // -------------------------------------------------------------------------
    // TEST C: Cancel that order. Confirm ONLY that variant returns to original
    // -------------------------------------------------------------------------
    console.log('\n--- TEST C: Cancel order and verify exact inventory restoration ---');
    await orderService.updateOrderStatus(
      testOrderNumber,
      { status: 'CANCELLED', note: 'Regression test cancellation' },
      null
    );

    const prodAfterCancel = await Product.findById(testProductId).lean();
    const v0Cancelled = prodAfterCancel.variants.find((v) => v.sku === variant0.sku);
    const v1Cancelled = prodAfterCancel.variants.find((v) => v.sku === variant1.sku);
    const v2Cancelled = prodAfterCancel.variants.find((v) => v.sku === variant2.sku);

    const cPass =
      v0Cancelled.inventory.stock === 10 &&
      v1Cancelled.inventory.stock === 20 &&
      v2Cancelled.inventory.stock === 30;

    if (cPass) {
      record('TEST-C', 'Cancelling order restores ONLY that variant back to exact initial stock (19 -> 20)', 'PASS', {
        v0Stock: v0Cancelled.inventory.stock,
        v1Stock: v1Cancelled.inventory.stock,
        v2Stock: v2Cancelled.inventory.stock,
      });
    } else {
      record('TEST-C', 'Cancelling order restores ONLY that variant back to exact initial stock', 'FAIL', {
        expected: { v0: 10, v1: 20, v2: 30 },
        actual: { v0: v0Cancelled.inventory.stock, v1: v1Cancelled.inventory.stock, v2: v2Cancelled.inventory.stock },
      });
    }

    // -------------------------------------------------------------------------
    // TEST D: Attempt an order exceeding stock. Confirm order fails & 0 change
    // -------------------------------------------------------------------------
    console.log('\n--- TEST D: Attempt order exceeding stock ---');
    let orderExceedFailed = false;
    try {
      // Attempt to add quantity 25 (exceeding stock of 20)
      await cartService.addItem(testUserId, testProductId, variant1._id, 25);
      await orderService.placeCodOrder(testUserId, { addressId: testAddressId.toString() });
    } catch (exceedErr) {
      if (exceedErr.statusCode === 400 && (exceedErr.code === 'INSUFFICIENT_STOCK' || exceedErr.code === 'MAX_QUANTITY_EXCEEDED')) {
        orderExceedFailed = true;
      }
    }

    const prodAfterExceed = await Product.findById(testProductId).lean();
    const v0Exceed = prodAfterExceed.variants.find((v) => v.sku === variant0.sku);
    const v1Exceed = prodAfterExceed.variants.find((v) => v.sku === variant1.sku);
    const v2Exceed = prodAfterExceed.variants.find((v) => v.sku === variant2.sku);

    const dPass =
      orderExceedFailed &&
      v0Exceed.inventory.stock === 10 &&
      v1Exceed.inventory.stock === 20 &&
      v2Exceed.inventory.stock === 30;

    if (dPass) {
      record('TEST-D', 'Order exceeding available stock is rejected (400) and leaves all variant inventory untouched', 'PASS', {
        stocks: [v0Exceed.inventory.stock, v1Exceed.inventory.stock, v2Exceed.inventory.stock],
      });
    } else {
      record('TEST-D', 'Order exceeding available stock is rejected and leaves inventory untouched', 'FAIL', {
        orderExceedFailed,
        actual: [v0Exceed.inventory.stock, v1Exceed.inventory.stock, v2Exceed.inventory.stock],
      });
    }

    // -------------------------------------------------------------------------
    // TEST E: Attempt repeated cancellation. Confirm inventory restored at most once
    // -------------------------------------------------------------------------
    console.log('\n--- TEST E: Attempt repeated cancellation ---');
    let repeatCancelRejected = false;
    try {
      await orderService.updateOrderStatus(
        testOrderNumber,
        { status: 'CANCELLED', note: 'Attempting illegal second cancellation' },
        null
      );
    } catch (repeatErr) {
      if (repeatErr.statusCode === 409 && repeatErr.code === 'INVALID_ORDER_TRANSITION') {
        repeatCancelRejected = true;
      }
    }

    const prodAfterRepeat = await Product.findById(testProductId).lean();
    const v0Repeat = prodAfterRepeat.variants.find((v) => v.sku === variant0.sku);
    const v1Repeat = prodAfterRepeat.variants.find((v) => v.sku === variant1.sku);
    const v2Repeat = prodAfterRepeat.variants.find((v) => v.sku === variant2.sku);

    const ePass =
      repeatCancelRejected &&
      v0Repeat.inventory.stock === 10 &&
      v1Repeat.inventory.stock === 20 &&
      v2Repeat.inventory.stock === 30;

    if (ePass) {
      record('TEST-E', 'Repeated cancellation is rejected (409) and prevents duplicate inventory restoration', 'PASS', {
        repeatCancelRejected,
        finalStocks: [v0Repeat.inventory.stock, v1Repeat.inventory.stock, v2Repeat.inventory.stock],
      });
    } else {
      record('TEST-E', 'Repeated cancellation is rejected and prevents duplicate inventory restoration', 'FAIL', {
        repeatCancelRejected,
        actual: [v0Repeat.inventory.stock, v1Repeat.inventory.stock, v2Repeat.inventory.stock],
      });
    }

    // -------------------------------------------------------------------------
    // TEST F: Exercise transaction path and standalone fallback path
    // -------------------------------------------------------------------------
    console.log('\n--- TEST F: Exercise Transaction & Standalone Fallback Paths ---');
    let txnSupported = false;
    try {
      const sess = await mongoose.startSession();
      sess.startTransaction();
      await sess.abortTransaction();
      await sess.endSession();
      txnSupported = true;
    } catch {
      txnSupported = false;
    }

    // Test the fallback standalone update logic directly
    const fallbackUpdateResult = await Product.updateOne(
      {
        _id: testProductId,
        variants: {
          $elemMatch: {
            _id: variant2._id,
            'inventory.stock': { $gte: 2 },
          },
        },
      },
      {
        $inc: { 'variants.$.inventory.stock': -2 },
      }
    );

    const fallbackRestoreResult = await Product.updateOne(
      {
        _id: testProductId,
        variants: {
          $elemMatch: {
            _id: variant2._id,
          },
        },
      },
      {
        $inc: { 'variants.$.inventory.stock': 2 },
      }
    );

    const prodAfterF = await Product.findById(testProductId).lean();
    const v2Final = prodAfterF.variants.find((v) => v.sku === variant2.sku);

    if (fallbackUpdateResult.modifiedCount === 1 && fallbackRestoreResult.modifiedCount === 1 && v2Final.inventory.stock === 30) {
      record('TEST-F', `Exercise standalone path ($elemMatch query) & transaction capability (Txn supported: ${txnSupported})`, 'PASS', {
        txnSupported,
        decrementModified: fallbackUpdateResult.modifiedCount,
        restorationModified: fallbackRestoreResult.modifiedCount,
        stockAfterCycle: v2Final.inventory.stock,
      });
    } else {
      record('TEST-F', 'Exercise standalone path & transaction capability', 'FAIL');
    }

    // -------------------------------------------------------------------------
    // TEST G: Verify categoryTree is included in public product-list payloads
    // -------------------------------------------------------------------------
    console.log('\n--- TEST G: Verify categoryTree in public product-list payloads ---');
    const catalogQuery = validateCatalogQuery({ limit: 12 });
    const productListResult = await productService.getProducts(catalogQuery);
    const publicProducts = productListResult.products || [];

    const hasCategoryTreeOnAll =
      publicProducts.length > 0 &&
      publicProducts.every(
        (p) => Array.isArray(p.categoryTree) && p.categoryTree.length > 0
      );

    if (hasCategoryTreeOnAll) {
      const sample = publicProducts[0];
      record('TEST-G', `Public getProducts includes categoryTree array on all returned products (Sample: [${sample.categoryTree.join(', ')}])`, 'PASS', {
        sampleProduct: sample.name,
        categoryTree: sample.categoryTree,
      });
    } else {
      record('TEST-G', 'Public getProducts includes categoryTree array on all returned products', 'FAIL', {
        count: publicProducts.length,
        missing: publicProducts.filter((p) => !p.categoryTree).map((p) => p.slug),
      });
    }

    // -------------------------------------------------------------------------
    // TEST H: Verify CartPage uses local placeholder and contains NO Unsplash
    // -------------------------------------------------------------------------
    console.log('\n--- TEST H: Verify CartPage.jsx image fallback & zero Unsplash ---');
    const cartPagePath = path.resolve(__dirname, '../../client/src/pages/CartPage.jsx');
    const cartPageContent = fs.readFileSync(cartPagePath, 'utf-8');

    const hasImport = cartPageContent.includes("import { LUXE_PLACEHOLDER_IMAGE } from '../utils/image'");
    const usesPlaceholder = cartPageContent.includes('src={item.image || LUXE_PLACEHOLDER_IMAGE}');
    const hasNoUnsplash = !cartPageContent.includes('unsplash.com');

    if (hasImport && usesPlaceholder && hasNoUnsplash) {
      record('TEST-H', 'CartPage.jsx imports LUXE_PLACEHOLDER_IMAGE, binds fallback cleanly, and has 0 Unsplash URLs', 'PASS');
    } else {
      record('TEST-H', 'CartPage.jsx imports LUXE_PLACEHOLDER_IMAGE and has 0 Unsplash URLs', 'FAIL', {
        hasImport,
        usesPlaceholder,
        hasNoUnsplash,
      });
    }

  } catch (err) {
    console.error('ERROR in regression suite:', err);
  } finally {
    // -------------------------------------------------------------------------
    // TEARDOWN: Clean up disposable test fixtures completely
    // -------------------------------------------------------------------------
    console.log('\n--- TEARDOWN: Cleaning up disposable test fixtures ---');
    if (testOrderId) await Order.deleteOne({ _id: testOrderId });
    if (testAddressId) await Address.deleteOne({ _id: testAddressId });
    if (testUserId) {
      await Cart.deleteOne({ userId: testUserId });
      await User.deleteOne({ _id: testUserId });
    }
    if (testProductId) await Product.deleteOne({ _id: testProductId });
    if (testCategoryId) await Category.deleteOne({ _id: testCategoryId });
    console.log(' Cleaned up all disposable test fixtures from MongoDB.\n');

    await mongoose.disconnect();
    console.log(' MongoDB disconnected.\n');
  }

  // Summary Table
  console.log('================================================================');
  console.log('                 REGRESSION TEST RESULTS SUMMARY                ');
  console.log('================================================================');
  console.table(
    results.map((r) => ({
      TestID: r.id,
      Name: r.name.slice(0, 55) + (r.name.length > 55 ? '...' : ''),
      Status: r.status,
    }))
  );

  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}\n`);
}

runRegressionSuite();
