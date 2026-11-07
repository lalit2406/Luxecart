import mongoose from 'mongoose';
import crypto from 'crypto';
import Order from './order.model.js';
import Cart from '../cart/cart.model.js';
import Address from '../addresses/address.model.js';
import Product from '../products/product.model.js';
import User from '../users/user.model.js';
import Coupon from '../coupons/coupon.model.js';
import couponService from '../coupons/coupon.service.js';
import { generateOrderNumber } from '../../utils/orderNumber.js';
import { assertValidTransition, canTransition, ORDER_STATUS } from './orderStateMachine.js';
import { SHIPPING_FEE_PAISE, calculateShippingFeePaise } from '../../constants/shipping.constants.js';
import { isDemoOrder } from '../../utils/orderClassification.js';
import { storeSettingsService } from '../settings/storeSettings.service.js';

class OrderService {
  /**
   * Place a Cash on Delivery order with atomic inventory reservation and snapshot capture
   * @param {string} userId
   * @param {object} options
   * @param {string} [options.addressId]
   * @param {string} [options.idempotencyKey]
   * @param {string} [options.couponCode]
   * @returns {Promise<Order>}
   */
  async placeCodOrder(userId, { addressId, idempotencyKey, couponCode } = {}) {
    // 1. Fetch authoritative store settings
    let settings;
    try {
      settings = await storeSettingsService.getOrCreateStoreSettings();
    } catch (err) {
      const error = new Error('Unable to retrieve store settings for order calculation. Please try again shortly.');
      error.statusCode = 503;
      error.code = 'SETTINGS_SERVICE_UNAVAILABLE';
      throw error;
    }

    // 2. Enforce maintenance mode for storefront order placement
    if (settings?.maintenance?.isMaintenanceMode) {
      const error = new Error(
        settings.maintenance.maintenanceMessage ||
          'The store is currently undergoing scheduled maintenance. Please check back shortly.'
      );
      error.statusCode = 503;
      error.code = 'MAINTENANCE_MODE';
      throw error;
    }

    // 3. Idempotency Check
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ userId, idempotencyKey });
      if (existingOrder) {
        return existingOrder;
      }
    }

    // 4. Fetch authenticated customer's cart
    const cart = await Cart.findOne({ userId });
    if (!cart || !cart.items || cart.items.length === 0) {
      const error = new Error('Your cart is empty');
      error.statusCode = 400;
      error.code = 'CART_EMPTY';
      throw error;
    }

    // 3. Resolve and validate delivery address
    let address = null;
    if (addressId) {
      if (!mongoose.Types.ObjectId.isValid(addressId)) {
        const error = new Error('Invalid address ID');
        error.statusCode = 400;
        error.code = 'INVALID_ADDRESS_ID';
        throw error;
      }
      address = await Address.findOne({ _id: addressId, userId }).lean();
    } else {
      address = await Address.findOne({ userId, isDefault: true }).lean();
      if (!address) {
        address = await Address.findOne({ userId }).sort({ createdAt: -1 }).lean();
      }
    }

    if (!address) {
      const error = new Error('Please add a delivery address to place an order');
      error.statusCode = 400;
      error.code = 'ADDRESS_REQUIRED';
      throw error;
    }

    // Snapshot shipping address
    const shippingAddressSnapshot = {
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      landmark: address.landmark || '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || 'India',
      addressType: address.addressType || 'HOME',
    };

    // 4. Live Catalog Revalidation & Snapshot Construction
    const productIds = cart.items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const orderItemsSnapshot = [];
    let subtotalPaise = 0;
    let totalMrpPaise = 0;
    let totalUnits = 0;

    for (const item of cart.items) {
      const product = productMap.get(item.productId.toString());

      if (!product || product.status !== 'ACTIVE') {
        const error = new Error(`Item '${product?.name || 'Product'}' is no longer active in our catalog`);
        error.statusCode = 400;
        error.code = 'PRODUCT_UNAVAILABLE';
        throw error;
      }

      const variant = product.variants?.find((v) => v._id.toString() === item.variantId.toString());

      if (!variant || variant.isActive === false) {
        const error = new Error(`Selected variant for '${product.name}' is no longer available`);
        error.statusCode = 400;
        error.code = 'VARIANT_UNAVAILABLE';
        throw error;
      }

      const availableStock = variant.inventory?.stock || 0;
      if (availableStock < item.quantity) {
        const error = new Error(
          `Insufficient stock for '${product.name}'. Available: ${availableStock}, Requested: ${item.quantity}`
        );
        error.statusCode = 400;
        error.code = 'INSUFFICIENT_STOCK';
        throw error;
      }

      const unitPricePaise = variant.price * 100;
      const unitMrpPaise = variant.mrp * 100;
      const lineSubtotalPaise = unitPricePaise * item.quantity;
      const lineMrpPaise = unitMrpPaise * item.quantity;
      const lineSavingsPaise = Math.max(0, lineMrpPaise - lineSubtotalPaise);
      const discountPercent =
        unitMrpPaise > unitPricePaise
          ? Math.round(((unitMrpPaise - unitPricePaise) / unitMrpPaise) * 100)
          : 0;

      subtotalPaise += lineSubtotalPaise;
      totalMrpPaise += lineMrpPaise;
      totalUnits += item.quantity;

      const primaryImage =
        product.images?.find((img) => img.isPrimary)?.url ||
        product.images?.[0]?.url ||
        '';
      const itemImage = variant.images?.[0] || primaryImage;

      orderItemsSnapshot.push({
        productId: product._id,
        variantId: variant._id,
        name: product.name,
        brand: product.brand,
        slug: product.slug,
        sku: variant.sku,
        image: itemImage,
        color: variant.attributes?.color || { name: '', hex: '' },
        size: variant.attributes?.size || '',
        quantity: item.quantity,
        unitPrice: unitPricePaise,
        unitMrp: unitMrpPaise,
        discountPercent,
        lineSubtotal: lineSubtotalPaise,
        lineMrp: lineMrpPaise,
        lineSavings: lineSavingsPaise,
        category: product.category,
        categoryTree: product.categoryTree || [product.category],
      });
    }

    // Dynamic shipping fee calculation (evaluated against subtotal before coupon discounts)
    let shippingPaise = 0;
    if (orderItemsSnapshot.length > 0 && subtotalPaise > 0) {
      shippingPaise = calculateShippingFeePaise(subtotalPaise, settings?.shipping);
    }
    const estimatedTaxPaise = 0; // Estimated tax placeholder

    // Evaluate coupon if provided
    let couponDiscountPaise = 0;
    let couponSnapshot = null;

    if (couponCode) {
      const couponResult = await couponService.validateAndCalculateCoupon(couponCode, {
        userId,
        cartItems: orderItemsSnapshot,
        subtotalPaise,
      });
      couponDiscountPaise = couponResult.discountPaise;
      couponSnapshot = {
        code: couponResult.coupon.code,
        discountType: couponResult.coupon.discountType,
        discountValue: couponResult.coupon.discountValue,
        discountAmount: couponDiscountPaise,
      };
    }

    const totalSavingsPaise = Math.max(0, totalMrpPaise - subtotalPaise + couponDiscountPaise);
    const grandTotalPaise = Math.max(0, subtotalPaise + shippingPaise + estimatedTaxPaise - couponDiscountPaise);

    // Enforce maximum Cash on Delivery threshold
    const maxCodOrderPaise = settings?.payment?.maxCodOrderPaise ?? 10000000;
    if (grandTotalPaise > maxCodOrderPaise) {
      const maxCodRupeesFormatted = (maxCodOrderPaise / 100).toLocaleString('en-IN');
      const error = new Error(
        `Order total exceeds the maximum Cash on Delivery limit of ₹${maxCodRupeesFormatted}`
      );
      error.statusCode = 400;
      error.code = 'COD_LIMIT_EXCEEDED';
      throw error;
    }

    const orderNumber = await generateOrderNumber();

    const orderPayload = {
      orderNumber,
      userId,
      isDemo: false,
      status: 'PLACED',
      payment: {
        method: 'CASH_ON_DELIVERY',
        status: 'PENDING',
      },
      shippingAddress: shippingAddressSnapshot,
      items: orderItemsSnapshot.map((i) => {
        const itemCopy = { ...i };
        delete itemCopy.category;
        delete itemCopy.categoryTree;
        return itemCopy;
      }),
      pricing: {
        totalUnits,
        itemCount: orderItemsSnapshot.length,
        subtotal: subtotalPaise,
        totalMrp: totalMrpPaise,
        totalSavings: totalSavingsPaise,
        shipping: shippingPaise,
        estimatedTax: estimatedTaxPaise,
        couponDiscount: couponDiscountPaise,
        grandTotal: grandTotalPaise,
      },
      coupon: couponSnapshot || { code: null, discountType: null, discountValue: null, discountAmount: 0 },
      statusHistory: [
        {
          status: 'PLACED',
          changedAt: new Date(),
          changedBy: null,
          note: 'Order placed by customer',
        },
      ],
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };

    // 5. Atomic Inventory Mutation & Order Persistence
    let session = null;
    let useTransaction = false;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch (sessionErr) {
      useTransaction = false;
      if (session) {
        await session.endSession().catch(() => {});
        session = null;
      }
    }

    if (useTransaction && session) {
      try {
        // Reserve coupon usage if coupon was applied
        if (couponSnapshot?.code) {
          await couponService.reserveCouponUsage(couponSnapshot.code, session);
        }

        // Atomic conditional stock decrements inside transaction
        for (const item of cart.items) {
          const updateResult = await Product.updateOne(
            {
              _id: item.productId,
              variants: {
                $elemMatch: {
                  _id: item.variantId,
                  'inventory.stock': { $gte: item.quantity },
                },
              },
            },
            {
              $inc: { 'variants.$.inventory.stock': -item.quantity },
            },
            { session }
          );

          if (updateResult.modifiedCount === 0) {
            const error = new Error('Insufficient stock for one or more items during order placement');
            error.statusCode = 400;
            error.code = 'INSUFFICIENT_STOCK';
            throw error;
          }
        }

        // Persist Order inside transaction
        const [createdOrder] = await Order.create([orderPayload], { session });

        // Clear Customer Cart inside transaction
        await Cart.updateOne({ userId }, { $set: { items: [] } }, { session });

        await session.commitTransaction();
        await session.endSession();

        return createdOrder;
      } catch (txnError) {
        await session.abortTransaction().catch(() => {});
        await session.endSession().catch(() => {});

        if (idempotencyKey) {
          // If transaction aborted due to duplicate key (E11000), write conflict, or transient error during concurrent execution:
          // Check if the winning concurrent transaction persisted the order
          let existingOrder = await Order.findOne({ userId, idempotencyKey });
          if (
            !existingOrder &&
            (txnError.code === 11000 ||
              txnError.message?.includes('E11000') ||
              txnError.hasErrorLabel?.('TransientTransactionError') ||
              txnError.hasLabels?.('TransientTransactionError') ||
              txnError.message?.includes('Write conflict'))
          ) {
            // Allow winning transaction up to 150ms to finish committing
            await new Promise((resolve) => setTimeout(resolve, 150));
            existingOrder = await Order.findOne({ userId, idempotencyKey });
          }

          if (existingOrder) {
            return existingOrder;
          }
        }

        throw txnError;
      }
    } else {
      // Fallback for standalone MongoDB environments:
      const decrementedItems = [];
      let couponReserved = false;

      try {
        if (couponSnapshot?.code) {
          await couponService.reserveCouponUsage(couponSnapshot.code);
          couponReserved = true;
        }

        for (const item of cart.items) {
          const updateResult = await Product.updateOne(
            {
              _id: item.productId,
              variants: {
                $elemMatch: {
                  _id: item.variantId,
                  'inventory.stock': { $gte: item.quantity },
                },
              },
            },
            {
              $inc: { 'variants.$.inventory.stock': -item.quantity },
            }
          );

          if (updateResult.modifiedCount === 0) {
            const error = new Error('Insufficient stock for one or more items during order placement');
            error.statusCode = 400;
            error.code = 'INSUFFICIENT_STOCK';
            throw error;
          }

          decrementedItems.push({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          });
        }

        // Create order
        const createdOrder = new Order(orderPayload);
        await createdOrder.save();

        // Clear customer cart
        await Cart.updateOne({ userId }, { $set: { items: [] } });

        return createdOrder;
      } catch (mutationError) {
        // Compensatory Rollback: Restore any reserved coupon
        if (couponReserved && couponSnapshot?.code) {
          await couponService.rollbackCouponUsage(couponSnapshot.code).catch(() => {});
        }

        // Compensatory Rollback: Restore any decremented stock
        for (const dec of decrementedItems) {
          await Product.updateOne(
            {
              _id: dec.productId,
              variants: {
                $elemMatch: {
                  _id: dec.variantId,
                },
              },
            },
            { $inc: { 'variants.$.inventory.stock': dec.quantity } }
          ).catch((rollbackErr) => {
            console.error('[CRITICAL] Stock rollback failure:', rollbackErr);
          });
        }

        if (idempotencyKey && (mutationError.code === 11000 || mutationError.message?.includes('E11000'))) {
          const existingOrder = await Order.findOne({ userId, idempotencyKey });
          if (existingOrder) {
            await Cart.updateOne({ userId }, { $set: { items: [] } }).catch(() => {});
            return existingOrder;
          }
        }

        throw mutationError;
      }
    }
  }

  /**
   * Retrieve single order by human-readable orderNumber for the authenticated customer
   * @param {string} userId
   * @param {string} orderNumber
   * @returns {Promise<Order>}
   */
  async getOrderByNumber(userId, orderNumber) {
    if (!orderNumber || typeof orderNumber !== 'string') {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    const order = await Order.findOne({
      orderNumber: orderNumber.trim().toUpperCase(),
      userId,
      isDemo: { $ne: true },
    }).lean();

    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    return order;
  }

  /**
   * Retrieve paginated order history for the authenticated customer
   * @param {string} userId
   * @param {object} options
   * @returns {Promise<{ orders: Array<Order>, total: number, page: number, pages: number }>}
   */
  async getMyOrders(userId, { page = 1, limit = 10 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Strict customer boundary: Exclude demo orders from customer order history
    const filter = {
      userId,
      isDemo: { $ne: true },
    };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return {
      orders,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
    };
  }

  /**
   * Retrieve paginated order listing for the admin dashboard with search, status filtering, orderType, and metrics
   * @param {object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @param {string} [options.status]
   * @param {string} [options.orderType='ALL']
   * @param {string} [options.search]
   * @param {string} [options.sortBy='createdAt']
   * @param {string} [options.sortOrder='desc']
   * @returns {Promise<{ orders: Array<object>, pagination: object, metrics: object }>}
   */
  async getAdminOrders({
    page = 1,
    limit = 20,
    status,
    orderType = 'ALL',
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // 1. Build Query Filter
    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (orderType === 'LIVE') {
      filter.isDemo = { $ne: true };
    } else if (orderType === 'DEMO') {
      filter.isDemo = true;
    }

    if (search && search.trim().length > 0) {
      const sanitizedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitizedSearch, 'i');

      // Find user IDs matching customer name or email
      const matchedUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }],
      })
        .select('_id')
        .lean();

      const matchedUserIds = matchedUsers.map((u) => u._id);

      filter.$or = [
        { orderNumber: searchRegex },
        { 'shippingAddress.fullName': searchRegex },
        { 'shippingAddress.phone': searchRegex },
        ...(matchedUserIds.length > 0 ? [{ userId: { $in: matchedUserIds } }] : []),
      ];
    }

    // 2. Sort Specification
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // 3. Parallel Query Execution: Orders, Total Count, and Database Metrics
    // Real business metrics strictly exclude demo orders ({ isDemo: { $ne: true } })
    const [orders, total, metricsAggregation] = await Promise.all([
      Order.find(filter)
        .populate('userId', 'name email phone')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(filter),
      Order.aggregate([
        {
          $match: {
            isDemo: { $ne: true }, // Exclude demo orders from business metrics
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            placed: { $sum: { $cond: [{ $eq: ['$status', 'PLACED'] }, 1, 0] } },
            confirmed: { $sum: { $cond: [{ $eq: ['$status', 'CONFIRMED'] }, 1, 0] } },
            processing: { $sum: { $cond: [{ $eq: ['$status', 'PROCESSING'] }, 1, 0] } },
            shipped: { $sum: { $cond: [{ $eq: ['$status', 'SHIPPED'] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
            totalRevenuePaise: {
              $sum: { $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$pricing.grandTotal', 0] },
            },
          },
        },
      ]),
    ]);

    const metrics = metricsAggregation[0] || {
      totalOrders: 0,
      placed: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      totalRevenuePaise: 0,
    };
    delete metrics._id;

    // 4. Format Orders for Admin Presentation
    const formattedOrders = orders.map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      isDemo: isDemoOrder(o),
      customer: {
        id: o.userId?._id || o.userId,
        name: o.userId?.name || o.shippingAddress?.fullName || 'Customer',
        email: o.userId?.email || 'N/A',
        phone: o.shippingAddress?.phone || o.userId?.phone || 'N/A',
      },
      status: o.status,
      payment: o.payment,
      shippingAddress: o.shippingAddress,
      items: o.items,
      pricing: o.pricing,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    return {
      orders: formattedOrders,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
      metrics,
    };
  }

  /**
   * Retrieve full order detail snapshot by orderNumber for the admin dashboard
   * @param {string} orderNumber
   * @returns {Promise<object>}
   */
  async getAdminOrderByNumber(orderNumber) {
    if (!orderNumber || typeof orderNumber !== 'string') {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    const order = await Order.findOne({
      orderNumber: String(orderNumber).trim().toUpperCase(),
    })
      .populate('userId', 'name email phone')
      .lean();

    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    return {
      _id: order._id,
      orderNumber: order.orderNumber,
      customer: {
        id: order.userId?._id || order.userId,
        name: order.userId?.name || order.shippingAddress?.fullName || 'Customer',
        email: order.userId?.email || 'N/A',
        phone: order.shippingAddress?.phone || order.userId?.phone || 'N/A',
      },
      status: order.status,
      statusHistory: order.statusHistory || [],
      payment: order.payment,
      shippingAddress: order.shippingAddress,
      items: order.items,
      pricing: order.pricing,
      isDemo: isDemoOrder(order),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  /**
   * Update order status following server-authoritative state machine with atomic inventory restoration on cancellation
   * @param {string} orderNumber
   * @param {object} payload
   * @param {string} payload.status
   * @param {string} [payload.note]
   * @param {string} adminUserId
   * @returns {Promise<object>}
   */
  async updateOrderStatus(orderNumber, { status: targetStatus, note } = {}, adminUserId) {
    if (!orderNumber || typeof orderNumber !== 'string') {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    const normalizedOrderNumber = String(orderNumber).trim().toUpperCase();
    const currentOrder = await Order.findOne({ orderNumber: normalizedOrderNumber });

    if (!currentOrder) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    // 1. Assert Valid Transition via State Machine
    assertValidTransition(currentOrder.status, targetStatus);

    const sanitizedNote = (note || '').trim();
    const historyEvent = {
      status: targetStatus,
      changedAt: new Date(),
      changedBy: adminUserId || null,
      note: sanitizedNote,
    };

    // 2. Handle Cancellation with Atomic Inventory Restoration
    if (targetStatus === ORDER_STATUS.CANCELLED) {
      let session = null;
      let useTransaction = false;

      try {
        session = await mongoose.startSession();
        session.startTransaction();
        useTransaction = true;
      } catch (sessionErr) {
        useTransaction = false;
        if (session) {
          await session.endSession().catch(() => {});
          session = null;
        }
      }

      if (useTransaction && session) {
        try {
          // 1. Rollback coupon usage if applied (idempotent with token)
          const couponToken = `${currentOrder.orderNumber}:coupon`;
          if (currentOrder.coupon?.code) {
            await couponService.rollbackCouponUsage(currentOrder.coupon.code, session, couponToken);
          }

          // 2. Restore inventory for each item in the order (idempotent with token)
          for (const item of currentOrder.items) {
            const itemToken = `${currentOrder.orderNumber}:${item.variantId}:${item._id || item.productId}`;
            await Product.updateOne(
              {
                _id: item.productId,
                variants: {
                  $elemMatch: {
                    _id: item.variantId,
                  },
                },
                cancellationTokens: { $ne: itemToken },
              },
              {
                $inc: { 'variants.$.inventory.stock': item.quantity },
                $addToSet: { cancellationTokens: itemToken },
              },
              { session }
            );
          }

          // 3. Atomically lock & update order status to CANCELLED and COMPLETED
          const updatedOrder = await Order.findOneAndUpdate(
            { _id: currentOrder._id, status: currentOrder.status },
            {
              $set: {
                status: ORDER_STATUS.CANCELLED,
                'cancellation.status': 'COMPLETED',
                'cancellation.completedAt': new Date(),
                'cancellation.couponRestored': Boolean(currentOrder.coupon?.code),
                'cancellation.error': null,
              },
              $push: { statusHistory: historyEvent },
            },
            { returnDocument: 'after', session }
          )
            .populate('userId', 'name email phone')
            .populate('statusHistory.changedBy', 'name email')
            .lean();

          if (!updatedOrder) {
            const conflictErr = new Error('Order status was concurrently modified by another request');
            conflictErr.statusCode = 409;
            conflictErr.code = 'ORDER_STATE_CONFLICT';
            throw conflictErr;
          }

          await session.commitTransaction();
          await session.endSession();

          return {
            _id: updatedOrder._id,
            orderNumber: updatedOrder.orderNumber,
            customer: {
              id: updatedOrder.userId?._id || updatedOrder.userId,
              name: updatedOrder.userId?.name || updatedOrder.shippingAddress?.fullName || 'Customer',
              email: updatedOrder.userId?.email || 'N/A',
              phone: updatedOrder.shippingAddress?.phone || updatedOrder.userId?.phone || 'N/A',
            },
            status: updatedOrder.status,
            cancellation: updatedOrder.cancellation,
            statusHistory: updatedOrder.statusHistory || [],
            payment: updatedOrder.payment,
            shippingAddress: updatedOrder.shippingAddress,
            items: updatedOrder.items,
            pricing: updatedOrder.pricing,
            coupon: updatedOrder.coupon,
            createdAt: updatedOrder.createdAt,
            updatedAt: updatedOrder.updatedAt,
          };
        } catch (txnError) {
          await session.abortTransaction().catch(() => {});
          await session.endSession().catch(() => {});
          throw txnError;
        }
      } else {
        // Fallback for standalone MongoDB environments:
        // 1. Concurrency and In-Progress Evaluation
        const staleThreshold = new Date(Date.now() - 15000); // 15s lock TTL for dead/crashed processes
        const isStale =
          currentOrder.cancellation?.status === 'IN_PROGRESS' &&
          currentOrder.cancellation?.initiatedAt &&
          new Date(currentOrder.cancellation.initiatedAt) < staleThreshold;

        if (currentOrder.cancellation?.status === 'IN_PROGRESS' && !isStale) {
          const conflictErr = new Error('Order cancellation is currently in progress. Please wait a moment.');
          conflictErr.statusCode = 409;
          conflictErr.code = 'CANCELLATION_IN_PROGRESS';
          throw conflictErr;
        }

        // 2. Acquire Durable Cancellation Lock on Order (Atomically with cryptographic fencing token)
        const lockToken = crypto.randomUUID();

        const lockedOrder = await Order.findOneAndUpdate(
          {
            _id: currentOrder._id,
            status: currentOrder.status,
            $or: [
              { 'cancellation.status': { $in: [null, 'FAILED_REQUIRES_ATTENTION'] } },
              { 'cancellation.status': 'IN_PROGRESS', 'cancellation.initiatedAt': { $lt: staleThreshold } },
              { cancellation: { $exists: false } },
            ],
          },
          {
            $set: {
              'cancellation.status': 'IN_PROGRESS',
              'cancellation.lockToken': lockToken,
              'cancellation.initiatedAt': new Date(),
              'cancellation.reason': sanitizedNote,
            },
          },
          { returnDocument: 'after' }
        );

        if (!lockedOrder) {
          const conflictErr = new Error('Order status was concurrently modified or cancellation is in progress');
          conflictErr.statusCode = 409;
          conflictErr.code = 'ORDER_STATE_CONFLICT';
          throw conflictErr;
        }

        // Helper to assert lock ownership before any downstream external mutations
        const assertLockOwnership = async () => {
          const stillOwned = await Order.exists({
            _id: currentOrder._id,
            'cancellation.lockToken': lockToken,
            'cancellation.status': 'IN_PROGRESS',
          });
          if (!stillOwned) {
            const lostErr = new Error('Lock ownership lost during cancellation recovery');
            lostErr.code = 'LOCK_OWNERSHIP_LOST';
            lostErr.statusCode = 409;
            throw lostErr;
          }
        };

        try {
          // 3. Durable Idempotent Coupon Rollback
          if (currentOrder.coupon?.code && !lockedOrder.cancellation?.couponRestored) {
            await assertLockOwnership();
            const couponToken = `${currentOrder.orderNumber}:coupon`;
            await couponService.rollbackCouponUsage(currentOrder.coupon.code, null, couponToken);
            const couponUpdateRes = await Order.updateOne(
              { _id: currentOrder._id, 'cancellation.lockToken': lockToken },
              { $set: { 'cancellation.couponRestored': true } }
            );
            if (couponUpdateRes.matchedCount === 0) {
              const lostErr = new Error('Lock ownership lost after coupon rollback');
              lostErr.code = 'LOCK_OWNERSHIP_LOST';
              lostErr.statusCode = 409;
              throw lostErr;
            }
          }

          // 4. Item-by-item Durable Inventory Restoration
          const restoredVariants = new Set(
            (lockedOrder.cancellation?.restoredItems || []).map((ri) => ri.variantId.toString())
          );

          for (const item of currentOrder.items) {
            if (restoredVariants.has(item.variantId.toString())) {
              continue; // Verified already restored on order in earlier run
            }

            await assertLockOwnership();

            const itemToken = `${currentOrder.orderNumber}:${item.variantId}:${item._id || item.productId}`;

            const updateResult = await Product.updateOne(
              {
                _id: item.productId,
                variants: { $elemMatch: { _id: item.variantId } },
                cancellationTokens: { $ne: itemToken },
              },
              {
                $inc: { 'variants.$.inventory.stock': item.quantity },
                $addToSet: { cancellationTokens: itemToken },
              }
            );

            if (updateResult.matchedCount === 0) {
              const alreadyRestoredOnProduct = await Product.exists({
                _id: item.productId,
                cancellationTokens: itemToken,
              });

              if (!alreadyRestoredOnProduct) {
                const prodExists = await Product.exists({ _id: item.productId });
                if (!prodExists) {
                  throw new Error(`Product ${item.productId} (${item.name || 'N/A'}) not found in catalog`);
                }
                throw new Error(`Variant ${item.variantId} (SKU: ${item.sku}) not found on product`);
              }
            }

            const itemUpdateRes = await Order.updateOne(
              { _id: currentOrder._id, 'cancellation.lockToken': lockToken },
              {
                $push: {
                  'cancellation.restoredItems': {
                    productId: item.productId,
                    variantId: item.variantId,
                    sku: item.sku,
                    quantity: item.quantity,
                    restoredAt: new Date(),
                  },
                },
              }
            );

            if (itemUpdateRes.matchedCount === 0) {
              const lostErr = new Error('Lock ownership lost during item restoration');
              lostErr.code = 'LOCK_OWNERSHIP_LOST';
              lostErr.statusCode = 409;
              throw lostErr;
            }

            restoredVariants.add(item.variantId.toString());
          }

          // 5. Finalize Cancellation Status (Atomically conditioned on lockToken)
          const finalOrder = await Order.findOneAndUpdate(
            { _id: currentOrder._id, 'cancellation.lockToken': lockToken },
            {
              $set: {
                status: ORDER_STATUS.CANCELLED,
                'cancellation.status': 'COMPLETED',
                'cancellation.completedAt': new Date(),
                'cancellation.error': null,
              },
              $push: { statusHistory: historyEvent },
            },
            { returnDocument: 'after' }
          )
            .populate('userId', 'name email phone')
            .populate('statusHistory.changedBy', 'name email')
            .lean();

          if (!finalOrder) {
            const lostErr = new Error('Lock ownership lost before final order status update');
            lostErr.code = 'LOCK_OWNERSHIP_LOST';
            lostErr.statusCode = 409;
            throw lostErr;
          }

          // 6. Safe Token Pruning (Terminal state reached; pull order-specific tokens)
          try {
            const orderItemTokens = currentOrder.items.map(
              (item) => `${currentOrder.orderNumber}:${item.variantId}:${item._id || item.productId}`
            );
            const productIds = currentOrder.items.map((item) => item.productId);

            await Product.updateMany(
              { _id: { $in: productIds } },
              { $pull: { cancellationTokens: { $in: orderItemTokens } } }
            );

            if (currentOrder.coupon?.code) {
              const couponToken = `${currentOrder.orderNumber}:coupon`;
              await Coupon.updateOne(
                { code: currentOrder.coupon.code.trim().toUpperCase() },
                { $pull: { cancellationTokens: couponToken } }
              );
            }
          } catch (cleanupErr) {
            // Non-fatal: logged silently, completed cancellation is safely preserved
          }

          return {
            _id: finalOrder._id,
            orderNumber: finalOrder.orderNumber,
            customer: {
              id: finalOrder.userId?._id || finalOrder.userId,
              name: finalOrder.userId?.name || finalOrder.shippingAddress?.fullName || 'Customer',
              email: finalOrder.userId?.email || 'N/A',
              phone: finalOrder.shippingAddress?.phone || finalOrder.userId?.phone || 'N/A',
            },
            status: finalOrder.status,
            cancellation: finalOrder.cancellation,
            statusHistory: finalOrder.statusHistory || [],
            payment: finalOrder.payment,
            shippingAddress: finalOrder.shippingAddress,
            items: finalOrder.items,
            pricing: finalOrder.pricing,
            coupon: finalOrder.coupon,
            createdAt: finalOrder.createdAt,
            updatedAt: finalOrder.updatedAt,
          };
        } catch (recoveryErr) {
          if (recoveryErr.code === 'LOCK_OWNERSHIP_LOST') {
            // Stale worker lost ownership; do not modify order state or overwrite newer worker
            throw recoveryErr;
          }

          // Record durable error ONLY if we still hold the lockToken
          await Order.updateOne(
            { _id: currentOrder._id, 'cancellation.lockToken': lockToken },
            {
              $set: {
                'cancellation.status': 'FAILED_REQUIRES_ATTENTION',
                'cancellation.error': {
                  message: recoveryErr.message,
                  failedAt: new Date(),
                },
              },
            }
          ).catch(() => {});

          const fatalErr = new Error(
            `Order cancellation partially failed during downstream recovery: ${recoveryErr.message}. Marked as FAILED_REQUIRES_ATTENTION.`
          );
          fatalErr.statusCode = 500;
          fatalErr.code = 'CANCELLATION_RECOVERY_FAILED';
          fatalErr.details = {
            originalError: recoveryErr.message,
            cancellationStatus: 'FAILED_REQUIRES_ATTENTION',
          };
          throw fatalErr;
        }
      }
    }

    // 3. Handle Standard Non-Cancellation Transitions (e.g. PLACED -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED)
    const updateDoc = {
      $set: {
        status: targetStatus,
        ...(targetStatus === ORDER_STATUS.DELIVERED && currentOrder.payment?.method === 'CASH_ON_DELIVERY'
          ? { 'payment.status': 'PAID' }
          : {}),
      },
      $push: { statusHistory: historyEvent },
    };

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: currentOrder._id, status: currentOrder.status },
      updateDoc,
      { returnDocument: 'after' }
    )
      .populate('userId', 'name email phone')
      .populate('statusHistory.changedBy', 'name email')
      .lean();

    if (!updatedOrder) {
      const conflictErr = new Error('Order status was concurrently modified by another request');
      conflictErr.statusCode = 409;
      conflictErr.code = 'ORDER_STATE_CONFLICT';
      throw conflictErr;
    }

    return {
      _id: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      customer: {
        id: updatedOrder.userId?._id || updatedOrder.userId,
        name: updatedOrder.userId?.name || updatedOrder.shippingAddress?.fullName || 'Customer',
        email: updatedOrder.userId?.email || 'N/A',
        phone: updatedOrder.shippingAddress?.phone || updatedOrder.userId?.phone || 'N/A',
      },
      status: updatedOrder.status,
      statusHistory: updatedOrder.statusHistory || [],
      payment: updatedOrder.payment,
      shippingAddress: updatedOrder.shippingAddress,
      items: updatedOrder.items,
      pricing: updatedOrder.pricing,
      isDemo: isDemoOrder(updatedOrder),
      createdAt: updatedOrder.createdAt,
      updatedAt: updatedOrder.updatedAt,
    };
  }

  /**
   * Explicitly create a demo order for logistics simulation and training
   * Strictly gated to administrative / test contexts
   * @param {object} payload
   * @param {string} adminUserId
   * @returns {Promise<Order>}
   */
  async createDemoOrder(payload = {}, adminUserId) {
    let orderNumber = payload.orderNumber ? String(payload.orderNumber).trim().toUpperCase() : null;

    if (!orderNumber) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
        const candidate = `DEMO-${dateStr}-${randomHex}`;
        const existing = await Order.findOne({ orderNumber: candidate }).select('_id').lean();
        if (!existing) {
          orderNumber = candidate;
          break;
        }
        attempts++;
      }

      if (!orderNumber) {
        const conflictError = new Error('Failed to generate unique demo order number after bounded retries');
        conflictError.statusCode = 409;
        conflictError.code = 'DEMO_ORDER_COLLISION';
        throw conflictError;
      }
    } else {
      if (!orderNumber.startsWith('DEMO-')) {
        const err = new Error("Custom demo order number must strictly begin with 'DEMO-' prefix");
        err.statusCode = 400;
        err.code = 'INVALID_ORDER_NUMBER';
        throw err;
      }

      const existing = await Order.findOne({ orderNumber }).select('_id').lean();
      if (existing) {
        const conflictError = new Error(`Demo order with number '${orderNumber}' already exists`);
        conflictError.statusCode = 409;
        conflictError.code = 'ORDER_ALREADY_EXISTS';
        throw conflictError;
      }
    }

    // Ownership is strictly bound to the authenticated administrator identity
    const demoUserId = adminUserId || new mongoose.Types.ObjectId();

    const demoOrderDoc = {
      orderNumber,
      userId: demoUserId,
      isDemo: true, // EXPLICIT IMMUTABLE DEMO FLAG
      status: payload.status || 'PROCESSING',
      payment: {
        method: 'CASH_ON_DELIVERY',
        status: 'PENDING',
      },
      shippingAddress: payload.shippingAddress || {
        fullName: 'Demo Customer',
        phone: '9876543210',
        addressLine1: 'Demo Luxury Suite 101',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110001',
        country: 'India',
        addressType: 'HOME',
      },
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          variantId: new mongoose.Types.ObjectId(),
          name: 'Demo Luxury Silk Scarf',
          brand: 'LuxeCart Signature',
          sku: 'DEMO-SKU-001',
          quantity: 1,
          unitPrice: 200000,
          unitMrp: 250000,
          discountPercent: 20,
          lineSubtotal: 200000,
          lineMrp: 250000,
          lineSavings: 50000,
        },
      ],
      pricing: {
        totalUnits: 1,
        itemCount: 1,
        subtotal: 200000,
        totalMrp: 250000,
        totalSavings: 50000,
        shipping: SHIPPING_FEE_PAISE,
        estimatedTax: 0,
        couponDiscount: 0,
        grandTotal: 220000,
      },
      statusHistory: [
        {
          status: payload.status || 'PROCESSING',
          changedAt: new Date(),
          changedBy: adminUserId || null,
          note: `[DEMO INITIALIZATION] Explicit demo order created for fulfillment simulation${
            payload.notes ? `: ${payload.notes}` : ''
          }`,
        },
      ],
    };

    try {
      const created = await Order.create(demoOrderDoc);
      return Array.isArray(created) ? created[0] : created;
    } catch (err) {
      if (err.code === 11000 || err.message?.includes('E11000')) {
        const conflictError = new Error(`Demo order with number '${orderNumber}' already exists`);
        conflictError.statusCode = 409;
        conflictError.code = 'ORDER_ALREADY_EXISTS';
        throw conflictError;
      }
      throw err;
    }
  }

  /**
   * Cancel an order requested directly by the authenticated customer
   * @param {string} userId - Authenticated customer ID
   * @param {string} orderIdentifier - Order ID or Order Number
   * @param {object} [options]
   * @param {string} [options.reason]
   * @returns {Promise<object>} Cancelled order snapshot
   */
  async cancelCustomerOrder(userId, orderIdentifier, { reason } = {}) {
    if (!orderIdentifier || typeof orderIdentifier !== 'string') {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    const trimmedIdentifier = orderIdentifier.trim();
    let order;

    if (mongoose.Types.ObjectId.isValid(trimmedIdentifier)) {
      order = await Order.findOne({
        $or: [
          { _id: trimmedIdentifier },
          { orderNumber: trimmedIdentifier.toUpperCase() },
        ],
      });
    } else {
      order = await Order.findOne({
        orderNumber: trimmedIdentifier.toUpperCase(),
      });
    }

    if (!order) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    // 1. Strict Ownership Enforcement
    if (order.userId.toString() !== userId.toString()) {
      const error = new Error('You do not have permission to cancel this order');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    // 2. Demo Order Isolation: Reject simulated demo orders from customer endpoint
    if (isDemoOrder(order) || order.isDemo === true) {
      const error = new Error('Demo orders cannot be cancelled via customer endpoint');
      error.statusCode = 400;
      error.code = 'DEMO_ORDER_NOT_ALLOWED';
      throw error;
    }

    // 3. State Machine & Status Eligibility
    if (order.status === ORDER_STATUS.SHIPPED || order.status === ORDER_STATUS.DELIVERED) {
      const error = new Error(
        `Cannot cancel order once it has been ${order.status.toLowerCase()}. Please contact concierge support for returns.`
      );
      error.statusCode = 400;
      error.code = 'ORDER_NOT_CANCELLABLE';
      throw error;
    }

    if (order.status === ORDER_STATUS.CANCELLED) {
      const error = new Error('Order is already cancelled');
      error.statusCode = 409;
      error.code = 'ORDER_ALREADY_CANCELLED';
      throw error;
    }

    if (!canTransition(order.status, ORDER_STATUS.CANCELLED)) {
      const error = new Error(`Order in status '${order.status}' is not eligible for cancellation`);
      error.statusCode = 400;
      error.code = 'ORDER_NOT_CANCELLABLE';
      throw error;
    }

    // 4. Delegate to authoritative status update & atomic inventory restoration
    const cancellationNote = reason && reason.trim()
      ? `Customer cancelled: ${reason.trim()}`
      : 'Customer self-service cancellation';

    return await this.updateOrderStatus(
      order.orderNumber,
      {
        status: ORDER_STATUS.CANCELLED,
        note: cancellationNote,
      },
      userId
    );
  }
}

export default new OrderService();
