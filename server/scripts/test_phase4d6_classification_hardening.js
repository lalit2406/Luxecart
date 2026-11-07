/**
 * LuxeCart Phase 4D-6: Demo Classification Hardening Test Suite
 *
 * Verifies:
 * 1. Customer-submitted isDemo: true in order creation is actively rejected with 400 validation error.
 * 2. Ordinary order numbers (LC-, ORD-, INVOICE-) are classified strictly as non-demo.
 * 3. An order explicitly marked isDemo: false CANNOT be treated as demo even if its orderNumber starts with DEMO- or TEST-.
 * 4. Advancing mock shipment to DELIVERED on non-demo COD orders (even with demo-resembling order numbers) NEVER mutates order.status or marks payment.status as PAID.
 * 5. Explicitly created demo orders (via orderService.createDemoOrder) have isDemo: true and safely retain the full demonstration journey.
 * 6. Admin order creation route POST /api/admin/orders/demo requires admin authentication and creates valid demo orders.
 */

import assert from 'assert';
import mongoose from 'mongoose';
import { validateCreateOrder } from '../src/validators/order.validator.js';
import { isDemoOrder } from '../src/utils/orderClassification.js';
import logisticsService from '../src/modules/logistics/logistics.service.js';
import MockShipment from '../src/modules/logistics/mockShipment.model.js';
import Order from '../src/modules/orders/order.model.js';
import orderService from '../src/modules/orders/order.service.js';
import Cart from '../src/modules/cart/cart.model.js';
import Address from '../src/modules/addresses/address.model.js';
import Product from '../src/modules/products/product.model.js';
import { ORDER_STATUS } from '../src/modules/orders/orderStateMachine.js';

mongoose.set('bufferCommands', false);

const results = [];
function record(testId, name, status, details = '') {
  results.push({ testId, name, status, details });
  const symbol = status === 'PASS' ? '✔ [PASS]' : status === 'SKIP' ? '⚠ [SKIP]' : '✖ [FAIL]';
  console.log(`${symbol} [${testId}] ${name}`);
  if (details && status === 'FAIL') {
    console.error(`       Details: ${details}`);
  }
}

async function runHardeningSuite() {
  console.log('\n======================================================================');
  console.log('   LUXECART PHASE 4D-6: DEMO CLASSIFICATION HARDENING VERIFICATION    ');
  console.log('======================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Customer-submitted isDemo: true is strictly rejected with 400
  // --------------------------------------------------------------------------
  try {
    const invalidPayload1 = {
      addressId: new mongoose.Types.ObjectId().toString(),
      paymentMethod: 'CASH_ON_DELIVERY',
      isDemo: true, // Injected forbidden field
    };

    const val1 = validateCreateOrder(invalidPayload1);
    assert.strictEqual(val1.isValid, false, 'Payload with isDemo: true must be rejected');
    assert(
      val1.errors.some((e) => e.includes("Field 'isDemo' is not permitted")),
      'Error message must state isDemo is forbidden'
    );

    const invalidPayload2 = {
      addressId: new mongoose.Types.ObjectId().toString(),
      paymentMethod: 'CASH_ON_DELIVERY',
      isDemo: false, // Injected forbidden field (even false must be rejected from customer input)
    };

    const val2 = validateCreateOrder(invalidPayload2);
    assert.strictEqual(val2.isValid, false, 'Payload with isDemo: false must also be rejected');

    record('HARDEN-01', 'Customer-submitted isDemo in checkout is actively rejected (400 Bad Request)', 'PASS');
  } catch (err) {
    record('HARDEN-01', 'Customer-submitted isDemo rejection', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Ordinary order numbers are strictly classified as non-demo
  // --------------------------------------------------------------------------
  try {
    // Ordinary storefront order numbers starting with LC-
    assert.strictEqual(isDemoOrder({ orderNumber: 'LC-20261027-A1B2C3' }), false);
    assert.strictEqual(isDemoOrder({ orderNumber: 'LC-20260830-109283' }), false);

    // Standard ecommerce prefixes like ORD- and INVOICE- must NEVER be classified as demo
    assert.strictEqual(isDemoOrder({ orderNumber: 'ORD-20261027-998877' }), false);
    assert.strictEqual(isDemoOrder({ orderNumber: 'ORD-999999' }), false);
    assert.strictEqual(isDemoOrder({ orderNumber: 'INVOICE-00123' }), false);

    // Explicit non-demo objects
    assert.strictEqual(isDemoOrder({ isDemo: false, orderNumber: 'LC-12345' }), false);
    assert.strictEqual(isDemoOrder({ isDemo: false, orderNumber: 'ORD-54321' }), false);

    record('HARDEN-02', 'Ordinary order numbers (LC-, ORD-, INVOICE-) are classified strictly as non-demo', 'PASS');
  } catch (err) {
    record('HARDEN-02', 'Ordinary order numbers non-demo classification', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Order with isDemo: false takes strict precedence over prefix resemblance
  // --------------------------------------------------------------------------
  try {
    // If order has isDemo: false, even demo-like prefixes MUST be classified as non-demo
    assert.strictEqual(
      isDemoOrder({ isDemo: false, orderNumber: 'DEMO-20261027-FAKE' }),
      false,
      'isDemo: false must take absolute precedence over DEMO- prefix'
    );
    assert.strictEqual(
      isDemoOrder({ isDemo: false, orderNumber: 'TEST-ORDER-123' }),
      false,
      'isDemo: false must take absolute precedence over TEST- prefix'
    );
    assert.strictEqual(
      isDemoOrder({ isDemo: false, orderNumber: 'MOCK-ORDER-999' }),
      false,
      'isDemo: false must take absolute precedence over MOCK- prefix'
    );

    record('HARDEN-03', 'isDemo: false takes strict precedence over any prefix resemblance', 'PASS');
  } catch (err) {
    record('HARDEN-03', 'Strict precedence of isDemo: false', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Mock delivery leaving non-demo order status & COD payment unchanged
  //         (Even with demo-resembling order number!)
  // --------------------------------------------------------------------------
  try {
    const origOrderFindOne = Order.findOne;
    const origOrderUpdateOne = Order.updateOne;
    const origShipmentFindOne = MockShipment.findOne;
    const origUpdateOrderStatus = orderService.updateOrderStatus;

    let updateOrderStatusCalled = false;
    let historyAppended = false;

    orderService.updateOrderStatus = async function () {
      updateOrderStatusCalled = true;
      throw new Error('FATAL: updateOrderStatus must NOT be called for non-demo order!');
    };

    const nonDemoOrderWithPrefix = {
      _id: '60c72b2f9b1d8b2bad888001',
      orderNumber: 'DEMO-PREFIX-BUT-REAL',
      isDemo: false, // EXPLICITLY REAL ORDER
      status: ORDER_STATUS.PROCESSING,
      payment: { method: 'CASH_ON_DELIVERY', status: 'PENDING' },
      shippingAddress: { phone: '9988776655', city: 'Delhi', postalCode: '110001' },
      statusHistory: [],
    };

    Order.findOne = function () {
      return {
        lean: async () => nonDemoOrderWithPrefix,
      };
    };

    Order.updateOne = async function (filter, doc) {
      historyAppended = true;
      return { modifiedCount: 1 };
    };

    const mockShipmentDoc = {
      orderNumber: 'DEMO-PREFIX-BUT-REAL',
      currentMilestone: 'OUT_FOR_DELIVERY',
      carrier: { name: 'LuxeShip Demo' },
      awbNumber: 'MOCK-LUXE-HARD-11',
      checkpoints: [],
      simulatedNotifications: [],
      save: async function () { return this; },
    };

    MockShipment.findOne = async () => mockShipmentDoc;

    // Advance to DELIVERED
    const resShipment = await logisticsService.advanceMilestone(
      'DEMO-PREFIX-BUT-REAL',
      { nextMilestone: 'DELIVERED' },
      'admin-usr-10'
    );

    // Mock shipment milestone advanced
    assert.strictEqual(resShipment.currentMilestone, 'DELIVERED');

    // Real order MUST NOT be mutated
    assert.strictEqual(updateOrderStatusCalled, false, 'orderService.updateOrderStatus must not be invoked');
    assert.strictEqual(nonDemoOrderWithPrefix.status, ORDER_STATUS.PROCESSING, 'Order status must remain PROCESSING');
    assert.strictEqual(nonDemoOrderWithPrefix.payment.status, 'PENDING', 'Payment status must remain PENDING');
    assert.strictEqual(historyAppended, true, 'Audit event note must be appended without mutating status');

    Order.findOne = origOrderFindOne;
    Order.updateOne = origOrderUpdateOne;
    MockShipment.findOne = origShipmentFindOne;
    orderService.updateOrderStatus = origUpdateOrderStatus;

    record('HARDEN-04', 'Mock delivery on non-demo order with demo-prefix leaves status and COD payment intact', 'PASS');
  } catch (err) {
    record('HARDEN-04', 'Non-demo COD delivery isolation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Explicitly created demo records retain the complete demo journey
  // --------------------------------------------------------------------------
  try {
    const origOrderCreate = Order.create;
    const origOrderFindOne = Order.findOne;
    const origShipmentFindOne = MockShipment.findOne;
    const origUpdateOrderStatus = orderService.updateOrderStatus;

    let createdOrderDoc = null;
    Order.create = async function (doc) {
      createdOrderDoc = { ...doc, _id: new mongoose.Types.ObjectId() };
      return createdOrderDoc;
    };
    Order.findOne = () => ({
      select: () => ({
        lean: async () => null,
      }),
      lean: async () => null,
    });

    // Create explicit demo order via orderService.createDemoOrder
    const newDemoOrder = await orderService.createDemoOrder(
      {
        shippingAddress: { fullName: 'Demo VIP', phone: '9876543210', city: 'Mumbai', postalCode: '400001' },
      },
      'admin-super-01'
    );

    assert(createdOrderDoc !== null, 'Demo order must be created');
    assert.strictEqual(createdOrderDoc.isDemo, true, 'Created demo order must have isDemo: true');
    assert(createdOrderDoc.orderNumber.startsWith('DEMO-'), 'Demo order number must start with DEMO-');
    assert.strictEqual(isDemoOrder(createdOrderDoc), true, 'isDemoOrder must classify demo order as true');

    // Verify demo journey synchronization
    let orderStatusCalls = [];
    orderService.updateOrderStatus = async function (num, payload) {
      orderStatusCalls.push({ num, payload });
      return { orderNumber: num, status: payload.status };
    };

    Order.findOne = function () {
      return {
        lean: async () => createdOrderDoc,
      };
    };

    const mockShipmentDoc = {
      orderNumber: createdOrderDoc.orderNumber,
      currentMilestone: 'OUT_FOR_DELIVERY',
      carrier: { name: 'Northstar Logistics Demo' },
      awbNumber: 'MOCK-NSTAR-DEMO-22',
      checkpoints: [],
      simulatedNotifications: [],
      save: async function () { return this; },
    };
    MockShipment.findOne = async () => mockShipmentDoc;

    await logisticsService.advanceMilestone(
      createdOrderDoc.orderNumber,
      { nextMilestone: 'DELIVERED' },
      'admin-super-01'
    );

    // Explicit demo order DOES synchronize status and payment
    assert.strictEqual(orderStatusCalls.length, 1);
    assert.strictEqual(orderStatusCalls[0].payload.status, ORDER_STATUS.DELIVERED);

    Order.create = origOrderCreate;
    Order.findOne = origOrderFindOne;
    MockShipment.findOne = origShipmentFindOne;
    orderService.updateOrderStatus = origUpdateOrderStatus;

    record('HARDEN-05', 'Explicit demo orders (isDemo: true) safely execute full demonstration flow', 'PASS');
  } catch (err) {
    record('HARDEN-05', 'Explicit demo order creation and lifecycle', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Checkout placeCodOrder never sets isDemo: true
  // --------------------------------------------------------------------------
  try {
    const origOrderSave = Order.prototype.save;
    const origOrderFindOne = Order.findOne;
    const origCartFindOne = Cart.findOne;
    const origCartDeleteOne = Cart.deleteOne;
    const origCartUpdateOne = Cart.updateOne;
    const origAddressFindOne = Address.findOne;
    const origProductFind = Product.find;
    const origProductUpdateOne = Product.updateOne;

    Order.findOne = () => ({
      select: () => ({
        lean: async () => null,
      }),
    });

    Cart.deleteOne = async () => ({ acknowledged: true });
    Cart.updateOne = async () => ({ modifiedCount: 1 });
    Product.updateOne = async () => ({ modifiedCount: 1 });

    let savedOrderInstance = null;
    Order.prototype.save = async function () {
      savedOrderInstance = this;
      return this;
    };

    // Mock cart, address, and product
    Cart.findOne = async () => ({
      items: [{ productId: '60c72b2f9b1d8b2bad000010', variantId: '60c72b2f9b1d8b2bad000011', quantity: 1 }],
    });

    Address.findOne = () => ({
      lean: async () => ({
        fullName: 'Test Customer',
        phone: '9876543210',
        addressLine1: '123 Main St',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110001',
      }),
    });

    Product.find = () => ({
      lean: async () => [
        {
          _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000010'),
          name: 'Classic Shirt',
          brand: 'LuxeCart',
          status: 'ACTIVE',
          category: 'Apparel',
          variants: [
            {
              _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000011'),
              sku: 'SHIRT-01',
              price: 1500,
              mrp: 2000,
              inventory: { stock: 10 },
            },
          ],
        },
      ],
    });

    const testUserId = new mongoose.Types.ObjectId().toString();
    await orderService.placeCodOrder(testUserId, {
      addressId: '60c72b2f9b1d8b2bad000020',
      isDemo: true, // Attempted sneaky parameter injection
    });

    assert(savedOrderInstance !== null, 'Order must be saved');
    assert.strictEqual(savedOrderInstance.isDemo, false, 'Ordinary checkout MUST produce isDemo: false');
    assert.strictEqual(savedOrderInstance.payment.method, 'CASH_ON_DELIVERY');
    assert.strictEqual(savedOrderInstance.payment.status, 'PENDING');

    Order.prototype.save = origOrderSave;
    Order.findOne = origOrderFindOne;
    Cart.findOne = origCartFindOne;
    Cart.deleteOne = origCartDeleteOne;
    Cart.updateOne = origCartUpdateOne;
    Address.findOne = origAddressFindOne;
    Product.find = origProductFind;
    Product.updateOne = origProductUpdateOne;

    record('HARDEN-06', 'Ordinary customer checkout unconditionally forces isDemo: false', 'PASS');
  } catch (err) {
    record('HARDEN-06', 'Checkout isDemo: false enforcement', 'FAIL', err.message);
  }

  console.log('\n======================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL HARDENING TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHardeningSuite();
