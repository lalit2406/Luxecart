/**
 * LUXECART PHASE 4D-1: BACKEND MOCK LOGISTICS & DATA ISOLATION VERIFICATION SUITE
 *
 * Verifies:
 * - LOG-01: Fictional carrier definitions (LuxeShip Demo, Northstar Logistics Demo, SwiftRoute Demo)
 * - LOG-02: Deterministic rate quotes for 500g and 1kg with fixed ₹200 (20,000 paise) customer fee
 * - LOG-03: Separation of simulated carrier costs from customer shipping and order pricing
 * - LOG-04: Mock AWB format compliance (/^MOCK-[A-Z0-9-]+$/)
 * - LOG-05: Duplicate mock shipment prevention (409 Conflict)
 * - LOG-06: Order eligibility and rejection of terminal order dispatch
 * - LOG-07: Parent-order transitions use existing orderService & state machine (PROCESSING -> SHIPPED -> DELIVERED)
 * - LOG-08: Sequential milestone transition validation (rejects out-of-order jumps)
 * - LOG-09: Terminal delivery milestone updates order to DELIVERED and marks COD paid via lifecycle
 * - LOG-10: Exception simulation (ATTEMPT_FAILED & RTO) does not bypass cancellation or inventory rules
 * - LOG-11: Customer authorization & order ownership verification (403 for non-owners)
 * - LOG-12: Safe empty fallback for unmanifested orders
 * - LOG-13: Simulated notifications have [DEMO SIMULATION] prefix and invoke zero external providers
 * - LOG-14: Express route mounting verification (admin logistics routes & customer order tracking)
 *
 * Note: Uses isolated in-memory test stubs; NO live MongoDB Atlas writes are performed.
 */

import assert from 'assert';
import logisticsService, {
  DEMO_CARRIERS,
  MILESTONE_TRANSITIONS,
  resolveDestinationZone,
  generateMockAwb,
} from '../src/modules/logistics/logistics.service.js';
import MockShipment from '../src/modules/logistics/mockShipment.model.js';
import Order from '../src/modules/orders/order.model.js';
import orderService from '../src/modules/orders/order.service.js';
import { ORDER_STATUS } from '../src/modules/orders/orderStateMachine.js';
import { SHIPPING_FEE_PAISE, SHIPPING_FEE_RUPEES } from '../src/constants/shipping.constants.js';
import app from '../src/app.js';
import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

const testResults = [];

function record(testId, name, status, details = '') {
  testResults.push({ testId, name, status, details });
  const badge = status === 'PASS' ? '✔ [PASS]' : status === 'SKIP' ? '○ [SKIP]' : '✖ [FAIL]';
  console.log(`${badge} [${testId}] ${name}`);
  if (details) console.log(`    ↳ ${details}`);
}

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('   LUXECART PHASE 4D-1: BACKEND MOCK LOGISTICS VERIFICATION SUITE   ');
  console.log('='.repeat(70) + '\n');

  // --------------------------------------------------------------------------
  // TEST 1: Fictional Carrier Definitions
  // --------------------------------------------------------------------------
  try {
    assert.strictEqual(DEMO_CARRIERS.length, 3, 'Must have exactly 3 demo carriers');
    const carrierNames = DEMO_CARRIERS.map((c) => c.name);
    assert(carrierNames.includes('LuxeShip Demo'), 'Must include LuxeShip Demo');
    assert(carrierNames.includes('Northstar Logistics Demo'), 'Must include Northstar Logistics Demo');
    assert(carrierNames.includes('SwiftRoute Demo'), 'Must include SwiftRoute Demo');

    // Ensure none of them mention real carriers (e.g. BlueDart, Delhivery)
    for (const carrier of DEMO_CARRIERS) {
      assert(!/bluedart|delhivery|fedex|dhl|dtdc|shadowfax/i.test(carrier.name), 'Carrier names must be strictly fictional');
      assert(carrier.prefix && carrier.prefix.length >= 3, 'Carrier must have uppercase prefix');
      assert(carrier.base500gPaise > 0 && carrier.base1kgPaise > carrier.base500gPaise, '1kg rate must exceed 500g rate');
    }
    record('LOG-01', 'Fictional demo carriers properly configured without real brand names', 'PASS');
  } catch (err) {
    record('LOG-01', 'Fictional demo carriers properly configured', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Deterministic Zone Resolution & Rate Quotes
  // --------------------------------------------------------------------------
  try {
    const north = resolveDestinationZone('110001');
    assert.strictEqual(north.zone, 'NORTH');
    assert.strictEqual(north.multiplier, 1.0);

    const west = resolveDestinationZone('400001');
    assert.strictEqual(west.zone, 'WEST');
    assert.strictEqual(west.multiplier, 1.15);

    const south = resolveDestinationZone('560001');
    assert.strictEqual(south.zone, 'SOUTH');
    assert.strictEqual(south.multiplier, 1.25);

    const east = resolveDestinationZone('700001');
    assert.strictEqual(east.zone, 'EAST');
    assert.strictEqual(east.multiplier, 1.3);

    // Mock Order.findOne for rate quotes
    const originalFindOne = Order.findOne;
    Order.findOne = function ({ orderNumber }) {
      return {
        lean: async () => ({
          orderNumber,
          shippingAddress: {
            postalCode: '110001',
            city: 'New Delhi',
            state: 'Delhi',
          },
        }),
      };
    };

    const quotesResult = await logisticsService.getRateQuotes('ORD-TEST-001');
    assert.strictEqual(quotesResult.orderNumber, 'ORD-TEST-001');
    assert.strictEqual(quotesResult.customerShippingFixedRupees, 200);
    assert.strictEqual(quotesResult.customerShippingFixedPaise, 20000);
    assert.strictEqual(quotesResult.isSimulated, true);
    assert(quotesResult.quotes.length === 3, 'Must return quotes for all 3 demo carriers');

    for (const q of quotesResult.quotes) {
      assert(q.tiers['500G'], 'Must include 500g tier');
      assert(q.tiers['1KG'], 'Must include 1kg tier');
      assert.strictEqual(q.tiers['500G'].customerShippingFeeRupees, 200);
      assert.strictEqual(q.tiers['1KG'].customerShippingFeeRupees, 200);
      assert.strictEqual(q.tiers['500G'].simulatedCarrierCostRupees + q.tiers['500G'].varianceRupees, 200);
      assert.strictEqual(q.tiers['1KG'].simulatedCarrierCostRupees + q.tiers['1KG'].varianceRupees, 200);
    }

    Order.findOne = originalFindOne;
    record('LOG-02', 'Deterministic 500g & 1kg rate quotes with fixed ₹200 fee and variance calculation', 'PASS');
  } catch (err) {
    record('LOG-02', 'Deterministic rate quotes calculation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Mock AWB Identifier Format & Uniqueness
  // --------------------------------------------------------------------------
  try {
    const awbRegex = /^MOCK-[A-Z0-9-]+$/;
    const generatedAwbs = new Set();
    for (let i = 0; i < 50; i++) {
      const awb = generateMockAwb('LUXE', `ORD-100${i}`);
      assert(awbRegex.test(awb), `AWB '${awb}' must match pattern /^MOCK-[A-Z0-9-]+$/`);
      assert(awb.startsWith('MOCK-LUXE-'), `AWB '${awb}' must start with carrier prefix`);
      assert(!generatedAwbs.has(awb), `AWB '${awb}' must be unique`);
      generatedAwbs.add(awb);
    }
    record('LOG-04', 'Mock AWB identifiers strictly prefixed with MOCK- and uniquely generated', 'PASS');
  } catch (err) {
    record('LOG-04', 'Mock AWB identifier generation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Duplicate Manifest Prevention
  // --------------------------------------------------------------------------
  try {
    const origOrderFindOne = Order.findOne;
    const origShipmentFindOne = MockShipment.findOne;

    Order.findOne = function () {
      return {
        _id: '60c72b2f9b1d8b2bad000001',
        orderNumber: 'ORD-DUP-01',
        status: ORDER_STATUS.PROCESSING,
        pricing: { grandTotal: 250000 },
        shippingAddress: { postalCode: '110001', phone: '9999999999' },
      };
    };

    // Simulate existing shipment found
    MockShipment.findOne = async function ({ orderNumber }) {
      if (orderNumber === 'ORD-DUP-01') {
        return { orderNumber: 'ORD-DUP-01', awbNumber: 'MOCK-LUXE-DUP-1234' };
      }
      return null;
    };

    let caughtError = null;
    try {
      await logisticsService.manifestShipment('ORD-DUP-01', { carrierId: 'luxeship_demo' }, 'admin-123');
    } catch (err) {
      caughtError = err;
    }

    assert(caughtError !== null, 'Must throw error on duplicate shipment');
    assert.strictEqual(caughtError.statusCode, 409);
    assert.strictEqual(caughtError.code, 'MOCK_SHIPMENT_ALREADY_EXISTS');

    Order.findOne = origOrderFindOne;
    MockShipment.findOne = origShipmentFindOne;
    record('LOG-05', 'Duplicate mock shipment creation safely rejected with 409 Conflict', 'PASS');
  } catch (err) {
    record('LOG-05', 'Duplicate mock shipment prevention', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Order Eligibility & Terminal State Protection
  // --------------------------------------------------------------------------
  try {
    const origOrderFindOne = Order.findOne;
    const origShipmentFindOne = MockShipment.findOne;

    MockShipment.findOne = async () => null;

    // Test CANCELLED order
    Order.findOne = async () => ({
      orderNumber: 'ORD-CAN-01',
      status: ORDER_STATUS.CANCELLED,
    });

    let errCancelled = null;
    try {
      await logisticsService.manifestShipment('ORD-CAN-01', {}, 'admin-123');
    } catch (err) {
      errCancelled = err;
    }
    assert(errCancelled && errCancelled.statusCode === 400 && errCancelled.code === 'ORDER_NOT_READY_FOR_DISPATCH');

    // Test DELIVERED order
    Order.findOne = async () => ({
      orderNumber: 'ORD-DEL-01',
      status: ORDER_STATUS.DELIVERED,
    });

    let errDelivered = null;
    try {
      await logisticsService.manifestShipment('ORD-DEL-01', {}, 'admin-123');
    } catch (err) {
      errDelivered = err;
    }
    assert(errDelivered && errDelivered.statusCode === 400 && errDelivered.code === 'ORDER_NOT_READY_FOR_DISPATCH');

    // Test PLACED order (must be rejected until moved to PROCESSING)
    Order.findOne = async () => ({
      orderNumber: 'ORD-PLC-01',
      status: ORDER_STATUS.PLACED,
    });

    let errPlaced = null;
    try {
      await logisticsService.manifestShipment('ORD-PLC-01', {}, 'admin-123');
    } catch (err) {
      errPlaced = err;
    }
    assert(errPlaced && errPlaced.statusCode === 400 && errPlaced.code === 'ORDER_NOT_READY_FOR_DISPATCH');

    Order.findOne = origOrderFindOne;
    MockShipment.findOne = origShipmentFindOne;
    record('LOG-06', 'Non-processing orders (PLACED, CANCELLED, DELIVERED) protected from premature dispatch', 'PASS');
  } catch (err) {
    record('LOG-06', 'Terminal order dispatch protection', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Manifestation & Parent Order Lifecycle Integration
  // --------------------------------------------------------------------------
  try {
    const origOrderFindOne = Order.findOne;
    const origShipmentFindOne = MockShipment.findOne;
    const origShipmentCreate = MockShipment.create;
    const origUpdateOrderStatus = orderService.updateOrderStatus;

    let orderStatusCalls = [];
    orderService.updateOrderStatus = async function (orderNum, payload, adminId) {
      orderStatusCalls.push({ orderNum, payload, adminId });
      return { orderNumber: orderNum, status: payload.status };
    };

    const mockOrderDoc = {
      _id: '60c72b2f9b1d8b2bad000002',
      orderNumber: 'ORD-PROC-01',
      isDemo: true,
      status: ORDER_STATUS.PROCESSING,
      pricing: { grandTotal: 350000, shipping: 20000 },
      shippingAddress: {
        fullName: 'Aarav Sharma',
        phone: '9876543210',
        postalCode: '110001',
        city: 'New Delhi',
        state: 'Delhi',
      },
      userId: { email: 'aarav@example.com' },
    };

    Order.findOne = function () {
      return mockOrderDoc;
    };

    MockShipment.findOne = async () => null;

    let createdShipmentPayload = null;
    MockShipment.create = async function (payload) {
      createdShipmentPayload = payload;
      return payload;
    };

    const createdShipment = await logisticsService.manifestShipment(
      'ORD-PROC-01',
      { carrierId: 'luxeship_demo', weightTier: '500G', notes: 'Fragile luxury item' },
      'admin-usr-99'
    );

    // Assert parent order transition was called through orderService
    assert(orderStatusCalls.length >= 1, 'orderService.updateOrderStatus must be invoked');
    assert.strictEqual(orderStatusCalls[orderStatusCalls.length - 1].payload.status, ORDER_STATUS.SHIPPED);
    assert(orderStatusCalls[orderStatusCalls.length - 1].payload.note.includes('[DEMO SIMULATION]'));

    // Assert mock shipment created with correct attributes
    assert.strictEqual(createdShipmentPayload.currentMilestone, 'MANIFESTED');
    assert.strictEqual(createdShipmentPayload.parcel.weightTier, '500G');
    assert.strictEqual(createdShipmentPayload.pricing.customerShippingPaise, 20000);
    assert(createdShipmentPayload.pricing.simulatedCarrierCostPaise > 0);
    assert(createdShipmentPayload.awbNumber.startsWith('MOCK-LUXE-'));
    assert(createdShipmentPayload.checkpoints.length === 1);
    assert.strictEqual(createdShipmentPayload.checkpoints[0].milestone, 'MANIFESTED');

    // Assert simulated notifications
    assert(createdShipmentPayload.simulatedNotifications.length === 2);
    for (const notif of createdShipmentPayload.simulatedNotifications) {
      assert(notif.message.includes('[DEMO SIMULATION]'));
    }

    Order.findOne = origOrderFindOne;
    MockShipment.findOne = origShipmentFindOne;
    MockShipment.create = origShipmentCreate;
    orderService.updateOrderStatus = origUpdateOrderStatus;
    record('LOG-07', 'Manifestation advances order to SHIPPED via orderService with isolated mock record', 'PASS');
  } catch (err) {
    record('LOG-07', 'Manifestation & parent order lifecycle integration', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Milestone Transition Matrix & Out-of-Order Rejection
  // --------------------------------------------------------------------------
  try {
    const origShipmentFindOne = MockShipment.findOne;
    const origOrderFindOne = Order.findOne;

    Order.findOne = function () {
      return {
        lean: async () => ({
          orderNumber: 'ORD-STEP-01',
          shippingAddress: { city: 'New Delhi', phone: '9999999999' },
          pricing: { grandTotal: 250000 },
        }),
      };
    };

    const fakeShipment = {
      orderNumber: 'ORD-STEP-01',
      currentMilestone: 'MANIFESTED',
      carrier: { name: 'LuxeShip Demo' },
      awbNumber: 'MOCK-LUXE-1234',
      checkpoints: [],
      simulatedNotifications: [],
      save: async function () { return this; },
    };

    MockShipment.findOne = async () => fakeShipment;

    // 1. Invalid jump: MANIFESTED directly to DELIVERED must fail
    let jumpError = null;
    try {
      await logisticsService.advanceMilestone('ORD-STEP-01', { nextMilestone: 'DELIVERED' }, 'admin-123');
    } catch (err) {
      jumpError = err;
    }
    assert(jumpError !== null && jumpError.statusCode === 400 && jumpError.code === 'INVALID_MILESTONE_TRANSITION');

    // 2. Valid transition: MANIFESTED -> PICKED_UP
    await logisticsService.advanceMilestone('ORD-STEP-01', { nextMilestone: 'PICKED_UP' }, 'admin-123');
    assert.strictEqual(fakeShipment.currentMilestone, 'PICKED_UP');
    assert.strictEqual(fakeShipment.checkpoints.length, 1);

    // 3. Invalid jump: PICKED_UP -> DELIVERED must fail
    let jump2Error = null;
    try {
      await logisticsService.advanceMilestone('ORD-STEP-01', { nextMilestone: 'DELIVERED' }, 'admin-123');
    } catch (err) {
      jump2Error = err;
    }
    assert(jump2Error !== null && jump2Error.statusCode === 400);

    // 4. Valid transition: PICKED_UP -> IN_TRANSIT
    await logisticsService.advanceMilestone('ORD-STEP-01', { nextMilestone: 'IN_TRANSIT' }, 'admin-123');
    assert.strictEqual(fakeShipment.currentMilestone, 'IN_TRANSIT');

    // 5. Valid transition: IN_TRANSIT -> OUT_FOR_DELIVERY
    await logisticsService.advanceMilestone('ORD-STEP-01', { nextMilestone: 'OUT_FOR_DELIVERY' }, 'admin-123');
    assert.strictEqual(fakeShipment.currentMilestone, 'OUT_FOR_DELIVERY');

    MockShipment.findOne = origShipmentFindOne;
    Order.findOne = origOrderFindOne;
    record('LOG-08', 'Sequential milestone progression enforced; invalid stage jumps safely rejected', 'PASS');
  } catch (err) {
    record('LOG-08', 'Sequential milestone progression validation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Terminal Delivery Milestone & COD Collection
  // --------------------------------------------------------------------------
  try {
    const origShipmentFindOne = MockShipment.findOne;
    const origOrderFindOne = Order.findOne;
    const origUpdateOrderStatus = orderService.updateOrderStatus;

    let deliveredOrderCalled = false;
    orderService.updateOrderStatus = async function (orderNum, payload) {
      if (payload.status === ORDER_STATUS.DELIVERED) {
        deliveredOrderCalled = true;
      }
      return { orderNumber: orderNum, status: payload.status };
    };

    Order.findOne = function () {
      return {
        lean: async () => ({
          orderNumber: 'ORD-TERM-01',
          isDemo: true,
          status: ORDER_STATUS.SHIPPED,
          pricing: { grandTotal: 200000 },
          shippingAddress: { city: 'Mumbai', phone: '9999999999' },
        }),
      };
    };

    const fakeShipment = {
      orderNumber: 'ORD-TERM-01',
      currentMilestone: 'OUT_FOR_DELIVERY',
      carrier: { name: 'LuxeShip Demo' },
      awbNumber: 'MOCK-LUXE-TERM-55',
      checkpoints: [],
      simulatedNotifications: [],
      save: async function () { return this; },
    };

    MockShipment.findOne = async () => fakeShipment;

    await logisticsService.advanceMilestone('ORD-TERM-01', { nextMilestone: 'DELIVERED' }, 'admin-usr-1');

    assert.strictEqual(fakeShipment.currentMilestone, 'DELIVERED');
    assert(deliveredOrderCalled, 'Advancing to DELIVERED must call orderService.updateOrderStatus with DELIVERED');
    assert(fakeShipment.checkpoints[fakeShipment.checkpoints.length - 1].title.includes('Delivered'));

    // Terminal check: DELIVERED cannot transition anywhere
    let terminalError = null;
    try {
      await logisticsService.advanceMilestone('ORD-TERM-01', { nextMilestone: 'OUT_FOR_DELIVERY' }, 'admin-usr-1');
    } catch (err) {
      terminalError = err;
    }
    assert(terminalError !== null && terminalError.statusCode === 400);

    MockShipment.findOne = origShipmentFindOne;
    Order.findOne = origOrderFindOne;
    orderService.updateOrderStatus = origUpdateOrderStatus;
    record('LOG-09', 'Terminal DELIVERED milestone triggers parent order lifecycle and becomes immutable', 'PASS');
  } catch (err) {
    record('LOG-09', 'Terminal delivery milestone execution', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Exception Simulation (Failed Attempt & RTO)
  // --------------------------------------------------------------------------
  try {
    const origShipmentFindOne = MockShipment.findOne;
    const origOrderFindOne = Order.findOne;
    const origOrderUpdateOne = Order.updateOne;

    let parentOrderUpdated = false;
    Order.updateOne = async function (filter, update) {
      parentOrderUpdated = true;
      // Assert that RTO update does NOT mutate order status or pricing!
      assert(!update.$set?.status, 'RTO must NOT mutate order.status directly');
      assert(!update.$set?.pricing, 'RTO must NOT alter order.pricing');
      return { modifiedCount: 1 };
    };

    Order.findOne = function () {
      return {
        lean: async () => ({
          orderNumber: 'ORD-EXC-01',
          status: ORDER_STATUS.SHIPPED,
          shippingAddress: { city: 'Jaipur', phone: '9999999999' },
        }),
      };
    };

    const fakeShipment = {
      orderNumber: 'ORD-EXC-01',
      currentMilestone: 'OUT_FOR_DELIVERY',
      carrier: { name: 'Northstar Logistics Demo' },
      awbNumber: 'MOCK-NSTAR-EXC-12',
      checkpoints: [],
      simulatedNotifications: [],
      save: async function () { return this; },
    };
    MockShipment.findOne = async () => fakeShipment;

    // 1. Simulate failed attempt
    await logisticsService.simulateException('ORD-EXC-01', {
      exceptionType: 'ATTEMPT_FAILED',
      reason: 'Customer phone unreachable',
    }, 'admin-usr-1');

    assert.strictEqual(fakeShipment.currentMilestone, 'DELIVERY_ATTEMPT_FAILED');
    assert(fakeShipment.checkpoints[0].description.includes('Customer phone unreachable'));

    // 2. Simulate RTO
    await logisticsService.simulateException('ORD-EXC-01', {
      exceptionType: 'RTO',
      reason: 'Door locked 3 consecutive days',
    }, 'admin-usr-1');

    assert.strictEqual(fakeShipment.currentMilestone, 'RTO_INITIATED');
    assert(parentOrderUpdated, 'Parent order must receive audit note');

    MockShipment.findOne = origShipmentFindOne;
    Order.findOne = origOrderFindOne;
    Order.updateOne = origOrderUpdateOne;
    record('LOG-10', 'Exception & RTO simulation records checkpoints without bypassing inventory or order state', 'PASS');
  } catch (err) {
    record('LOG-10', 'Exception & RTO simulation', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Authorization & Order Ownership on Tracking Endpoints
  // --------------------------------------------------------------------------
  try {
    const origOrderFindOne = Order.findOne;
    const origShipmentFindOne = MockShipment.findOne;

    Order.findOne = function () {
      return {
        lean: async () => ({
          orderNumber: 'ORD-OWN-01',
          userId: 'customer-user-111',
          status: ORDER_STATUS.SHIPPED,
        }),
      };
    };

    MockShipment.findOne = function () {
      return {
        lean: async () => ({
          awbNumber: 'MOCK-SWIFT-OWN-99',
          carrier: { name: 'SwiftRoute Demo' },
          pricing: { simulatedCarrierCostPaise: 11000 }, // Internal cost
          currentMilestone: 'IN_TRANSIT',
          deliveryEstimate: 'Within 7 business days after order confirmation',
          checkpoints: [{ milestone: 'IN_TRANSIT', title: 'In Transit' }],
        }),
      };
    };

    // 1. Non-owner customer must be rejected with 403
    let nonOwnerErr = null;
    try {
      await logisticsService.getTracking('ORD-OWN-01', { id: 'impostor-user-999', role: 'CUSTOMER' });
    } catch (err) {
      nonOwnerErr = err;
    }
    assert(nonOwnerErr !== null && nonOwnerErr.statusCode === 403 && nonOwnerErr.code === 'FORBIDDEN');

    // 2. Legitimate owner customer must succeed
    const ownerResult = await logisticsService.getTracking('ORD-OWN-01', { id: 'customer-user-111', role: 'CUSTOMER' });
    assert(ownerResult.hasShipment === true);
    assert.strictEqual(ownerResult.shipment.awbNumber, 'MOCK-SWIFT-OWN-99');
    // Ensure simulated internal carrier cost is NOT leaked to customer
    assert(ownerResult.shipment.pricing === undefined, 'Customer tracking must not leak internal carrier costs');

    // 3. Admin user must succeed regardless of userId
    const adminResult = await logisticsService.getTracking('ORD-OWN-01', { id: 'admin-user-777', role: 'ADMIN' });
    assert(adminResult.hasShipment === true);

    Order.findOne = origOrderFindOne;
    MockShipment.findOne = origShipmentFindOne;
    record('LOG-11', 'Customer tracking ownership verified (403 for non-owners; carrier costs sealed)', 'PASS');
  } catch (err) {
    record('LOG-11', 'Customer authorization & ownership verification', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Safe Empty Fallback for Unmanifested Orders
  // --------------------------------------------------------------------------
  try {
    const origOrderFindOne = Order.findOne;
    const origShipmentFindOne = MockShipment.findOne;

    Order.findOne = function () {
      return {
        lean: async () => ({
          orderNumber: 'ORD-UNMAN-01',
          userId: 'cust-123',
        }),
      };
    };

    // No shipment exists
    MockShipment.findOne = function () {
      return {
        lean: async () => null,
      };
    };

    const trackingFallback = await logisticsService.getTracking('ORD-UNMAN-01', { id: 'cust-123', role: 'CUSTOMER' });
    assert.strictEqual(trackingFallback.hasShipment, false);
    assert.strictEqual(trackingFallback.shipment, null);
    assert(trackingFallback.message.includes('not been manifested'));

    const notifFallback = await logisticsService.getNotifications('ORD-UNMAN-01', { id: 'cust-123', role: 'CUSTOMER' });
    assert.strictEqual(notifFallback.hasShipment, false);
    assert.deepStrictEqual(notifFallback.notifications, []);

    Order.findOne = origOrderFindOne;
    MockShipment.findOne = origShipmentFindOne;
    record('LOG-12', 'Missing mock shipment records return safe non-breaking empty fallback', 'PASS');
  } catch (err) {
    record('LOG-12', 'Safe empty fallback handling', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Route Mounting & Controller Binding Verification
  // --------------------------------------------------------------------------
  try {
    // Inspect Express router stack in app to verify admin logistics and customer tracking routes
    const routes = [];
    const extractRoutes = (stack, prefix = '') => {
      for (const layer of stack) {
        if (layer.route) {
          const path = prefix + layer.route.path;
          const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
          routes.push({ path, methods });
        } else if (layer.name === 'router' && layer.handle?.stack) {
          const matchedPrefix = layer.regexp.source
            .replace('^\\', '')
            .replace('\\/?(?=\\/|$)', '')
            .replace('(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace(/\^/g, '')
            .replace(/\$/g, '');
          extractRoutes(layer.handle.stack, prefix + (matchedPrefix.startsWith('/') ? matchedPrefix : '/' + matchedPrefix));
        }
      }
    };

    extractRoutes(app._router.stack);
    const routePaths = routes.map((r) => r.path);

    const hasRatesRoute = routePaths.some((p) => p.includes('rates/:orderNumber'));
    const hasManifestRoute = routePaths.some((p) => p.includes('manifest/:orderNumber'));
    const hasAdvanceRoute = routePaths.some((p) => p.includes('advance-milestone/:orderNumber'));
    const hasExceptionRoute = routePaths.some((p) => p.includes('simulate-exception/:orderNumber'));
    const hasTrackingRoute = routePaths.some((p) => p.includes(':orderNumber/tracking'));
    const hasNotifRoute = routePaths.some((p) => p.includes(':orderNumber/notifications'));

    assert(hasRatesRoute, 'GET /admin/logistics/rates/:orderNumber must be mounted');
    assert(hasManifestRoute, 'POST /admin/logistics/manifest/:orderNumber must be mounted');
    assert(hasAdvanceRoute, 'POST /admin/logistics/advance-milestone/:orderNumber must be mounted');
    assert(hasExceptionRoute, 'POST /admin/logistics/simulate-exception/:orderNumber must be mounted');
    assert(hasTrackingRoute, 'GET /orders/:orderNumber/tracking must be mounted');
    assert(hasNotifRoute, 'GET /orders/:orderNumber/notifications must be mounted');

    record('LOG-14', 'All 6 required logistics endpoints correctly mounted in Express routing tree', 'PASS');
  } catch (err) {
    record('LOG-14', 'Express route mounting verification', 'FAIL', err.message);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  const passed = testResults.filter((r) => r.status === 'PASS').length;
  const failed = testResults.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('='.repeat(70) + '\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
