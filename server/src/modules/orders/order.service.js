import mongoose from 'mongoose';
import Order from './order.model.js';
import Cart from '../cart/cart.model.js';
import Address from '../addresses/address.model.js';
import Product from '../products/product.model.js';
import User from '../users/user.model.js';
import couponService from '../coupons/coupon.service.js';
import { generateOrderNumber } from '../../utils/orderNumber.js';
import { assertValidTransition, ORDER_STATUS } from './orderStateMachine.js';

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
    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ userId, idempotencyKey });
      if (existingOrder) {
        return existingOrder;
      }
    }

    // 2. Fetch authenticated customer's cart
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

    const shippingPaise = 0; // Free delivery
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

    const orderNumber = await generateOrderNumber();

    const orderPayload = {
      orderNumber,
      userId,
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

    const [orders, total] = await Promise.all([
      Order.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments({ userId }),
    ]);

    return {
      orders,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
    };
  }

  /**
   * Retrieve paginated order listing for the admin dashboard with search, status filtering, and metrics
   * @param {object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @param {string} [options.status]
   * @param {string} [options.search]
   * @param {string} [options.sortBy='createdAt']
   * @param {string} [options.sortOrder='desc']
   * @returns {Promise<{ orders: Array<object>, pagination: object, metrics: object }>}
   */
  async getAdminOrders({
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

    // 1. Build Query Filter
    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status;
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
          // Atomically lock & update order status to CANCELLED
          const updatedOrder = await Order.findOneAndUpdate(
            { _id: currentOrder._id, status: currentOrder.status },
            {
              $set: { status: ORDER_STATUS.CANCELLED },
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

          // Rollback coupon usage if applied
          if (currentOrder.coupon?.code) {
            await couponService.rollbackCouponUsage(currentOrder.coupon.code, session);
          }

          // Restore inventory for each item in the order
          for (const item of currentOrder.items) {
            await Product.updateOne(
              {
                _id: item.productId,
                variants: {
                  $elemMatch: {
                    _id: item.variantId,
                  },
                },
              },
              {
                $inc: { 'variants.$.inventory.stock': item.quantity },
              },
              { session }
            );
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
        // Atomic compare-and-swap on order status first
        const updatedOrder = await Order.findOneAndUpdate(
          { _id: currentOrder._id, status: currentOrder.status },
          {
            $set: { status: ORDER_STATUS.CANCELLED },
            $push: { statusHistory: historyEvent },
          },
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

        // Rollback coupon usage if applied
        if (currentOrder.coupon?.code) {
          await couponService.rollbackCouponUsage(currentOrder.coupon.code);
        }

        // Restore inventory for all items
        for (const item of currentOrder.items) {
          await Product.updateOne(
            {
              _id: item.productId,
              variants: {
                $elemMatch: {
                  _id: item.variantId,
                },
              },
            },
            {
              $inc: { 'variants.$.inventory.stock': item.quantity },
            }
          );
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
          createdAt: updatedOrder.createdAt,
          updatedAt: updatedOrder.updatedAt,
        };
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
      createdAt: updatedOrder.createdAt,
      updatedAt: updatedOrder.updatedAt,
    };
  }
}

export default new OrderService();
