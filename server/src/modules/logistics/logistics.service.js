import crypto from 'crypto';
import MockShipment from './mockShipment.model.js';
import Order from '../orders/order.model.js';
import orderService from '../orders/order.service.js';
import { ORDER_STATUS } from '../orders/orderStateMachine.js';
import { SHIPPING_FEE_PAISE, SHIPPING_FEE_RUPEES } from '../../constants/shipping.constants.js';

/**
 * Fictional logistics carrier definitions for the demo platform
 */
export const DEMO_CARRIERS = Object.freeze([
  {
    id: 'luxeship_demo',
    prefix: 'LUXE',
    name: 'LuxeShip Demo',
    serviceType: 'Priority White-Glove Surface',
    base500gPaise: 9500, // ₹95
    base1kgPaise: 14500, // ₹145
    transitDays: '3-4 business days',
    cutoffTime: '17:00 IST',
  },
  {
    id: 'northstar_demo',
    prefix: 'NSTAR',
    name: 'Northstar Logistics Demo',
    serviceType: 'Standard National Doorstep',
    base500gPaise: 8000, // ₹80
    base1kgPaise: 12500, // ₹125
    transitDays: '4-5 business days',
    cutoffTime: '16:00 IST',
  },
  {
    id: 'swiftroute_demo',
    prefix: 'SWIFT',
    name: 'SwiftRoute Demo',
    serviceType: 'Express Regional Dispatch',
    base500gPaise: 11000, // ₹110
    base1kgPaise: 16500, // ₹165
    transitDays: '2-3 business days',
    cutoffTime: '18:30 IST',
  },
]);

/**
 * Allowed sequential milestone progression matrix for mock shipments
 */
export const MILESTONE_TRANSITIONS = Object.freeze({
  MANIFESTED: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_ATTEMPT_FAILED'],
  DELIVERY_ATTEMPT_FAILED: ['OUT_FOR_DELIVERY', 'RTO_INITIATED'],
  RTO_INITIATED: ['RTO_DELIVERED'],
  DELIVERED: [],      // Terminal milestone
  RTO_DELIVERED: [],  // Terminal milestone
});

/**
 * Helper to determine illustrative geographical shipping zone from postal code
 * @param {string} postalCode
 * @returns {{ zone: string, multiplier: number, hubCity: string }}
 */
export const resolveDestinationZone = (postalCode) => {
  const cleanPin = String(postalCode || '').trim();
  const firstDigit = cleanPin.charAt(0);

  switch (firstDigit) {
    case '1':
    case '2':
      return { zone: 'NORTH', multiplier: 1.0, hubCity: 'Delhi NCR Hub' };
    case '3':
    case '4':
      return { zone: 'WEST', multiplier: 1.15, hubCity: 'Mumbai Western Hub' };
    case '5':
    case '6':
      return { zone: 'SOUTH', multiplier: 1.25, hubCity: 'Bengaluru Southern Hub' };
    case '7':
    case '8':
      return { zone: 'EAST', multiplier: 1.3, hubCity: 'Kolkata Eastern Hub' };
    default:
      return { zone: 'NATIONAL', multiplier: 1.2, hubCity: 'Central Gateway Hub' };
  }
};

/**
 * Generate a cryptographically randomized unique Mock AWB starting with MOCK-
 * @param {string} carrierPrefix
 * @param {string} orderNumber
 * @returns {string}
 */
export const generateMockAwb = (carrierPrefix, orderNumber) => {
  const cleanCarrier = String(carrierPrefix || 'MOCK').toUpperCase();
  const suffix = String(orderNumber || '').replace(/[^A-Z0-9]/gi, '').slice(-4).toUpperCase();
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `MOCK-${cleanCarrier}-${suffix || 'ORD'}-${randomHex}`;
};

import { isDemoOrder } from '../../utils/orderClassification.js';

export { isDemoOrder };

class LogisticsService {
  /**
   * Retrieve deterministic mock rate quotes for an order across 500 g and 1 kg parcel tiers
   * @param {string} orderNumber
   * @returns {Promise<object>}
   */
  async getRateQuotes(orderNumber) {
    if (!orderNumber || typeof orderNumber !== 'string') {
      const error = new Error('Order number is required');
      error.statusCode = 400;
      error.code = 'INVALID_ORDER_NUMBER';
      throw error;
    }

    const order = await Order.findOne({ orderNumber: orderNumber.trim().toUpperCase() }).lean();
    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    const postalCode = order.shippingAddress?.postalCode || '110001';
    const city = order.shippingAddress?.city || 'Delhi';
    const state = order.shippingAddress?.state || 'Delhi';
    const zoneInfo = resolveDestinationZone(postalCode);

    const quotes = DEMO_CARRIERS.map((carrier) => {
      // 500g Tier
      const cost500gPaise = Math.round(carrier.base500gPaise * zoneInfo.multiplier);
      const variance500gPaise = SHIPPING_FEE_PAISE - cost500gPaise;

      // 1kg Tier
      const cost1kgPaise = Math.round(carrier.base1kgPaise * zoneInfo.multiplier);
      const variance1kgPaise = SHIPPING_FEE_PAISE - cost1kgPaise;

      return {
        carrierId: carrier.id,
        carrierName: carrier.name,
        serviceType: carrier.serviceType,
        estimatedTransitTime: carrier.transitDays,
        cutoffTime: carrier.cutoffTime,
        tiers: {
          '500G': {
            weightTier: '500G',
            weightGrams: 500,
            simulatedCarrierCostPaise: cost500gPaise,
            simulatedCarrierCostRupees: cost500gPaise / 100,
            customerShippingFeePaise: SHIPPING_FEE_PAISE,
            customerShippingFeeRupees: SHIPPING_FEE_RUPEES,
            variancePaise: variance500gPaise,
            varianceRupees: variance500gPaise / 100,
          },
          '1KG': {
            weightTier: '1KG',
            weightGrams: 1000,
            simulatedCarrierCostPaise: cost1kgPaise,
            simulatedCarrierCostRupees: cost1kgPaise / 100,
            customerShippingFeePaise: SHIPPING_FEE_PAISE,
            customerShippingFeeRupees: SHIPPING_FEE_RUPEES,
            variancePaise: variance1kgPaise,
            varianceRupees: variance1kgPaise / 100,
          },
        },
      };
    });

    return {
      orderNumber: order.orderNumber,
      destination: {
        postalCode,
        city,
        state,
        zone: zoneInfo.zone,
        regionalHub: zoneInfo.hubCity,
      },
      customerShippingFixedRupees: SHIPPING_FEE_RUPEES,
      customerShippingFixedPaise: SHIPPING_FEE_PAISE,
      isSimulated: true,
      disclaimer: '[DEMO SIMULATION] Non-binding illustrative estimates for demonstration purposes only. Does not query live courier APIs or verify actual PIN serviceability.',
      quotes,
    };
  }

  /**
   * Manifest a mock shipment and generate a unique MOCK- AWB
   * @param {string} orderNumber
   * @param {object} payload
   * @param {string} payload.carrierId
   * @param {string} [payload.weightTier='500G']
   * @param {string} [payload.notes]
   * @param {string} adminUserId
   * @returns {Promise<object>}
   */
  async manifestShipment(orderNumber, { carrierId, weightTier = '500G', notes = '' } = {}, adminUserId) {
    if (!orderNumber || typeof orderNumber !== 'string') {
      const error = new Error('Order number is required');
      error.statusCode = 400;
      error.code = 'INVALID_ORDER_NUMBER';
      throw error;
    }

    const normalizedOrderNumber = orderNumber.trim().toUpperCase();
    const order = await Order.findOne({ orderNumber: normalizedOrderNumber });
    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    // 1. Prevent duplicate mock shipments for the same order
    const existingShipment = await MockShipment.findOne({ orderNumber: normalizedOrderNumber });
    if (existingShipment) {
      const error = new Error(`Mock shipment already exists for order ${normalizedOrderNumber} with AWB ${existingShipment.awbNumber}`);
      error.statusCode = 409;
      error.code = 'MOCK_SHIPMENT_ALREADY_EXISTS';
      throw error;
    }

    // 2. Validate order status eligibility (strictly restricted to PROCESSING)
    if (order.status !== ORDER_STATUS.PROCESSING) {
      const error = new Error(
        `Cannot manifest shipment for order in '${order.status}' status. Only orders in 'PROCESSING' status can receive a new manifest.`
      );
      error.statusCode = 400;
      error.code = 'ORDER_NOT_READY_FOR_DISPATCH';
      throw error;
    }

    // 3. Resolve Carrier & Weight Tier
    const carrier = DEMO_CARRIERS.find((c) => c.id === carrierId) || DEMO_CARRIERS[0];
    const normalizedWeightTier = String(weightTier).toUpperCase() === '1KG' ? '1KG' : '500G';
    const weightGrams = normalizedWeightTier === '1KG' ? 1000 : 500;

    const zoneInfo = resolveDestinationZone(order.shippingAddress?.postalCode);
    const baseCostPaise = normalizedWeightTier === '1KG' ? carrier.base1kgPaise : carrier.base500gPaise;
    const simulatedCarrierCostPaise = Math.round(baseCostPaise * zoneInfo.multiplier);

    // 4. Generate unique MOCK- AWB
    let awbNumber = generateMockAwb(carrier.prefix, normalizedOrderNumber);
    // Double-check AWB collision safeguard
    while (await MockShipment.findOne({ awbNumber })) {
      awbNumber = generateMockAwb(carrier.prefix, normalizedOrderNumber);
    }

    // 5. Initial Checkpoint & Notification Previews
    const initialCheckpoint = {
      milestone: 'MANIFESTED',
      title: 'Shipment Manifested & Packed',
      location: 'LuxeCart Fulfillment Center, Ballabhgarh (Haryana)',
      description: `Package packed (${normalizedWeightTier}, ${weightGrams}g) and handed to staging bay for ${carrier.name} pickup.`,
      timestamp: new Date(),
    };

    const codDueRupees = (order.pricing?.grandTotal || 0) / 100;
    const customerPhone = order.shippingAddress?.phone || 'Customer Phone';
    const customerEmail = order.userId?.email || 'customer@example.com';
    const customerName = order.shippingAddress?.fullName || 'Valued Customer';

    const notifications = [
      {
        channel: 'SMS',
        recipient: customerPhone,
        message: `[DEMO SIMULATION] LuxeCart: Your order #${normalizedOrderNumber} has been packed and scheduled for dispatch via ${carrier.name}. Mock AWB: ${awbNumber}. Delivery estimate: within 7 business days after confirmation.`,
        sentAt: new Date(),
      },
      {
        channel: 'EMAIL',
        recipient: customerEmail,
        subject: `[DEMO SIMULATION] Shipment Created: Order #${normalizedOrderNumber}`,
        message: `[DEMO SIMULATION] Dear ${customerName}, your LuxeCart order #${normalizedOrderNumber} has been manifested via ${carrier.name} under tracking ID ${awbNumber}. Total Cash on Delivery due upon doorstep arrival: ₹${codDueRupees.toLocaleString('en-IN')}.`,
        sentAt: new Date(),
      },
    ];

    // 6. Transition Parent Order through state machine to SHIPPED (if not already SHIPPED)
    if (order.status === ORDER_STATUS.PROCESSING) {
      if (isDemoOrder(order)) {
        await orderService.updateOrderStatus(
          normalizedOrderNumber,
          {
            status: ORDER_STATUS.SHIPPED,
            note: `[DEMO SIMULATION] Dispatched via ${carrier.name} (Mock AWB: ${awbNumber})`,
          },
          adminUserId
        );
      } else {
        // Non-demo isolation safeguard: do not alter real order macro status
        await Order.updateOne(
          { orderNumber: normalizedOrderNumber },
          {
            $push: {
              statusHistory: {
                status: order.status,
                changedAt: new Date(),
                changedBy: adminUserId || null,
                note: `[DEMO SIMULATION] Mock manifest created via ${carrier.name} (Mock AWB: ${awbNumber}). Note: Live order status (${order.status}) left unmutated for non-demo order.`,
              },
            },
          }
        );
      }
    }

    // 7. Persist Isolated Mock Shipment
    const mockShipment = await MockShipment.create({
      orderId: order._id,
      orderNumber: normalizedOrderNumber,
      isSimulated: true,
      carrier: {
        id: carrier.id,
        name: carrier.name,
        serviceType: carrier.serviceType,
      },
      awbNumber,
      parcel: {
        weightTier: normalizedWeightTier,
        weightGrams,
        dimensionsCm: normalizedWeightTier === '1KG' ? { length: 25, width: 20, height: 15 } : { length: 20, width: 15, height: 10 },
      },
      pricing: {
        customerShippingPaise: SHIPPING_FEE_PAISE,
        simulatedCarrierCostPaise,
        codCollectionPaise: order.pricing?.grandTotal || 0,
      },
      currentMilestone: 'MANIFESTED',
      checkpoints: [initialCheckpoint],
      simulatedNotifications: notifications,
      deliveryEstimate: 'Within 7 business days after order confirmation',
      notes: (notes || '').trim(),
    });

    return mockShipment;
  }

  /**
   * Advance the mock shipment along the sequential transit milestones
   * @param {string} orderNumber
   * @param {object} payload
   * @param {string} payload.nextMilestone
   * @param {string} [payload.customLocation]
   * @param {string} [payload.customDescription]
   * @param {string} adminUserId
   * @returns {Promise<object>}
   */
  async advanceMilestone(orderNumber, { nextMilestone, customLocation, customDescription } = {}, adminUserId) {
    if (!orderNumber || typeof orderNumber !== 'string') {
      const error = new Error('Order number is required');
      error.statusCode = 400;
      error.code = 'INVALID_ORDER_NUMBER';
      throw error;
    }

    const normalizedOrderNumber = orderNumber.trim().toUpperCase();
    const shipment = await MockShipment.findOne({ orderNumber: normalizedOrderNumber });
    if (!shipment) {
      const error = new Error(`Mock shipment not found for order ${normalizedOrderNumber}`);
      error.statusCode = 404;
      error.code = 'MOCK_SHIPMENT_NOT_FOUND';
      throw error;
    }

    const current = shipment.currentMilestone;
    const allowedNext = MILESTONE_TRANSITIONS[current] || [];

    if (!nextMilestone || !allowedNext.includes(nextMilestone)) {
      const error = new Error(
        `Invalid milestone transition from '${current}' to '${nextMilestone}'. Allowed next milestones: [${allowedNext.join(', ')}]`
      );
      error.statusCode = 400;
      error.code = 'INVALID_MILESTONE_TRANSITION';
      throw error;
    }

    const order = await Order.findOne({ orderNumber: normalizedOrderNumber }).lean();
    const customerPhone = order?.shippingAddress?.phone || 'Customer Phone';
    const codDueRupees = ((order?.pricing?.grandTotal || 0) / 100).toLocaleString('en-IN');
    const destinationCity = order?.shippingAddress?.city || 'Destination City';

    // Build milestone details
    let title = '';
    let defaultLocation = '';
    let defaultDescription = '';
    let notificationMessage = '';

    switch (nextMilestone) {
      case 'PICKED_UP':
        title = 'Shipment Picked Up';
        defaultLocation = 'Faridabad Regional Sorting Center';
        defaultDescription = `Package picked up by ${shipment.carrier.name} courier executive and scanned at outbound hub.`;
        notificationMessage = `[DEMO SIMULATION] LuxeCart: Your shipment #${shipment.awbNumber} has been picked up by ${shipment.carrier.name}.`;
        break;

      case 'IN_TRANSIT':
        title = 'In Transit';
        defaultLocation = `${destinationCity} Main Gateway Hub`;
        defaultDescription = `Package arrived at ${destinationCity} distribution center; sorting for local hub dispatch.`;
        notificationMessage = `[DEMO SIMULATION] LuxeCart: Shipment #${shipment.awbNumber} is in transit via ${destinationCity} gateway hub.`;
        break;

      case 'OUT_FOR_DELIVERY':
        title = 'Out for Delivery';
        defaultLocation = `${destinationCity} Local Delivery Center`;
        defaultDescription = `Courier delivery agent has departed with your package. Doorstep delivery expected today.`;
        notificationMessage = `[DEMO SIMULATION] LuxeCart: Your order #${normalizedOrderNumber} is OUT FOR DELIVERY today via ${shipment.carrier.name}. Please keep ₹${codDueRupees} cash ready.`;
        break;

      case 'DELIVERED':
        title = 'Delivered & COD Collected';
        defaultLocation = `Customer Doorstep, ${destinationCity}`;
        defaultDescription = `Package successfully delivered to recipient. Cash on Delivery amount ₹${codDueRupees} collected in full.`;
        notificationMessage = `[DEMO SIMULATION] LuxeCart: Order #${normalizedOrderNumber} delivered successfully! ₹${codDueRupees} COD collected. Thank you for choosing LuxeCart.`;
        break;

      default:
        title = nextMilestone;
        defaultLocation = destinationCity;
        defaultDescription = `Milestone updated to ${nextMilestone}`;
        notificationMessage = `[DEMO SIMULATION] LuxeCart: Order #${normalizedOrderNumber} status updated to ${nextMilestone}.`;
        break;
    }

    const checkpoint = {
      milestone: nextMilestone,
      title,
      location: (customLocation || defaultLocation).trim(),
      description: (customDescription || defaultDescription).trim(),
      timestamp: new Date(),
    };

    const newNotification = {
      channel: 'SMS',
      recipient: customerPhone,
      message: notificationMessage,
      sentAt: new Date(),
    };

    // Update parent order to DELIVERED when terminal delivery milestone is reached
    if (nextMilestone === 'DELIVERED') {
      if (isDemoOrder(order)) {
        await orderService.updateOrderStatus(
          normalizedOrderNumber,
          {
            status: ORDER_STATUS.DELIVERED,
            note: `[DEMO SIMULATION] Delivered via ${shipment.carrier.name} (Mock AWB: ${shipment.awbNumber})`,
          },
          adminUserId
        );
      } else {
        // CRITICAL ISOLATION GUARD: Never mutate real customer order status or mark real COD payments as PAID
        await Order.updateOne(
          { orderNumber: normalizedOrderNumber },
          {
            $push: {
              statusHistory: {
                status: order.status,
                changedAt: new Date(),
                changedBy: adminUserId || null,
                note: `[DEMO SIMULATION] Mock shipment delivered via ${shipment.carrier.name} (Mock AWB: ${shipment.awbNumber}). Note: Live order status (${order.status}) and COD payment (${order.payment?.status}) left unmutated for non-demo order.`,
              },
            },
          }
        );
      }
    }

    // Persist checkpoint and milestone in MockShipment
    shipment.currentMilestone = nextMilestone;
    shipment.checkpoints.push(checkpoint);
    shipment.simulatedNotifications.push(newNotification);

    await shipment.save();
    return shipment;
  }

  /**
   * Simulate a logistics exception (failed delivery attempt or RTO)
   * @param {string} orderNumber
   * @param {object} payload
   * @param {string} payload.exceptionType 'ATTEMPT_FAILED' | 'RTO'
   * @param {string} [payload.reason]
   * @param {string} adminUserId
   * @returns {Promise<object>}
   */
  async simulateException(orderNumber, { exceptionType, reason } = {}, adminUserId) {
    if (!orderNumber || typeof orderNumber !== 'string') {
      const error = new Error('Order number is required');
      error.statusCode = 400;
      error.code = 'INVALID_ORDER_NUMBER';
      throw error;
    }

    const normalizedOrderNumber = orderNumber.trim().toUpperCase();
    const shipment = await MockShipment.findOne({ orderNumber: normalizedOrderNumber });
    if (!shipment) {
      const error = new Error(`Mock shipment not found for order ${normalizedOrderNumber}`);
      error.statusCode = 404;
      error.code = 'MOCK_SHIPMENT_NOT_FOUND';
      throw error;
    }

    const order = await Order.findOne({ orderNumber: normalizedOrderNumber }).lean();
    const customerPhone = order?.shippingAddress?.phone || 'Customer Phone';
    const destinationCity = order?.shippingAddress?.city || 'Destination City';

    const normalizedType = String(exceptionType || '').toUpperCase();

    if (normalizedType === 'ATTEMPT_FAILED') {
      if (shipment.currentMilestone !== 'OUT_FOR_DELIVERY') {
        const error = new Error(
          `Delivery attempt failed can only be simulated when milestone is 'OUT_FOR_DELIVERY'. Current milestone: '${shipment.currentMilestone}'`
        );
        error.statusCode = 400;
        error.code = 'INVALID_EXCEPTION_STATE';
        throw error;
      }

      const failureReason = reason || 'Customer unavailable at delivery address';
      shipment.currentMilestone = 'DELIVERY_ATTEMPT_FAILED';
      shipment.checkpoints.push({
        milestone: 'DELIVERY_ATTEMPT_FAILED',
        title: 'Delivery Attempt Failed',
        location: `${destinationCity} Local Delivery Hub`,
        description: `Attempted doorstep delivery failed: ${failureReason}. Package held at local station for next-business-day reattempt.`,
        timestamp: new Date(),
      });

      shipment.simulatedNotifications.push({
        channel: 'SMS',
        recipient: customerPhone,
        message: `[DEMO SIMULATION] LuxeCart: Delivery attempt failed for #${normalizedOrderNumber} (${failureReason}). We will automatically re-attempt delivery on the next business day.`,
        sentAt: new Date(),
      });
    } else if (normalizedType === 'RTO') {
      if (!['OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPT_FAILED'].includes(shipment.currentMilestone)) {
        const error = new Error(
          `RTO can only be simulated when milestone is 'OUT_FOR_DELIVERY' or 'DELIVERY_ATTEMPT_FAILED'. Current: '${shipment.currentMilestone}'`
        );
        error.statusCode = 400;
        error.code = 'INVALID_EXCEPTION_STATE';
        throw error;
      }

      const rtoReason = reason || 'Customer requested return / Undeliverable after multiple attempts';
      shipment.currentMilestone = 'RTO_INITIATED';
      shipment.checkpoints.push({
        milestone: 'RTO_INITIATED',
        title: 'Return to Origin Initiated',
        location: `${destinationCity} Return Processing Hub`,
        description: `Package flagged for return: ${rtoReason}. Inbound routing initiated back to Ballabhgarh fulfillment center.`,
        timestamp: new Date(),
      });

      shipment.simulatedNotifications.push({
        channel: 'SMS',
        recipient: customerPhone,
        message: `[DEMO SIMULATION] LuxeCart: Order #${normalizedOrderNumber} is returning to origin (${rtoReason}). If you need assistance, please contact support.`,
        sentAt: new Date(),
      });

      // Append an informative note to the parent order's statusHistory without mutating its macro status or bypassing stock rules
      await Order.updateOne(
        { orderNumber: normalizedOrderNumber },
        {
          $push: {
            statusHistory: {
              status: order.status,
              changedAt: new Date(),
              changedBy: adminUserId || null,
              note: `[DEMO SIMULATION] Logistics exception recorded: Return To Origin initiated (${rtoReason})`,
            },
          },
        }
      );
    } else {
      const error = new Error(`Unsupported exception type '${exceptionType}'. Allowed: 'ATTEMPT_FAILED', 'RTO'`);
      error.statusCode = 400;
      error.code = 'UNSUPPORTED_EXCEPTION_TYPE';
      throw error;
    }

    await shipment.save();
    return shipment;
  }

  /**
   * Retrieve tracking details for an order (safe for customer and admin inspection)
   * @param {string} orderNumber
   * @param {object} requestingUser
   * @returns {Promise<object>}
   */
  async getTracking(orderNumber, requestingUser) {
    if (!orderNumber || typeof orderNumber !== 'string') {
      const error = new Error('Order number is required');
      error.statusCode = 400;
      error.code = 'INVALID_ORDER_NUMBER';
      throw error;
    }

    const normalizedOrderNumber = orderNumber.trim().toUpperCase();
    const order = await Order.findOne({ orderNumber: normalizedOrderNumber }).lean();
    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    // Verify ownership for non-admin customers
    if (requestingUser?.role !== 'ADMIN' && String(order.userId) !== String(requestingUser?.id)) {
      const error = new Error('You do not have permission to view tracking for this order');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const shipment = await MockShipment.findOne({ orderNumber: normalizedOrderNumber }).lean();
    if (!shipment) {
      return {
        orderNumber: normalizedOrderNumber,
        hasShipment: false,
        shipment: null,
        message: 'Shipment has not been manifested yet for this order.',
      };
    }

    return {
      orderNumber: normalizedOrderNumber,
      hasShipment: true,
      shipment: {
        awbNumber: shipment.awbNumber,
        carrier: shipment.carrier,
        parcel: shipment.parcel,
        currentMilestone: shipment.currentMilestone,
        deliveryEstimate: shipment.deliveryEstimate,
        checkpoints: shipment.checkpoints,
        isSimulated: true,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt,
      },
    };
  }

  /**
   * Retrieve simulated notification communication log (SMS & Email previews)
   * @param {string} orderNumber
   * @param {object} requestingUser
   * @returns {Promise<object>}
   */
  async getNotifications(orderNumber, requestingUser) {
    if (!orderNumber || typeof orderNumber !== 'string') {
      const error = new Error('Order number is required');
      error.statusCode = 400;
      error.code = 'INVALID_ORDER_NUMBER';
      throw error;
    }

    const normalizedOrderNumber = orderNumber.trim().toUpperCase();
    const order = await Order.findOne({ orderNumber: normalizedOrderNumber }).lean();
    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    // Verify ownership for non-admin customers
    if (requestingUser?.role !== 'ADMIN' && String(order.userId) !== String(requestingUser?.id)) {
      const error = new Error('You do not have permission to view notifications for this order');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const shipment = await MockShipment.findOne({ orderNumber: normalizedOrderNumber }).lean();
    if (!shipment) {
      return {
        orderNumber: normalizedOrderNumber,
        hasShipment: false,
        notifications: [],
        message: 'No notifications generated yet. Shipment has not been manifested.',
      };
    }

    return {
      orderNumber: normalizedOrderNumber,
      hasShipment: true,
      notifications: shipment.simulatedNotifications || [],
      isSimulated: true,
    };
  }
}

const logisticsService = new LogisticsService();
export default logisticsService;
