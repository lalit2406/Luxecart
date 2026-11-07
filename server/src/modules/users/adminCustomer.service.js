import mongoose from 'mongoose';
import User from './user.model.js';
import Address from '../addresses/address.model.js';
import Order from '../orders/order.model.js';

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class AdminCustomerService {
  /**
   * List customers with pagination, search, status filtering, and order metrics
   * Strictly filters role: 'CUSTOMER' so admin accounts are never exposed.
   *
   * @param {{ page: number, limit: number, status: string, search?: string, sortBy: string, sortOrder: string }} options
   * @returns {Promise<{ customers: Array, pagination: object }>}
   */
  async getCustomers({ page = 1, limit = 20, status = 'ALL', search, sortBy = 'createdAt', sortOrder = 'desc' }) {
    const filter = { role: 'CUSTOMER' };

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
      ];
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortDirection };

    const [total, customers] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .select('_id name email phone status createdAt')
        .lean(),
    ]);

    if (!customers.length) {
      return {
        customers: [],
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || 1,
        },
      };
    }

    // Compute live order metrics for listed customers (excluding demo orders)
    const customerIds = customers.map((c) => c._id);
    const orderMetrics = await Order.aggregate([
      {
        $match: {
          userId: { $in: customerIds },
          isDemo: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$userId',
          totalOrders: { $sum: 1 },
          totalSpentPaise: {
            $sum: {
              $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$pricing.grandTotal', 0],
            },
          },
        },
      },
    ]);

    const metricsMap = new Map();
    orderMetrics.forEach((m) => {
      metricsMap.set(m._id.toString(), {
        totalOrders: m.totalOrders || 0,
        totalSpentPaise: m.totalSpentPaise || 0,
      });
    });

    const formattedCustomers = customers.map((c) => {
      const stats = metricsMap.get(c._id.toString()) || { totalOrders: 0, totalSpentPaise: 0 };
      return {
        id: c._id.toString(),
        name: c.name,
        email: c.email,
        phone: c.phone || null,
        status: c.status,
        createdAt: c.createdAt,
        totalOrders: stats.totalOrders,
        totalSpentPaise: stats.totalSpentPaise,
      };
    });

    return {
      customers: formattedCustomers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single customer profile, addresses, order summary metrics, and status history
   * Strictly forbids admin account retrieval.
   *
   * @param {string} customerId
   * @returns {Promise<{ customer: object }>}
   */
  async getCustomerById(customerId) {
    if (!mongoose.isValidObjectId(customerId)) {
      const error = new Error('Invalid customer ID format');
      error.statusCode = 400;
      error.code = 'INVALID_ID';
      throw error;
    }

    const user = await User.findById(customerId).select('+statusHistory').lean();
    if (!user) {
      const error = new Error('Customer not found');
      error.statusCode = 404;
      error.code = 'CUSTOMER_NOT_FOUND';
      throw error;
    }

    if (user.role === 'ADMIN') {
      const error = new Error('Cannot access or modify admin accounts via customer management');
      error.statusCode = 403;
      error.code = 'CANNOT_MODIFY_ADMIN_ACCOUNT';
      throw error;
    }

    const [addresses, orderMetrics] = await Promise.all([
      Address.find({ userId: customerId })
        .sort({ isDefault: -1, createdAt: -1 })
        .lean(),
      Order.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(customerId),
            isDemo: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSpentPaise: {
              $sum: {
                $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$pricing.grandTotal', 0],
              },
            },
            lastOrderDate: { $max: '$createdAt' },
          },
        },
      ]),
    ]);

    const summary = orderMetrics[0] || {
      totalOrders: 0,
      totalSpentPaise: 0,
      lastOrderDate: null,
    };
    delete summary._id;

    return {
      customer: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        avatar: user.avatar || null,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        addresses: addresses.map((addr) => ({
          id: addr._id.toString(),
          fullName: addr.fullName,
          phone: addr.phone,
          addressLine1: addr.addressLine1,
          addressLine2: addr.addressLine2,
          landmark: addr.landmark,
          city: addr.city,
          state: addr.state,
          postalCode: addr.postalCode,
          country: addr.country,
          isDefault: addr.isDefault,
          type: addr.type,
        })),
        orderSummary: summary,
        statusHistory: (user.statusHistory || []).map((event) => ({
          id: event._id ? event._id.toString() : undefined,
          status: event.status,
          changedAt: event.changedAt,
          changedBy: event.changedBy ? event.changedBy.toString() : null,
          note: event.note || '',
        })),
      },
    };
  }

  /**
   * Get customer's paginated order history
   * Excludes demo orders with isDemo: { $ne: true }.
   * Strictly forbids admin account retrieval.
   *
   * @param {string} customerId
   * @param {{ page: number, limit: number }} options
   * @returns {Promise<{ orders: Array, pagination: object }>}
   */
  async getCustomerOrders(customerId, { page = 1, limit = 10 }) {
    if (!mongoose.isValidObjectId(customerId)) {
      const error = new Error('Invalid customer ID format');
      error.statusCode = 400;
      error.code = 'INVALID_ID';
      throw error;
    }

    const user = await User.findById(customerId).select('role').lean();
    if (!user) {
      const error = new Error('Customer not found');
      error.statusCode = 404;
      error.code = 'CUSTOMER_NOT_FOUND';
      throw error;
    }

    if (user.role === 'ADMIN') {
      const error = new Error('Cannot access or modify admin accounts via customer management');
      error.statusCode = 403;
      error.code = 'CANNOT_MODIFY_ADMIN_ACCOUNT';
      throw error;
    }

    const filter = {
      userId: customerId,
      isDemo: { $ne: true },
    };

    const [total, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('orderNumber status payment paymentStatus pricing items.title items.quantity items.totalPrice createdAt updatedAt')
        .lean(),
    ]);

    const formattedOrders = orders.map((o) => ({
      id: o._id.toString(),
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus || o.payment?.status,
      itemCount: o.pricing?.itemCount || (o.items ? o.items.length : 0),
      grandTotalPaise: o.pricing?.grandTotal || 0,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      items: (o.items || []).map((item) => ({
        title: item.title,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
      })),
    }));

    return {
      orders: formattedOrders,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Update customer account status (ACTIVE or SUSPENDED)
   * If SUSPENDED, atomically clears refreshTokens to revoke session refresh capability.
   * Strictly forbids admin account status modification.
   *
   * @param {string} customerId
   * @param {{ status: 'ACTIVE' | 'SUSPENDED', reason?: string }} data
   * @param {string} adminUserId
   * @returns {Promise<object>}
   */
  async updateCustomerStatus(customerId, { status, reason }, adminUserId) {
    if (!mongoose.isValidObjectId(customerId)) {
      const error = new Error('Invalid customer ID format');
      error.statusCode = 400;
      error.code = 'INVALID_ID';
      throw error;
    }

    const user = await User.findById(customerId).select('role status');
    if (!user) {
      const error = new Error('Customer not found');
      error.statusCode = 404;
      error.code = 'CUSTOMER_NOT_FOUND';
      throw error;
    }

    if (user.role === 'ADMIN') {
      const error = new Error('Cannot access or modify admin accounts via customer management');
      error.statusCode = 403;
      error.code = 'CANNOT_MODIFY_ADMIN_ACCOUNT';
      throw error;
    }

    const updateOps = {
      $set: { status },
      $push: {
        statusHistory: {
          status,
          changedAt: new Date(),
          changedBy: adminUserId || null,
          note: reason || '',
        },
      },
    };

    // When suspending a customer, immediately clear all refresh tokens
    // Note: stateless access tokens will expire within their 15-minute validity window.
    if (status === 'SUSPENDED') {
      updateOps.$set.refreshTokens = [];
    }

    const updatedUser = await User.findByIdAndUpdate(customerId, updateOps, {
      new: true,
      runValidators: true,
    })
      .select('_id name email phone status createdAt updatedAt statusHistory')
      .lean();

    return {
      id: updatedUser._id.toString(),
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone || null,
      status: updatedUser.status,
      updatedAt: updatedUser.updatedAt,
      statusHistory: updatedUser.statusHistory || [],
    };
  }
}

const adminCustomerService = new AdminCustomerService();
export default adminCustomerService;
