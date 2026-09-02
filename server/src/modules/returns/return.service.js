import mongoose from 'mongoose';
import Return from './return.model.js';
import Order from '../orders/order.model.js';
import Product from '../products/product.model.js';
import User from '../users/user.model.js';
import { generateReturnNumber } from '../../utils/returnNumber.js';
import { RETURN_STATUS, assertValidReturnTransition } from './returnStateMachine.js';

export const DEFAULT_RETURN_WINDOW_DAYS = 7;

class ReturnService {
  /**
   * Helper to resolve an order by orderNumber or ObjectId for a given user
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {string} orderIdentifier
   * @returns {Promise<Document>}
   */
  async findUserOrder(userId, orderIdentifier) {
    if (!orderIdentifier || typeof orderIdentifier !== 'string') {
      const error = new Error('Order identifier is required');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const trimmed = orderIdentifier.trim();
    let query = { userId };

    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      query._id = trimmed;
    } else {
      query.orderNumber = trimmed.toUpperCase();
    }

    const order = await Order.findOne(query);
    if (!order) {
      const error = new Error(`Order '${trimmed}' not found`);
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    return order;
  }

  /**
   * Create a customer return request against a delivered order
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {string} orderIdentifier
   * @param {object} returnPayload - Pre-validated sanitized payload containing items array
   * @returns {Promise<Document>}
   */
  async createReturn(userId, orderIdentifier, returnPayload) {
    if (!userId) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      error.code = 'UNAUTHENTICATED';
      throw error;
    }

    const orderIdToFind = orderIdentifier || returnPayload.orderNumber;
    if (!orderIdToFind) {
      const error = new Error('Order number or order ID is required to request a return');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    // 1. Order Ownership & Existence Check
    const order = await this.findUserOrder(userId, orderIdToFind);

    // 2. Order Status Eligibility Check
    if (order.status !== 'DELIVERED') {
      const error = new Error(
        `Order '${order.orderNumber}' is not eligible for return. Current status is '${order.status}', but only DELIVERED orders can be returned.`
      );
      error.statusCode = 400;
      error.code = 'ORDER_NOT_ELIGIBLE_FOR_RETURN';
      throw error;
    }

    // 3. Return Window Verification (Default: 7 days / 168 hours)
    const deliveredEvent = (order.statusHistory || [])
      .slice()
      .reverse()
      .find((e) => e.status === 'DELIVERED');

    const deliveredAt = deliveredEvent?.changedAt ? new Date(deliveredEvent.changedAt) : new Date(order.updatedAt);
    const returnWindowDays = DEFAULT_RETURN_WINDOW_DAYS;
    const returnDeadline = new Date(deliveredAt.getTime() + returnWindowDays * 24 * 60 * 60 * 1000);

    if (Date.now() > returnDeadline.getTime()) {
      const error = new Error(
        `The return window for order '${order.orderNumber}' has expired. Returns are permitted within ${returnWindowDays} days of delivery.`
      );
      error.statusCode = 400;
      error.code = 'RETURN_WINDOW_EXPIRED';
      throw error;
    }

    if (!returnPayload.items || !Array.isArray(returnPayload.items) || returnPayload.items.length === 0) {
      const error = new Error('Return request must contain at least one item');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    // 4. Fetch Existing Active Returns for this Order to Calculate Remaining Eligible Quantities
    const existingReturns = await Return.find({
      orderId: order._id,
      status: { $ne: RETURN_STATUS.REJECTED },
    });

    const alreadyReturnedQtyMap = new Map();
    for (const retDoc of existingReturns) {
      for (const retItem of retDoc.items) {
        if (retItem.itemStatus !== 'REJECTED') {
          const key = retItem.orderItemId.toString();
          alreadyReturnedQtyMap.set(key, (alreadyReturnedQtyMap.get(key) || 0) + retItem.requestedQuantity);
        }
      }
    }

    // 5. Validate Return Items, Remaining Quantities, and Calculate Financial Snapshot
    const returnItems = [];
    let totalRequestedUnits = 0;
    let totalRefundAmount = 0;

    const seenItemIdsInBatch = new Set();

    for (const item of returnPayload.items) {
      const orderItemIdStr = item.orderItemId.toString();

      if (seenItemIdsInBatch.has(orderItemIdStr)) {
        const error = new Error(`Duplicate orderItemId '${orderItemIdStr}' in return request`);
        error.statusCode = 400;
        error.code = 'DUPLICATE_RETURN_ITEM';
        throw error;
      }
      seenItemIdsInBatch.add(orderItemIdStr);

      // Find in historical Order.items snapshot
      const orderItem = (order.items || []).find((i) => i._id.toString() === orderItemIdStr);
      if (!orderItem) {
        const error = new Error(
          `Order item '${orderItemIdStr}' was not found in order '${order.orderNumber}'`
        );
        error.statusCode = 404;
        error.code = 'ORDER_ITEM_NOT_FOUND';
        throw error;
      }

      // Quantity verification
      const alreadyReturned = alreadyReturnedQtyMap.get(orderItemIdStr) || 0;
      const remainingEligible = orderItem.quantity - alreadyReturned;

      if (item.quantity > remainingEligible) {
        const error = new Error(
          `Requested return quantity (${item.quantity}) exceeds remaining eligible quantity (${remainingEligible}) for '${orderItem.name}'. (Purchased: ${orderItem.quantity}, Already requested/returned: ${alreadyReturned})`
        );
        error.statusCode = 400;
        error.code = 'RETURN_QUANTITY_EXCEEDED';
        throw error;
      }

      // Record in memory to prevent duplicate overflows
      alreadyReturnedQtyMap.set(orderItemIdStr, alreadyReturned + item.quantity);

      // Server-authoritative integer paise refund calculation
      const itemRefundPaise = orderItem.unitPrice * item.quantity;
      totalRequestedUnits += item.quantity;
      totalRefundAmount += itemRefundPaise;

      // Populate frozen snapshot line item
      returnItems.push({
        orderItemId: orderItem._id,
        productId: orderItem.productId,
        variantId: orderItem.variantId,
        name: orderItem.name,
        brand: orderItem.brand || '',
        sku: orderItem.sku,
        image: orderItem.image || '',
        color: orderItem.color || { name: '', hex: '' },
        size: orderItem.size || '',
        purchasedQuantity: orderItem.quantity,
        requestedQuantity: item.quantity,
        unitPrice: orderItem.unitPrice,
        calculatedRefundAmount: itemRefundPaise,
        reason: item.reason,
        customerNote: item.customerNote || '',
        itemStatus: 'PENDING',
      });
    }

    // 6. Construct Pickup Address Snapshot from Order Delivery Address
    const shippingAddrObj = order.shippingAddress?.toObject
      ? order.shippingAddress.toObject()
      : order.shippingAddress || {};

    const pickupAddress = {
      fullName: shippingAddrObj.fullName || '',
      phone: shippingAddrObj.phone || '',
      addressLine1: shippingAddrObj.addressLine1 || '',
      addressLine2: shippingAddrObj.addressLine2 || '',
      landmark: shippingAddrObj.landmark || '',
      city: shippingAddrObj.city || '',
      state: shippingAddrObj.state || '',
      postalCode: shippingAddrObj.postalCode || '',
      country: shippingAddrObj.country || 'India',
    };

    // 7. Generate Return Number
    const returnNumber = await generateReturnNumber();

    // 8. Create Return Document
    const returnDoc = await Return.create({
      returnNumber,
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      items: returnItems,
      totalRequestedUnits,
      totalRefundAmount,
      pickupAddress,
      status: RETURN_STATUS.REQUESTED,
      inventoryRestored: false,
      statusHistory: [
        {
          status: RETURN_STATUS.REQUESTED,
          changedAt: new Date(),
          changedBy: userId,
          note: 'Return requested by customer',
        },
      ],
    });

    return returnDoc;
  }

  /**
   * Retrieve customer's returns with pagination
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {object} options
   * @returns {Promise<{ returns: Document[], pagination: object }>}
   */
  async getCustomerReturns(userId, { page = 1, limit = 10, status } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const query = { userId };
    if (status && typeof status === 'string' && status.trim() !== '') {
      query.status = status.trim().toUpperCase();
    }

    const [returns, total] = await Promise.all([
      Return.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Return.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      returns,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  }

  /**
   * Retrieve customer return by returnNumber
   * @param {string|mongoose.Types.ObjectId} userId
   * @param {string} returnNumber
   * @returns {Promise<Document>}
   */
  async getCustomerReturnByNumber(userId, returnNumber) {
    if (!returnNumber || typeof returnNumber !== 'string') {
      const error = new Error('Return number is required');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const normalizedNumber = returnNumber.trim().toUpperCase();
    const returnDoc = await Return.findOne({
      userId,
      returnNumber: normalizedNumber,
    });

    if (!returnDoc) {
      const error = new Error(`Return '${normalizedNumber}' not found`);
      error.statusCode = 404;
      error.code = 'RETURN_NOT_FOUND';
      throw error;
    }

    return returnDoc;
  }

  /**
   * Retrieve paginated return requests for admin dashboard with search, status filtering, and metrics
   * @param {object} options
   * @returns {Promise<{ returns: Array<object>, pagination: object, metrics: object }>}
   */
  async getAdminReturns({
    page = 1,
    limit = 20,
    status,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // 1. Filter
    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (search && search.trim().length > 0) {
      const sanitizedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitizedSearch, 'i');

      const matchedUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }],
      })
        .select('_id')
        .lean();

      const matchedUserIds = matchedUsers.map((u) => u._id);

      filter.$or = [
        { returnNumber: searchRegex },
        { orderNumber: searchRegex },
        { 'pickupAddress.fullName': searchRegex },
        { 'pickupAddress.phone': searchRegex },
        ...(matchedUserIds.length > 0 ? [{ userId: { $in: matchedUserIds } }] : []),
      ];
    }

    // 2. Sort
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // 3. Parallel Query Execution: Returns, Count, and Metrics
    const [returns, total, metricsAggregation] = await Promise.all([
      Return.find(filter)
        .populate('userId', 'name email phone')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Return.countDocuments(filter),
      Return.aggregate([
        {
          $group: {
            _id: null,
            totalReturns: { $sum: 1 },
            requested: { $sum: { $cond: [{ $eq: ['$status', 'REQUESTED'] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] } },
            pickupScheduled: { $sum: { $cond: [{ $eq: ['$status', 'PICKUP_SCHEDULED'] }, 1, 0] } },
            received: { $sum: { $cond: [{ $eq: ['$status', 'RECEIVED'] }, 1, 0] } },
            refunded: { $sum: { $cond: [{ $eq: ['$status', 'REFUNDED'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
            totalRequestedUnits: { $sum: '$totalRequestedUnits' },
            totalRefundAmountPaise: { $sum: '$totalRefundAmount' },
          },
        },
      ]),
    ]);

    const metrics = metricsAggregation[0] || {
      totalReturns: 0,
      requested: 0,
      approved: 0,
      pickupScheduled: 0,
      received: 0,
      refunded: 0,
      rejected: 0,
      totalRequestedUnits: 0,
      totalRefundAmountPaise: 0,
    };
    delete metrics._id;

    const formattedReturns = returns.map((r) => ({
      id: r._id,
      returnNumber: r.returnNumber,
      orderNumber: r.orderNumber,
      customer: {
        id: r.userId?._id || r.userId,
        name: r.userId?.name || r.pickupAddress?.fullName || 'Customer',
        email: r.userId?.email || '',
        phone: r.userId?.phone || r.pickupAddress?.phone || '',
      },
      totalRequestedUnits: r.totalRequestedUnits,
      totalRefundAmount: r.totalRefundAmount,
      status: r.status,
      inventoryRestored: r.inventoryRestored,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return {
      returns: formattedReturns,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPreviousPage: pageNum > 1,
      },
      metrics,
    };
  }

  /**
   * Retrieve complete return inspection record by returnNumber for admin dashboard
   * @param {string} returnNumber
   * @returns {Promise<object>}
   */
  async getAdminReturnByNumber(returnNumber) {
    if (!returnNumber || typeof returnNumber !== 'string') {
      const error = new Error('Return number is required');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const normalizedNumber = returnNumber.trim().toUpperCase();
    const returnDoc = await Return.findOne({ returnNumber: normalizedNumber })
      .populate('userId', 'name email phone')
      .populate('statusHistory.changedBy', 'name email role')
      .lean();

    if (!returnDoc) {
      const error = new Error(`Return '${normalizedNumber}' not found`);
      error.statusCode = 404;
      error.code = 'RETURN_NOT_FOUND';
      throw error;
    }

    // Load original order context
    const orderDoc = await Order.findById(returnDoc.orderId)
      .select('orderNumber status createdAt payment')
      .lean();

    return {
      id: returnDoc._id,
      returnNumber: returnDoc.returnNumber,
      orderId: returnDoc.orderId,
      orderNumber: returnDoc.orderNumber,
      status: returnDoc.status,
      createdAt: returnDoc.createdAt,
      updatedAt: returnDoc.updatedAt,
      totalRequestedUnits: returnDoc.totalRequestedUnits,
      totalRefundAmount: returnDoc.totalRefundAmount,
      inventoryRestored: returnDoc.inventoryRestored,
      customer: {
        id: returnDoc.userId?._id || returnDoc.userId,
        name: returnDoc.userId?.name || returnDoc.pickupAddress?.fullName || 'Customer',
        email: returnDoc.userId?.email || '',
        phone: returnDoc.userId?.phone || returnDoc.pickupAddress?.phone || '',
      },
      order: orderDoc
        ? {
            orderNumber: orderDoc.orderNumber,
            status: orderDoc.status,
            createdAt: orderDoc.createdAt,
            payment: orderDoc.payment,
          }
        : null,
      items: returnDoc.items,
      pickupAddress: returnDoc.pickupAddress,
      pickupDetails: returnDoc.pickupDetails || {},
      refundDetails: returnDoc.refundDetails || {},
      statusHistory: (returnDoc.statusHistory || []).map((h) => ({
        status: h.status,
        changedAt: h.changedAt,
        changedBy: h.changedBy
          ? {
              id: h.changedBy._id || h.changedBy,
              name: h.changedBy.name || 'Staff',
              email: h.changedBy.email || '',
              role: h.changedBy.role || '',
            }
          : null,
        note: h.note || '',
      })),
    };
  }

  /**
   * Update return status with server-authoritative state machine validation and concurrency protection
   * @param {string} returnNumber
   * @param {object} payload
   * @param {string} adminUserId
   * @returns {Promise<Document>}
   */
  async updateAdminReturnStatus(returnNumber, { status, note, pickupDetails, refundDetails, items } = {}, adminUserId) {
    if (!returnNumber || typeof returnNumber !== 'string') {
      const error = new Error('Return number is required');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const normalizedNumber = returnNumber.trim().toUpperCase();
    const returnDoc = await Return.findOne({ returnNumber: normalizedNumber });

    if (!returnDoc) {
      const error = new Error(`Return '${normalizedNumber}' not found`);
      error.statusCode = 404;
      error.code = 'RETURN_NOT_FOUND';
      throw error;
    }

    // 1. Authoritative State Machine Transition Validation
    assertValidReturnTransition(returnDoc.status, status);

    // 2. Prepare History Event
    const historyEvent = {
      status,
      changedAt: new Date(),
      changedBy: adminUserId || null,
      note: note ? note.trim() : `Status updated to ${status} by administrator`,
    };

    // 3. Prepare Update Fields
    const updateQuery = {
      status,
      $push: { statusHistory: historyEvent },
    };

    if (pickupDetails && Object.keys(pickupDetails).length > 0) {
      updateQuery.pickupDetails = { ...(returnDoc.pickupDetails?.toObject ? returnDoc.pickupDetails.toObject() : returnDoc.pickupDetails), ...pickupDetails };
    }

    if (refundDetails && Object.keys(refundDetails).length > 0) {
      updateQuery.refundDetails = {
        ...(returnDoc.refundDetails?.toObject ? returnDoc.refundDetails.toObject() : returnDoc.refundDetails),
        ...refundDetails,
        processedBy: adminUserId,
      };
    }

    // 4. Physical Warehouse Receipt & Inventory Restocking
    if (status === 'RECEIVED') {
      if (!items || !Array.isArray(items) || items.length === 0) {
        const error = new Error('Inspection items array is required for RECEIVED status');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      // Verify every return item belongs to this return and all items are inspected
      const existingItemsMap = new Map();
      returnDoc.items.forEach((item) => {
        existingItemsMap.set(item._id.toString(), item);
      });

      const inspectionMap = new Map();
      for (const inspected of items) {
        const rItemId = inspected.returnItemId.toString();
        if (!existingItemsMap.has(rItemId)) {
          const error = new Error(`Return item '${rItemId}' does not belong to return '${normalizedNumber}'`);
          error.statusCode = 400;
          error.code = 'RETURN_ITEM_MISMATCH';
          throw error;
        }
        inspectionMap.set(rItemId, inspected.itemStatus);
      }

      if (inspectionMap.size !== existingItemsMap.size) {
        const error = new Error(`All ${existingItemsMap.size} return items must have an explicit inspection result`);
        error.statusCode = 400;
        error.code = 'INCOMPLETE_INSPECTION';
        throw error;
      }

      // Build updated items array and identify items to restock
      const updatedItems = [];
      const restockPlan = [];

      for (const item of returnDoc.items) {
        const itemObj = item.toObject ? item.toObject() : { ...item };
        const inspectedStatus = inspectionMap.get(item._id.toString());

        if (inspectedStatus === 'ACCEPTED') {
          itemObj.itemStatus = 'RESTOCKED';
          restockPlan.push({
            productId: item.productId,
            variantId: item.variantId,
            requestedQuantity: item.requestedQuantity,
          });
        } else if (inspectedStatus === 'REJECTED') {
          itemObj.itemStatus = 'REJECTED';
        }

        updatedItems.push(itemObj);
      }

      updateQuery.items = updatedItems;
      updateQuery.inventoryRestored = true;

      // 4. Concurrency Protection & State Update (CAS on status and inventoryRestored)
      const updatedReturn = await Return.findOneAndUpdate(
        { _id: returnDoc._id, status: returnDoc.status, inventoryRestored: false },
        updateQuery,
        { returnDocument: 'after' }
      )
        .populate('userId', 'name email phone')
        .populate('statusHistory.changedBy', 'name email role');

      if (!updatedReturn) {
        const error = new Error('Return status was modified concurrently or inventory was already restored');
        error.statusCode = 409;
        error.code = 'RETURN_STATE_CONFLICT';
        throw error;
      }

      // Restock product variants for accepted items
      try {
        for (const plan of restockPlan) {
          await Product.findOneAndUpdate(
            { _id: plan.productId, 'variants._id': plan.variantId },
            { $inc: { 'variants.$.inventory.stock': plan.requestedQuantity } }
          );
        }
      } catch (restockErr) {
        console.error('Failed to restock product variants during return receipt:', restockErr);
        await Return.findByIdAndUpdate(returnDoc._id, { inventoryRestored: false });
        throw restockErr;
      }

      return updatedReturn;
    }

    // 5. Financial Refund Settlement & Order Accounting
    if (status === 'REFUNDED') {
      if (!returnDoc.inventoryRestored) {
        const error = new Error('Return is not ready for refund settlement: warehouse physical receipt and inventory processing must be complete');
        error.statusCode = 409;
        error.code = 'RETURN_NOT_READY_FOR_REFUND';
        throw error;
      }

      if (!refundDetails || !refundDetails.method || !refundDetails.referenceNumber) {
        const error = new Error('Valid refundDetails with method and referenceNumber are required for refund settlement');
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      // Order Accounting: Verify refund does not exceed order refundable balance
      const orderDoc = await Order.findById(returnDoc.orderId);
      if (orderDoc) {
        const orderGrandTotalPaise = orderDoc.pricing?.grandTotal || 0;
        const otherRefundedReturns = await Return.find({
          orderId: returnDoc.orderId,
          status: 'REFUNDED',
          _id: { $ne: returnDoc._id },
        });

        const alreadyRefundedPaise = otherRefundedReturns.reduce(
          (sum, r) => sum + (r.totalRefundAmount || 0),
          0
        );

        if (alreadyRefundedPaise + returnDoc.totalRefundAmount > orderGrandTotalPaise) {
          const error = new Error('Refund amount exceeds remaining refundable order balance');
          error.statusCode = 409;
          error.code = 'REFUND_AMOUNT_EXCEEDS_ORDER';
          throw error;
        }
      }

      // Record Server-Authoritative Settlement Details
      const settlementDetails = {
        method: refundDetails.method,
        referenceNumber: refundDetails.referenceNumber.trim(),
        refundedAt: new Date(),
        processedBy: adminUserId || null,
      };

      updateQuery.refundDetails = settlementDetails;
      historyEvent.note = note ? note.trim() : `Refund settled via ${refundDetails.method} (Ref: ${refundDetails.referenceNumber.trim()})`;

      // Concurrency Protection: Atomic Compare-and-Swap (status must still be RECEIVED and unrefunded)
      const updatedReturn = await Return.findOneAndUpdate(
        { _id: returnDoc._id, status: 'RECEIVED', 'refundDetails.refundedAt': null },
        updateQuery,
        { returnDocument: 'after' }
      )
        .populate('userId', 'name email phone')
        .populate('statusHistory.changedBy', 'name email role')
        .populate('refundDetails.processedBy', 'name email role');

      if (!updatedReturn) {
        const error = new Error('Return status was modified concurrently or refund has already been settled');
        error.statusCode = 409;
        error.code = 'RETURN_STATE_CONFLICT';
        throw error;
      }

      return updatedReturn;
    }

    // 6. Concurrency Protection (Compare-and-Swap using current status for other transitions)
    const updatedReturn = await Return.findOneAndUpdate(
      { _id: returnDoc._id, status: returnDoc.status },
      updateQuery,
      { returnDocument: 'after' }
    )
      .populate('userId', 'name email phone')
      .populate('statusHistory.changedBy', 'name email role');

    if (!updatedReturn) {
      const error = new Error('Return status was modified concurrently by another administrator');
      error.statusCode = 409;
      error.code = 'RETURN_STATE_CONFLICT';
      throw error;
    }

    return updatedReturn;
  }
}

export default new ReturnService();

