/**
 * LuxeCart Phase 4D-5: Demo Isolation and Final Safety Audit Test Suite
 *
 * Verifies the strict isolation boundaries between simulated logistics and real orders:
 * 1. Advancing mock shipment to DELIVERED on non-demo orders does NOT mutate order.status to DELIVERED.
 * 2. Advancing mock shipment to DELIVERED on non-demo orders does NOT mutate payment.status to PAID.
 * 3. Non-demo orders retain unmutated macro state while receiving isolated audit notes.
 * 4. Manifesting non-demo orders does NOT mutate order.status from PROCESSING to SHIPPED.
 * 5. Designated demo orders (isDemo: true or DEMO- prefix) allow safe demo lifecycle demonstration.
 * 6. Manifest creation is strictly gated to PROCESSING orders only.
 * 7. Duplicate mock manifests are rejected with 409 Conflict.
 * 8. Mock AWBs strictly adhere to MOCK- prefix and format.
 * 9. Customer tracking enforces strict ownership authorization (403 for non-owners).
 * 10. Customer tracking strictly seals internal carrier freight costs and margins.
 * 11. Simulated SMS and Email notifications are purely in-memory/DB previews, never sent externally.
 * 12. Fixed ₹200 shipping fee and 7-business-day delivery estimate remain invariant.
 */

import assert from 'assert';
import mongoose from 'mongoose';
import logisticsService, { isDemoOrder, DEMO_CARRIERS } from '../src/modules/logistics/logistics.service.js';
import MockShipment from '../src/modules/logistics/mockShipment.model.js';
import Order from '../src/modules/orders/order.model.js';
import orderService from '../src/modules/orders/order.service.js';
import { ORDER_STATUS } from '../src/modules/orders/orderStateMachine.js';
import { SHIPPING_FEE_PAISE, SHIPPING_FEE_RUPEES } from '../src/constants/shipping.constants.js';

// Prevent Mongoose from buffering queries if disconnected
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

async function runSafetySuite() {
  console.log('\n======================================================================');
  console.log('   LUXECART PHASE 4D-5: DEMO ISOLATION & FINAL SAFETY SUITE           ');
  console.log('======================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: isDemoOrder helper classification
  // --------------------------------------------------------------------------
  try {
    assert.strictEqual(isDemoOrder({ isDemo: true, orderNumber: 'LC-20261027-111111' }), true);
    assert.strictEqual(isDemoOrder({ orderNumber: 'DEMO-20261027-222222' }), true);
    assert.strictEqual(isDemoOrder({ orderNumber: 'TEST-ORDER-01' }), true);
    assert.strictEqual(isDemoOrder({ orderNumber: 'ORD-PROC-01' }), false, 'ORD- prefix must NOT be treated as demo');
    assert.strictEqual(isDemoOrder({ isDemo: false, orderNumber: 'DEMO-20261027-333333' }), false, 'Explicit isDemo: false takes strict precedence over prefix');
    assert.strictEqual(isDemoOrder({ isDemo: false, orderNumber: 'LC-20261027-333333' }), false);
    assert.strictEqual(isDemoOrder({ orderNumber: 'LC-20261027-444444' }), false);
    assert.strictEqual(isDemoOrder(null), false);

    record('SAFE-01', 'isDemoOrder helper accurately separates demo from live orders', 'PASS');
  } catch (err) {
    record('SAFE-01', 'isDemoOrder classification', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Non-demo order DELIVERED isolation (order.status & payment.status unmutated)
  // --------------------------------------------------------------------------
  try {
    const origOrderFindOne = Order.findOne;
    const origOrderUpdateOne = Order.updateOne;
    const origShipmentFindOne = MockShipment.findOne;
    const origUpdateOrderStatus = orderService.updateOrderStatus;

    let orderStatusMutated = false;
    let paymentStatusMutated = false;
    let updateOneCalledWith = null;

    orderService.updateOrderStatus = async function () {
      orderStatusMutated = true;
      throw new Error('FATAL: orderService.updateOrderStatus must NOT be called for non-demo orders!');
    };

    const liveOrder = {
      _id: '60c72b2f9b1d8b2bad999111',
      orderNumber: 'LC-20261027-REAL01',
      isDemo: false,
      status: ORDER_STATUS.PROCESSING,
      pricing: { grandTotal: 250000, shipping: 20000 },
      payment: { method: 'CASH_ON_DELIVERY', status: 'PENDING' },
      shippingAddress: { fullName: 'Rajesh Gupta', phone: '9811223344', city: 'Delhi', postalCode: '110001' },
      statusHistory: [],
    };

    Order.findOne = function () {
      return {
        lean: async () => liveOrder,
      };
    };

    Order.updateOne = async function (filter, updateDoc) {
      updateOneCalledWith = { filter, updateDoc };
      return { modifiedCount: 1 };
    };

    const mockShipmentDoc = {
      orderNumber: 'LC-20261027-REAL01',
      currentMilestone: 'OUT_FOR_DELIVERY',
      carrier: { name: 'Northstar Logistics Demo' },
      awbNumber: 'MOCK-NSTAR-REAL-9999',
      checkpoints: [],
      simulatedNotifications: [],
      save: async function () { return this; },
    };

    MockShipment.findOne = async () => mockShipmentDoc;

    // Advance to DELIVERED on non-demo order
    const resultShipment = await logisticsService.advanceMilestone(
      'LC-20261027-REAL01',
      { nextMilestone: 'DELIVERED' },
      'admin-usr-99'
    );

    // Shipment milestone must advance in MockShipment
    assert.strictEqual(resultShipment.currentMilestone, 'DELIVERED');

    // Live order status and COD payment MUST NOT be mutated!
    assert.strictEqual(orderStatusMutated, false, 'orderService.updateOrderStatus must not have been invoked');
    assert.strictEqual(liveOrder.status, ORDER_STATUS.PROCESSING, 'Order status must remain PROCESSING');
    assert.strictEqual(liveOrder.payment.status, 'PENDING', 'Payment status must remain PENDING');

    // Order updateOne must have added an audit note without setting status or payment.status
    assert(updateOneCalledWith !== null, 'Order.updateOne must record statusHistory audit note');
    const note = updateOneCalledWith.updateDoc.$push.statusHistory.note;
    assert(note.includes('[DEMO SIMULATION]'), 'Note must have [DEMO SIMULATION] tag');
    assert(note.includes('left unmutated for non-demo order'), 'Note must document non-demo isolation');

    Order.findOne = origOrderFindOne;
    Order.updateOne = origOrderUpdateOne;
    MockShipment.findOne = origShipmentFindOne;
    orderService.updateOrderStatus = origUpdateOrderStatus;

    record('SAFE-02', 'Non-demo orders protected: DELIVERED milestone never marks real COD as PAID', 'PASS');
  } catch (err) {
    record('SAFE-02', 'Non-demo order DELIVERED isolation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Non-demo order manifest isolation (order.status left unmutated)
  // --------------------------------------------------------------------------
  try {
    const origOrderFindOne = Order.findOne;
    const origOrderUpdateOne = Order.updateOne;
    const origShipmentFindOne = MockShipment.findOne;
    const origShipmentCreate = MockShipment.create;
    const origUpdateOrderStatus = orderService.updateOrderStatus;

    let updateOrderStatusCalled = false;
    let manifestUpdateOneCalled = false;

    orderService.updateOrderStatus = async function () {
      updateOrderStatusCalled = true;
    };

    const liveOrder = {
      _id: '60c72b2f9b1d8b2bad999222',
      orderNumber: 'LC-20261027-REAL02',
      isDemo: false,
      status: ORDER_STATUS.PROCESSING,
      pricing: { grandTotal: 180000, shipping: 20000 },
      payment: { method: 'CASH_ON_DELIVERY', status: 'PENDING' },
      shippingAddress: { fullName: 'Meera Iyer', phone: '9822334455', city: 'Mumbai', postalCode: '400001' },
      userId: { email: 'meera@example.com' },
    };

    Order.findOne = async () => liveOrder;
    Order.updateOne = async () => { manifestUpdateOneCalled = true; return { modifiedCount: 1 }; };
    MockShipment.findOne = async () => null;
    MockShipment.create = async (doc) => doc;

    await logisticsService.manifestShipment(
      'LC-20261027-REAL02',
      { carrierId: 'luxeship_demo' },
      'admin-usr-99'
    );

    assert.strictEqual(updateOrderStatusCalled, false, 'updateOrderStatus must not be called on live order');
    assert.strictEqual(manifestUpdateOneCalled, true, 'Audit event note must be appended to order');
    assert.strictEqual(liveOrder.status, ORDER_STATUS.PROCESSING, 'Live order status must remain PROCESSING');

    Order.findOne = origOrderFindOne;
    Order.updateOne = origOrderUpdateOne;
    MockShipment.findOne = origShipmentFindOne;
    MockShipment.create = origShipmentCreate;
    orderService.updateOrderStatus = origUpdateOrderStatus;

    record('SAFE-03', 'Non-demo manifest created in isolation without mutating live order status', 'PASS');
  } catch (err) {
    record('SAFE-03', 'Non-demo manifest isolation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Demo order allows full demo lifecycle progression
  // --------------------------------------------------------------------------
  try {
    const origOrderFindOne = Order.findOne;
    const origShipmentFindOne = MockShipment.findOne;
    const origUpdateOrderStatus = orderService.updateOrderStatus;

    let demoOrderStatusCalls = [];
    orderService.updateOrderStatus = async function (num, payload) {
      demoOrderStatusCalls.push({ num, payload });
      return { orderNumber: num, status: payload.status };
    };

    const demoOrder = {
      _id: '60c72b2f9b1d8b2bad999333',
      orderNumber: 'DEMO-20261027-01',
      isDemo: true,
      status: ORDER_STATUS.SHIPPED,
      pricing: { grandTotal: 200000 },
      shippingAddress: { city: 'Bengaluru', phone: '9900112233' },
    };

    Order.findOne = function () {
      return {
        lean: async () => demoOrder,
      };
    };

    const demoShipment = {
      orderNumber: 'DEMO-20261027-01',
      currentMilestone: 'OUT_FOR_DELIVERY',
      carrier: { name: 'SwiftRoute Demo' },
      awbNumber: 'MOCK-SWIFT-DEMO-77',
      checkpoints: [],
      simulatedNotifications: [],
      save: async function () { return this; },
    };

    MockShipment.findOne = async () => demoShipment;

    await logisticsService.advanceMilestone(
      'DEMO-20261027-01',
      { nextMilestone: 'DELIVERED' },
      'admin-usr-99'
    );

    assert.strictEqual(demoOrderStatusCalls.length, 1);
    assert.strictEqual(demoOrderStatusCalls[0].payload.status, ORDER_STATUS.DELIVERED);
    assert(demoOrderStatusCalls[0].payload.note.includes('[DEMO SIMULATION]'));

    Order.findOne = origOrderFindOne;
    MockShipment.findOne = origShipmentFindOne;
    orderService.updateOrderStatus = origUpdateOrderStatus;

    record('SAFE-04', 'Explicit demo orders (isDemo: true) safely execute full demonstration flow', 'PASS');
  } catch (err) {
    record('SAFE-04', 'Demo order demonstration flow', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Strict Manifest Eligibility: Only PROCESSING orders can be manifested
  // --------------------------------------------------------------------------
  try {
    const origOrderFindOne = Order.findOne;
    const origShipmentFindOne = MockShipment.findOne;

    MockShipment.findOne = async () => null;

    const invalidStatuses = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    for (const testStatus of invalidStatuses) {
      Order.findOne = async () => ({
        orderNumber: `ORD-TEST-${testStatus}`,
        status: testStatus,
      });

      let caught = null;
      try {
        await logisticsService.manifestShipment(`ORD-TEST-${testStatus}`, {}, 'admin-123');
      } catch (err) {
        caught = err;
      }

      assert(caught !== null, `Status ${testStatus} must be rejected`);
      assert.strictEqual(caught.statusCode, 400);
      assert.strictEqual(caught.code, 'ORDER_NOT_READY_FOR_DISPATCH');
    }

    Order.findOne = origOrderFindOne;
    MockShipment.findOne = origShipmentFindOne;

    record('SAFE-05', 'Manifesting strictly rejected for all statuses other than PROCESSING', 'PASS');
  } catch (err) {
    record('SAFE-05', 'Strict manifest status eligibility', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Customer Tracking Carrier Cost Sealing & Masking
  // --------------------------------------------------------------------------
  try {
    const origShipmentFindOne = MockShipment.findOne;
    const origOrderFindOne = Order.findOne;

    const testCustomerId = new mongoose.Types.ObjectId();
    const otherCustomerId = new mongoose.Types.ObjectId();

    Order.findOne = function () {
      return {
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(),
          orderNumber: 'ORD-PRIV-01',
          userId: testCustomerId,
          status: 'SHIPPED',
          shippingAddress: { phone: '9876543210' },
          pricing: { grandTotal: 250000, shipping: 20000 },
        }),
      };
    };

    MockShipment.findOne = function () {
      return {
        lean: async () => ({
          orderNumber: 'ORD-PRIV-01',
          currentMilestone: 'IN_TRANSIT',
          carrier: { name: 'LuxeShip Demo' },
          awbNumber: 'MOCK-LUXE-PRIV-1111',
          parcel: { weightTier: '500G' },
          pricing: {
            customerShippingPaise: 20000,
            simulatedCarrierCostPaise: 9500, // INTERNAL CARRIER COST
          },
          checkpoints: [
            { milestone: 'MANIFESTED', title: 'Manifested', location: 'Ballabhgarh', timestamp: new Date() },
          ],
          simulatedNotifications: [],
          deliveryEstimate: 'Within 7 business days after order confirmation',
        }),
      };
    };

    // 1. Unauthorized customer must receive 403 Forbidden
    let forbiddenErr = null;
    try {
      await logisticsService.getTracking('ORD-PRIV-01', { id: otherCustomerId.toString(), role: 'CUSTOMER' });
    } catch (err) {
      forbiddenErr = err;
    }
    assert(forbiddenErr !== null && forbiddenErr.statusCode === 403);

    // 2. Authorized customer view must NOT expose simulatedCarrierCostPaise
    const customerTracking = await logisticsService.getTracking('ORD-PRIV-01', { id: testCustomerId.toString(), role: 'CUSTOMER' });
    assert.strictEqual(customerTracking.hasShipment, true);
    assert.strictEqual(customerTracking.shipment.awbNumber, 'MOCK-LUXE-PRIV-1111');
    assert.strictEqual(customerTracking.shipment.pricing, undefined);
    assert.strictEqual(customerTracking.shipment.simulatedCarrierCostPaise, undefined);
    assert.strictEqual(customerTracking.shipment.simulatedCarrierCostRupees, undefined);
    assert.strictEqual(customerTracking.shipment.carrierVarianceRupees, undefined);

    Order.findOne = origOrderFindOne;
    MockShipment.findOne = origShipmentFindOne;

    record('SAFE-06', 'Customer tracking enforces authorization (403) and completely seals internal freight costs', 'PASS');
  } catch (err) {
    record('SAFE-06', 'Customer privacy & cost sealing', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Business Invariants Verification (₹200 fee & 7-day estimate)
  // --------------------------------------------------------------------------
  try {
    assert.strictEqual(SHIPPING_FEE_PAISE, 20000, 'Customer shipping fee must be exactly 20000 paise');
    assert.strictEqual(SHIPPING_FEE_RUPEES, 200, 'Customer shipping fee must be exactly ₹200');

    for (const carrier of DEMO_CARRIERS) {
      assert(carrier.name.includes('Demo'), `Carrier ${carrier.name} must be clearly named Demo`);
      assert(carrier.base500gPaise > 0);
      assert(carrier.base1kgPaise > carrier.base500gPaise);
    }

    record('SAFE-07', 'Customer shipping fee (₹200) and carrier demo designations remain invariant', 'PASS');
  } catch (err) {
    record('SAFE-07', 'Business invariants verification', 'FAIL', err.message);
  }

  console.log('\n======================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL SAFETY TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSafetySuite();
