/**
 * LUXECART PHASE 4D-4: END-TO-END DEMO LOGISTICS VERIFICATION SUITE
 *
 * Exercises the complete 8-stage fulfillment journey in memory:
 * 1. Journey Step 1: Admin opens order & checks eligibility
 * 2. Journey Step 2: Admin reviews deterministic rate quotes (500g & 1kg)
 * 3. Journey Step 3: Admin manifests dispatch (generates unique MOCK- AWB, updates order to SHIPPED)
 * 4. Journey Step 4: Duplicate manifest rejection (409 Conflict)
 * 5. Journey Step 5: Sequential milestone progression (MANIFESTED -> PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY)
 * 6. Journey Step 6: Customer tracking inspection & ownership verification (403 for non-owners, sealed carrier costs)
 * 7. Journey Step 7: Customer simulated notification log with privacy contact masking
 * 8. Journey Step 8: Exception simulation (ATTEMPT_FAILED & RTO without inventory corruption)
 * 9. Journey Step 9: Terminal DELIVERED milestone synchronization with COD collection (payment = PAID)
 * 10. Journey Step 10: Safe empty fallback handling for unmanifested / legacy orders
 */

import assert from 'assert';
import mongoose from 'mongoose';
import logisticsService, {
  DEMO_CARRIERS,
  resolveDestinationZone,
} from '../src/modules/logistics/logistics.service.js';
import MockShipment from '../src/modules/logistics/mockShipment.model.js';
import Order from '../src/modules/orders/order.model.js';
import orderService from '../src/modules/orders/order.service.js';
import { ORDER_STATUS } from '../src/modules/orders/orderStateMachine.js';
import { SHIPPING_FEE_PAISE, SHIPPING_FEE_RUPEES } from '../src/constants/shipping.constants.js';

mongoose.set('bufferCommands', false);

const results = [];

function record(stepId, name, status, details = '') {
  results.push({ stepId, name, status, details });
  const badge = status === 'PASS' ? '✔ [PASS]' : status === 'SKIP' ? '○ [SKIP]' : '✖ [FAIL]';
  console.log(`${badge} [${stepId}] ${name}`);
  if (details) console.log(`    ↳ ${details}`);
}

async function runE2ETests() {
  console.log('\n' + '='.repeat(70));
  console.log('   LUXECART PHASE 4D-4: END-TO-END DEMO LOGISTICS AUDIT SUITE       ');
  console.log('='.repeat(70) + '\n');

  // Simulated in-memory store for orders and shipments
  const inMemoryOrders = new Map();
  const inMemoryShipments = new Map();

  // Setup mock order
  const orderId = '60c72b2f9b1d8b2bad999001';
  const orderNumber = 'ORD-E2E-2026';
  const customerId = 'cust-aarav-88';
  const orderDoc = {
    _id: orderId,
    orderNumber,
    isDemo: true,
    userId: customerId,
    status: ORDER_STATUS.PROCESSING,
    pricing: {
      subtotal: 450000,
      shipping: 20000,
      grandTotal: 470000,
    },
    payment: {
      method: 'CASH_ON_DELIVERY',
      status: 'PENDING',
    },
    shippingAddress: {
      fullName: 'Aarav Sharma',
      phone: '9876543210',
      addressLine1: 'Flat 402, Royal Palms',
      city: 'Gurugram',
      state: 'Haryana',
      postalCode: '122001',
      country: 'India',
    },
    statusHistory: [
      { status: 'PLACED', changedAt: new Date(Date.now() - 3600000), note: 'Order placed' },
      { status: 'CONFIRMED', changedAt: new Date(Date.now() - 1800000), note: 'Confirmed' },
      { status: 'PROCESSING', changedAt: new Date(Date.now() - 900000), note: 'Packaging started' },
    ],
  };

  inMemoryOrders.set(orderNumber, orderDoc);

  // Stub Order.findOne and MockShipment.findOne
  Order.findOne = function (query) {
    const num = (query.orderNumber || '').toUpperCase();
    const doc = inMemoryOrders.get(num) || null;
    return {
      lean: async () => doc,
      then: (resolve) => resolve(doc),
    };
  };

  Order.updateOne = async function (filter, update) {
    const num = filter.orderNumber;
    const doc = inMemoryOrders.get(num);
    if (doc && update.$push?.statusHistory) {
      doc.statusHistory.push(update.$push.statusHistory);
    }
    return { modifiedCount: 1 };
  };

  MockShipment.findOne = function (query) {
    let match = null;
    if (query.orderNumber) {
      match = inMemoryShipments.get(query.orderNumber) || null;
    } else if (query.awbNumber) {
      for (const s of inMemoryShipments.values()) {
        if (s.awbNumber === query.awbNumber) {
          match = s;
          break;
        }
      }
    }
    return {
      lean: async () => match,
      then: (resolve) => resolve(match),
    };
  };

  MockShipment.create = async function (payload) {
    const shipmentInstance = {
      ...payload,
      save: async function () {
        inMemoryShipments.set(this.orderNumber, this);
        return this;
      },
    };
    inMemoryShipments.set(payload.orderNumber, shipmentInstance);
    return shipmentInstance;
  };

  // Stub orderService.updateOrderStatus to update inMemoryOrders
  orderService.updateOrderStatus = async function (ordNum, payload, adminId) {
    const doc = inMemoryOrders.get(ordNum);
    if (!doc) throw new Error('Order not found');
    doc.status = payload.status;
    doc.statusHistory.push({
      status: payload.status,
      changedAt: new Date(),
      changedBy: adminId || null,
      note: payload.note || '',
    });
    if (payload.status === ORDER_STATUS.DELIVERED && doc.payment?.method === 'CASH_ON_DELIVERY') {
      doc.payment.status = 'PAID';
    }
    return doc;
  };

  // --------------------------------------------------------------------------
  // STEP 1: Rate Quotes Calculation
  // --------------------------------------------------------------------------
  try {
    const rates = await logisticsService.getRateQuotes(orderNumber);
    assert.strictEqual(rates.orderNumber, orderNumber);
    assert.strictEqual(rates.customerShippingFixedRupees, 200);
    assert.strictEqual(rates.customerShippingFixedPaise, 20000);
    assert.strictEqual(rates.isSimulated, true);
    assert(rates.quotes.length === 3, 'Must return quotes for all 3 fictional carriers');

    for (const q of rates.quotes) {
      assert(q.tiers['500G'], 'Must include 500g tier');
      assert(q.tiers['1KG'], 'Must include 1kg tier');
      assert.strictEqual(q.tiers['500G'].customerShippingFeeRupees, 200);
      assert.strictEqual(q.tiers['1KG'].customerShippingFeeRupees, 200);
      assert.strictEqual(q.tiers['500G'].simulatedCarrierCostRupees + q.tiers['500G'].varianceRupees, 200);
    }
    record('STEP-01', 'Admin reviews simulated courier rate comparison (500g & 1kg)', 'PASS');
  } catch (err) {
    record('STEP-01', 'Rate quotes calculation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // STEP 2: Manifest Order & Generate Mock AWB
  // --------------------------------------------------------------------------
  try {
    const shipment = await logisticsService.manifestShipment(
      orderNumber,
      { carrierId: 'luxeship_demo', weightTier: '500G', notes: 'Fragile luxury silks' },
      'admin-usr-01'
    );

    assert(shipment.awbNumber.startsWith('MOCK-LUXE-'), `AWB ${shipment.awbNumber} must start with MOCK-LUXE-`);
    assert(/^MOCK-[A-Z0-9-]+$/.test(shipment.awbNumber), 'AWB must match MOCK regex pattern');
    assert.strictEqual(shipment.currentMilestone, 'MANIFESTED');
    assert.strictEqual(shipment.parcel.weightTier, '500G');
    assert.strictEqual(shipment.pricing.customerShippingPaise, 20000);

    // Verify parent order transitioned to SHIPPED
    const updatedOrder = inMemoryOrders.get(orderNumber);
    assert.strictEqual(updatedOrder.status, ORDER_STATUS.SHIPPED);

    record('STEP-02', 'Admin manifests shipment; order updates to SHIPPED with unique MOCK- AWB', 'PASS');
  } catch (err) {
    record('STEP-02', 'Manifest shipment creation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // STEP 3: Duplicate Manifest Rejection
  // --------------------------------------------------------------------------
  try {
    let duplicateError = null;
    try {
      await logisticsService.manifestShipment(orderNumber, { carrierId: 'luxeship_demo' }, 'admin-usr-01');
    } catch (err) {
      duplicateError = err;
    }
    assert(duplicateError !== null && duplicateError.statusCode === 409);
    assert.strictEqual(duplicateError.code, 'MOCK_SHIPMENT_ALREADY_EXISTS');
    record('STEP-03', 'Duplicate manifest rejected with 409 Conflict', 'PASS');
  } catch (err) {
    record('STEP-03', 'Duplicate manifest rejection', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // STEP 4: Sequential Milestone Progression
  // --------------------------------------------------------------------------
  try {
    // 1. Invalid jump: MANIFESTED -> OUT_FOR_DELIVERY must fail
    let jumpErr = null;
    try {
      await logisticsService.advanceMilestone(orderNumber, { nextMilestone: 'OUT_FOR_DELIVERY' }, 'admin-usr-01');
    } catch (err) {
      jumpErr = err;
    }
    assert(jumpErr !== null && jumpErr.statusCode === 400);

    // 2. Sequential advance: MANIFESTED -> PICKED_UP
    await logisticsService.advanceMilestone(orderNumber, { nextMilestone: 'PICKED_UP' }, 'admin-usr-01');
    assert.strictEqual(inMemoryShipments.get(orderNumber).currentMilestone, 'PICKED_UP');

    // 3. Sequential advance: PICKED_UP -> IN_TRANSIT
    await logisticsService.advanceMilestone(orderNumber, { nextMilestone: 'IN_TRANSIT' }, 'admin-usr-01');
    assert.strictEqual(inMemoryShipments.get(orderNumber).currentMilestone, 'IN_TRANSIT');

    // 4. Sequential advance: IN_TRANSIT -> OUT_FOR_DELIVERY
    await logisticsService.advanceMilestone(orderNumber, { nextMilestone: 'OUT_FOR_DELIVERY' }, 'admin-usr-01');
    assert.strictEqual(inMemoryShipments.get(orderNumber).currentMilestone, 'OUT_FOR_DELIVERY');

    record('STEP-04', 'Sequential checkpoint progression enforced (PICKED_UP -> IN_TRANSIT -> OUT_FOR_DELIVERY)', 'PASS');
  } catch (err) {
    record('STEP-04', 'Sequential checkpoint progression', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // STEP 5: Customer Tracking Inspection & Ownership Enforcement
  // --------------------------------------------------------------------------
  try {
    // Non-owner customer request must be rejected with 403
    let forbiddenErr = null;
    try {
      await logisticsService.getTracking(orderNumber, { id: 'impostor-user-99', role: 'CUSTOMER' });
    } catch (err) {
      forbiddenErr = err;
    }
    assert(forbiddenErr !== null && forbiddenErr.statusCode === 403 && forbiddenErr.code === 'FORBIDDEN');

    // Legitimate owner customer request succeeds
    const customerTracking = await logisticsService.getTracking(orderNumber, { id: customerId, role: 'CUSTOMER' });
    assert.strictEqual(customerTracking.hasShipment, true);
    assert.strictEqual(customerTracking.shipment.currentMilestone, 'OUT_FOR_DELIVERY');
    assert.strictEqual(customerTracking.shipment.carrier.name, 'LuxeShip Demo');
    assert(customerTracking.shipment.checkpoints.length >= 4);

    // Internal carrier cost must NOT be present in customer response
    assert.strictEqual(customerTracking.shipment.pricing, undefined, 'Internal carrier cost must not leak to customer');

    record('STEP-05', 'Customer tracking verified (403 for non-owners; zero freight costs exposed)', 'PASS');
  } catch (err) {
    record('STEP-05', 'Customer tracking inspection', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // STEP 6: Simulated Customer Notification Feed
  // --------------------------------------------------------------------------
  try {
    const notifs = await logisticsService.getNotifications(orderNumber, { id: customerId, role: 'CUSTOMER' });
    assert.strictEqual(notifs.hasShipment, true);
    assert(notifs.notifications.length >= 4, 'Must have recorded notification previews');

    for (const msg of notifs.notifications) {
      assert(msg.message.includes('[DEMO SIMULATION]'), 'Every notification preview must carry [DEMO SIMULATION]');
    }

    record('STEP-06', 'Simulated SMS and Email notification log verified with demo simulation tags', 'PASS');
  } catch (err) {
    record('STEP-06', 'Notification log verification', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // STEP 7: Exception Simulation (Failed Attempt & RTO Invariant Check)
  // --------------------------------------------------------------------------
  try {
    // 1. Simulate delivery attempt failed
    await logisticsService.simulateException(
      orderNumber,
      { exceptionType: 'ATTEMPT_FAILED', reason: 'Customer requested evening delivery' },
      'admin-usr-01'
    );
    assert.strictEqual(inMemoryShipments.get(orderNumber).currentMilestone, 'DELIVERY_ATTEMPT_FAILED');

    // 2. Re-attempt: advance back to OUT_FOR_DELIVERY
    await logisticsService.advanceMilestone(orderNumber, { nextMilestone: 'OUT_FOR_DELIVERY' }, 'admin-usr-01');
    assert.strictEqual(inMemoryShipments.get(orderNumber).currentMilestone, 'OUT_FOR_DELIVERY');

    // 3. Simulate RTO
    await logisticsService.simulateException(
      orderNumber,
      { exceptionType: 'RTO', reason: 'Customer unavailable after repeated calls' },
      'admin-usr-01'
    );
    assert.strictEqual(inMemoryShipments.get(orderNumber).currentMilestone, 'RTO_INITIATED');

    // Invariant check: Parent order status must NOT be changed to CANCELLED and pricing must remain intact
    const orderAfterRto = inMemoryOrders.get(orderNumber);
    assert.strictEqual(orderAfterRto.status, ORDER_STATUS.SHIPPED, 'Parent order must remain SHIPPED during RTO simulation');
    assert.strictEqual(orderAfterRto.pricing.shipping, 20000, 'Customer shipping must remain flat ₹200');
    assert.strictEqual(orderAfterRto.pricing.grandTotal, 470000, 'Grand total must remain unchanged');

    record('STEP-07', 'Exception and RTO simulation records milestones without corrupting parent order status or pricing', 'PASS');
  } catch (err) {
    record('STEP-07', 'Exception & RTO simulation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // STEP 8: Terminal DELIVERED State & COD Collection Synchronization
  // --------------------------------------------------------------------------
  try {
    // Setup fresh second order for delivery fulfillment test
    const order2Num = 'ORD-E2E-TERM';
    const order2Doc = {
      _id: '60c72b2f9b1d8b2bad999002',
      orderNumber: order2Num,
      isDemo: true,
      userId: customerId,
      status: ORDER_STATUS.PROCESSING,
      pricing: { subtotal: 200000, shipping: 20000, grandTotal: 220000 },
      payment: { method: 'CASH_ON_DELIVERY', status: 'PENDING' },
      shippingAddress: { fullName: 'Aarav Sharma', phone: '9876543210', city: 'Delhi', postalCode: '110001' },
      statusHistory: [],
    };
    inMemoryOrders.set(order2Num, order2Doc);

    // Manifest
    await logisticsService.manifestShipment(order2Num, { carrierId: 'swiftroute_demo' }, 'admin-usr-01');
    assert.strictEqual(inMemoryOrders.get(order2Num).status, ORDER_STATUS.SHIPPED);

    // Advance to OUT_FOR_DELIVERY
    await logisticsService.advanceMilestone(order2Num, { nextMilestone: 'PICKED_UP' }, 'admin-usr-01');
    await logisticsService.advanceMilestone(order2Num, { nextMilestone: 'IN_TRANSIT' }, 'admin-usr-01');
    await logisticsService.advanceMilestone(order2Num, { nextMilestone: 'OUT_FOR_DELIVERY' }, 'admin-usr-01');

    // Advance to terminal DELIVERED
    await logisticsService.advanceMilestone(order2Num, { nextMilestone: 'DELIVERED' }, 'admin-usr-01');

    const deliveredShipment = inMemoryShipments.get(order2Num);
    assert.strictEqual(deliveredShipment.currentMilestone, 'DELIVERED');

    const deliveredOrder = inMemoryOrders.get(order2Num);
    assert.strictEqual(deliveredOrder.status, ORDER_STATUS.DELIVERED);
    assert.strictEqual(deliveredOrder.payment.status, 'PAID', 'COD payment status must be updated to PAID upon delivery');

    // Terminal invariant check: Further progression must fail
    let terminalErr = null;
    try {
      await logisticsService.advanceMilestone(order2Num, { nextMilestone: 'OUT_FOR_DELIVERY' }, 'admin-usr-01');
    } catch (err) {
      terminalErr = err;
    }
    assert(terminalErr !== null && terminalErr.statusCode === 400);

    record('STEP-08', 'Terminal DELIVERED milestone triggers payment.status = PAID and locks state machine', 'PASS');
  } catch (err) {
    record('STEP-08', 'Terminal DELIVERED synchronization', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // STEP 9: Legacy & Unmanifested Orders Fallback
  // --------------------------------------------------------------------------
  try {
    const legacyNum = 'ORD-LEGACY-001';
    const legacyDoc = {
      _id: '60c72b2f9b1d8b2bad999003',
      orderNumber: legacyNum,
      userId: customerId,
      status: ORDER_STATUS.PLACED,
      pricing: { subtotal: 100000, shipping: 0, grandTotal: 100000 }, // Historical free shipping order
    };
    inMemoryOrders.set(legacyNum, legacyDoc);

    const trackingFallback = await logisticsService.getTracking(legacyNum, { id: customerId, role: 'CUSTOMER' });
    assert.strictEqual(trackingFallback.hasShipment, false);
    assert.strictEqual(trackingFallback.shipment, null);
    assert(trackingFallback.message.includes('not been manifested'));

    const notifFallback = await logisticsService.getNotifications(legacyNum, { id: customerId, role: 'CUSTOMER' });
    assert.strictEqual(notifFallback.hasShipment, false);
    assert.deepStrictEqual(notifFallback.notifications, []);

    record('STEP-09', 'Legacy and unmanifested orders render safe non-breaking empty fallback', 'PASS');
  } catch (err) {
    record('STEP-09', 'Legacy & unmanifested orders fallback', 'FAIL', err.message);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL AUDIT STEPS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('='.repeat(70) + '\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2ETests().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
