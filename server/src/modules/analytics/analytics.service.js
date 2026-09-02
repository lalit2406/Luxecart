import mongoose from 'mongoose';
import Order from '../orders/order.model.js';
import Return from '../returns/return.model.js';
import Product from '../products/product.model.js';
import Category from '../categories/category.model.js';
import User from '../users/user.model.js';
import {
  ANALYTICS_RANGES,
  TIME_GRANULARITY,
  CUSTOMER_SEGMENTS,
  HIGH_VALUE_CUSTOMER_THRESHOLD_PAISE,
  ORDER_VALUE_BUCKETS,
} from './analytics.constants.js';

class AnalyticsService {
  /**
   * Resolve date boundary objects from request query parameters
   * @param {object} param - { range, startDate, endDate }
   * @returns {{ start: Date|null, end: Date, range: string, granularity: string, dateFormat: string }}
   */
  resolveDateBounds({ range = ANALYTICS_RANGES.THIRTY_DAYS, startDate = null, endDate = null } = {}) {
    const now = new Date();
    let start = null;
    let end = endDate || now;
    let granularity = TIME_GRANULARITY.DAY;
    let dateFormat = '%Y-%m-%d';

    switch (range) {
      case ANALYTICS_RANGES.SEVEN_DAYS:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        granularity = TIME_GRANULARITY.DAY;
        dateFormat = '%Y-%m-%d';
        break;

      case ANALYTICS_RANGES.THIRTY_DAYS:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        granularity = TIME_GRANULARITY.DAY;
        dateFormat = '%Y-%m-%d';
        break;

      case ANALYTICS_RANGES.THIS_YEAR:
        start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
        granularity = TIME_GRANULARITY.MONTH;
        dateFormat = '%Y-%m';
        break;

      case ANALYTICS_RANGES.ALL:
        start = null;
        granularity = TIME_GRANULARITY.MONTH;
        dateFormat = '%Y-%m';
        break;

      case ANALYTICS_RANGES.CUSTOM:
        start = startDate || null;
        end = endDate || now;
        if (start && end) {
          const diffMs = end.getTime() - start.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays <= 31) {
            granularity = TIME_GRANULARITY.DAY;
            dateFormat = '%Y-%m-%d';
          } else {
            granularity = TIME_GRANULARITY.MONTH;
            dateFormat = '%Y-%m';
          }
        }
        break;

      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        granularity = TIME_GRANULARITY.DAY;
        dateFormat = '%Y-%m-%d';
    }

    return { start, end, range, granularity, dateFormat };
  }

  /**
   * Compute comprehensive analytics summary metrics
   * @param {object} params - { range, startDate, endDate }
   * @returns {Promise<object>}
   */
  async getAnalyticsSummary(params = {}) {
    const { start, end, range } = this.resolveDateBounds(params);

    const orderMatch = {};
    if (start || end) {
      orderMatch.createdAt = {};
      if (start) orderMatch.createdAt.$gte = start;
      if (end) orderMatch.createdAt.$lte = end;
    }

    const returnMatch = { status: 'REFUNDED' };
    if (start || end) {
      returnMatch.updatedAt = {};
      if (start) returnMatch.updatedAt.$gte = start;
      if (end) returnMatch.updatedAt.$lte = end;
    }

    const [orderMetricsResult, returnMetricsResult] = await Promise.all([
      Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            deliveredOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] },
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] },
            },
            shippedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'SHIPPED'] }, 1, 0] },
            },
            processingOrders: {
              $sum: {
                $cond: [{ $in: ['$status', ['CONFIRMED', 'PROCESSING']] }, 1, 0],
              },
            },
            placedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'PLACED'] }, 1, 0] },
            },
            grossRevenuePaise: {
              $sum: {
                $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$pricing.grandTotal', 0],
              },
            },
            nonCancelledOrders: {
              $sum: {
                $cond: [{ $ne: ['$status', 'CANCELLED'] }, 1, 0],
              },
            },
            activeCustomers: {
              $addToSet: {
                $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$userId', '$$REMOVE'],
              },
            },
          },
        },
      ]),
      Return.aggregate([
        { $match: returnMatch },
        {
          $group: {
            _id: null,
            totalRefunds: { $sum: 1 },
            refundAmountPaise: { $sum: '$totalRefundAmount' },
            returnedOrderIds: { $addToSet: '$orderId' },
          },
        },
      ]),
    ]);

    const orderMetrics = orderMetricsResult[0] || {};
    const returnMetrics = returnMetricsResult[0] || {};

    const totalOrders = orderMetrics.totalOrders || 0;
    const deliveredOrders = orderMetrics.deliveredOrders || 0;
    const cancelledOrders = orderMetrics.cancelledOrders || 0;
    const shippedOrders = orderMetrics.shippedOrders || 0;
    const processingOrders = orderMetrics.processingOrders || 0;
    const placedOrders = orderMetrics.placedOrders || 0;

    const grossRevenuePaise = orderMetrics.grossRevenuePaise || 0;
    const totalRevenuePaise = grossRevenuePaise;
    const refundAmountPaise = returnMetrics.refundAmountPaise || 0;
    const netSalesPaise = Math.max(0, grossRevenuePaise - refundAmountPaise);

    const nonCancelledOrders = orderMetrics.nonCancelledOrders || 0;
    const averageOrderValuePaise =
      nonCancelledOrders > 0 ? Math.round(grossRevenuePaise / nonCancelledOrders) : 0;

    const activeCustomerCount = Array.isArray(orderMetrics.activeCustomers)
      ? orderMetrics.activeCustomers.length
      : 0;

    const returnedOrders = Array.isArray(returnMetrics.returnedOrderIds)
      ? returnMetrics.returnedOrderIds.length
      : 0;

    return {
      range,
      startDate: start,
      endDate: end,
      metrics: {
        totalOrders,
        totalRevenuePaise,
        grossRevenuePaise,
        refundAmountPaise,
        netSalesPaise,
        averageOrderValuePaise,
        activeCustomerCount,
        deliveredOrders,
        cancelledOrders,
        shippedOrders,
        processingOrders,
        placedOrders,
        returnedOrders,
      },
    };
  }

  /**
   * Aggregate time-series sales trends
   * @param {object} params - { range, startDate, endDate }
   * @returns {Promise<object>}
   */
  async getSalesTrends(params = {}) {
    const { start, end, range, granularity, dateFormat } = this.resolveDateBounds(params);

    const orderMatch = {
      status: { $ne: 'CANCELLED' },
    };
    if (start || end) {
      orderMatch.createdAt = {};
      if (start) orderMatch.createdAt.$gte = start;
      if (end) orderMatch.createdAt.$lte = end;
    }

    const returnMatch = {
      status: 'REFUNDED',
    };
    if (start || end) {
      returnMatch.updatedAt = {};
      if (start) returnMatch.updatedAt.$gte = start;
      if (end) returnMatch.updatedAt.$lte = end;
    }

    const [orderSeries, returnSeries] = await Promise.all([
      Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: dateFormat,
                date: '$createdAt',
                timezone: 'UTC',
              },
            },
            orders: { $sum: 1 },
            revenuePaise: { $sum: '$pricing.grandTotal' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Return.aggregate([
        { $match: returnMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: dateFormat,
                date: '$updatedAt',
                timezone: 'UTC',
              },
            },
            refunds: { $sum: 1 },
            refundPaise: { $sum: '$totalRefundAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const timeSeriesMap = new Map();

    for (const item of orderSeries) {
      timeSeriesMap.set(item._id, {
        date: item._id,
        orders: item.orders,
        revenuePaise: item.revenuePaise,
        refundPaise: 0,
        netSalesPaise: item.revenuePaise,
      });
    }

    for (const item of returnSeries) {
      if (timeSeriesMap.has(item._id)) {
        const existing = timeSeriesMap.get(item._id);
        existing.refundPaise = item.refundPaise;
        existing.netSalesPaise = Math.max(0, existing.revenuePaise - item.refundPaise);
      } else {
        timeSeriesMap.set(item._id, {
          date: item._id,
          orders: 0,
          revenuePaise: 0,
          refundPaise: item.refundPaise,
          netSalesPaise: 0,
        });
      }
    }

    const series = Array.from(timeSeriesMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return {
      range,
      granularity,
      startDate: start,
      endDate: end,
      series,
    };
  }

  /**
   * Aggregate product-level sales, revenue, refunds, and units
   * @param {object} params
   * @returns {Promise<object>}
   */
  async getProductPerformance({
    range = ANALYTICS_RANGES.THIRTY_DAYS,
    startDate = null,
    endDate = null,
    page = 1,
    limit = 10,
    sortBy = 'revenue',
    sortOrder = 'desc',
    search = '',
    categoryId = null,
  } = {}) {
    const { start, end, range: resolvedRange } = this.resolveDateBounds({ range, startDate, endDate });

    const orderMatch = {
      status: { $ne: 'CANCELLED' },
    };
    if (start || end) {
      orderMatch.createdAt = {};
      if (start) orderMatch.createdAt.$gte = start;
      if (end) orderMatch.createdAt.$lte = end;
    }

    const returnMatch = {
      status: 'REFUNDED',
    };
    if (start || end) {
      returnMatch.updatedAt = {};
      if (start) returnMatch.updatedAt.$gte = start;
      if (end) returnMatch.updatedAt.$lte = end;
    }

    // 1. Order pipeline for product sales
    const orderPipeline = [
      { $match: orderMatch },
      { $unwind: '$items' },
    ];

    if (categoryId) {
      orderPipeline.push(
        {
          $lookup: {
            from: 'products',
            localField: 'items.productId',
            foreignField: '_id',
            as: 'prodMeta',
          },
        },
        { $unwind: { path: '$prodMeta', preserveNullAndEmptyArrays: true } },
        { $match: { 'prodMeta.category': new mongoose.Types.ObjectId(categoryId) } }
      );
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      orderPipeline.push({
        $match: {
          $or: [
            { 'items.name': { $regex: escaped, $options: 'i' } },
            { 'items.brand': { $regex: escaped, $options: 'i' } },
            { 'items.sku': { $regex: escaped, $options: 'i' } },
          ],
        },
      });
    }

    orderPipeline.push({
      $group: {
        _id: '$items.productId',
        productName: { $first: '$items.name' },
        brand: { $first: '$items.brand' },
        slug: { $first: '$items.slug' },
        sku: { $first: '$items.sku' },
        image: { $first: '$items.image' },
        unitsSold: { $sum: '$items.quantity' },
        orderIds: { $addToSet: '$_id' },
        grossRevenuePaise: { $sum: '$items.lineSubtotal' },
      },
    });

    // 2. Returns pipeline for product refunds
    const returnPipeline = [
      { $match: returnMatch },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          returnUnits: { $sum: '$items.requestedQuantity' },
          refundAmountPaise: { $sum: '$items.calculatedRefundAmount' },
        },
      },
    ];

    const [orderResults, returnResults] = await Promise.all([
      Order.aggregate(orderPipeline),
      Return.aggregate(returnPipeline),
    ]);

    const returnMap = new Map();
    for (const ret of returnResults) {
      if (ret._id) {
        returnMap.set(ret._id.toString(), ret);
      }
    }

    // Enrich with live product categories and stock
    const productIds = orderResults.map((r) => r._id).filter(Boolean);
    const liveProducts = await Product.find({ _id: { $in: productIds } })
      .populate('category', 'name slug')
      .lean();

    const liveProductMap = new Map();
    for (const p of liveProducts) {
      const totalStock = (p.variants || []).reduce((acc, v) => acc + (v.inventory?.stock || 0), 0);
      liveProductMap.set(p._id.toString(), {
        category: p.category?.name || 'Uncategorized',
        categoryId: p.category?._id || null,
        currentStock: totalStock,
      });
    }

    const products = orderResults.map((item) => {
      const pIdStr = item._id ? item._id.toString() : '';
      const refundData = returnMap.get(pIdStr) || { returnUnits: 0, refundAmountPaise: 0 };
      const liveData = liveProductMap.get(pIdStr) || {
        category: 'Uncategorized',
        categoryId: null,
        currentStock: 0,
      };

      const grossRevenuePaise = item.grossRevenuePaise || 0;
      const refundAmountPaise = refundData.refundAmountPaise || 0;
      const netSalesPaise = Math.max(0, grossRevenuePaise - refundAmountPaise);

      return {
        productId: item._id,
        productName: item.productName || 'Unknown Product',
        brand: item.brand || '',
        slug: item.slug || '',
        sku: item.sku || '',
        image: item.image || '',
        category: liveData.category,
        categoryId: liveData.categoryId,
        currentStock: liveData.currentStock,
        unitsSold: item.unitsSold || 0,
        orderCount: item.orderIds?.length || 0,
        grossRevenuePaise,
        refundAmountPaise,
        netSalesPaise,
        returnUnits: refundData.returnUnits || 0,
      };
    });

    // Sorting
    const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
    products.sort((a, b) => {
      switch (sortBy) {
        case 'units':
          return (a.unitsSold - b.unitsSold) * sortMultiplier;
        case 'orders':
          return (a.orderCount - b.orderCount) * sortMultiplier;
        case 'net_sales':
          return (a.netSalesPaise - b.netSalesPaise) * sortMultiplier;
        case 'returns':
          return (a.returnUnits - b.returnUnits) * sortMultiplier;
        case 'revenue':
        default:
          return (a.grossRevenuePaise - b.grossRevenuePaise) * sortMultiplier;
      }
    });

    const total = products.length;
    const skip = (page - 1) * limit;
    const paginatedProducts = products.slice(skip, skip + limit);

    return {
      range: resolvedRange,
      startDate: start,
      endDate: end,
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Aggregate category-level revenue, units, and sales performance
   * @param {object} params
   * @returns {Promise<object>}
   */
  async getCategoryPerformance({
    range = ANALYTICS_RANGES.THIRTY_DAYS,
    startDate = null,
    endDate = null,
    page = 1,
    limit = 20,
    sortBy = 'revenue',
    sortOrder = 'desc',
    search = '',
  } = {}) {
    const { start, end, range: resolvedRange } = this.resolveDateBounds({ range, startDate, endDate });

    const orderMatch = {
      status: { $ne: 'CANCELLED' },
    };
    if (start || end) {
      orderMatch.createdAt = {};
      if (start) orderMatch.createdAt.$gte = start;
      if (end) orderMatch.createdAt.$lte = end;
    }

    const returnMatch = {
      status: 'REFUNDED',
    };
    if (start || end) {
      returnMatch.updatedAt = {};
      if (start) returnMatch.updatedAt.$gte = start;
      if (end) returnMatch.updatedAt.$lte = end;
    }

    // 1. Order Pipeline by Category
    const orderPipeline = [
      { $match: orderMatch },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productDoc',
        },
      },
      { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'productDoc.category',
          foreignField: '_id',
          as: 'categoryDoc',
        },
      },
      { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
    ];

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      orderPipeline.push({
        $match: {
          'categoryDoc.name': { $regex: escaped, $options: 'i' },
        },
      });
    }

    orderPipeline.push({
      $group: {
        _id: '$productDoc.category',
        categoryName: { $first: { $ifNull: ['$categoryDoc.name', 'Uncategorized'] } },
        categorySlug: { $first: { $ifNull: ['$categoryDoc.slug', ''] } },
        unitsSold: { $sum: '$items.quantity' },
        orderIds: { $addToSet: '$_id' },
        grossRevenuePaise: { $sum: '$items.lineSubtotal' },
        productIds: { $addToSet: '$items.productId' },
      },
    });

    // 2. Return Pipeline by Category
    const returnPipeline = [
      { $match: returnMatch },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productDoc',
        },
      },
      { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$productDoc.category',
          returnUnits: { $sum: '$items.requestedQuantity' },
          refundAmountPaise: { $sum: '$items.calculatedRefundAmount' },
        },
      },
    ];

    const [orderResults, returnResults] = await Promise.all([
      Order.aggregate(orderPipeline),
      Return.aggregate(returnPipeline),
    ]);

    const returnMap = new Map();
    for (const ret of returnResults) {
      const catIdKey = ret._id ? ret._id.toString() : 'null';
      returnMap.set(catIdKey, ret);
    }

    const totalGrossPaise = orderResults.reduce((acc, c) => acc + (c.grossRevenuePaise || 0), 0);

    const categories = orderResults.map((item) => {
      const catIdKey = item._id ? item._id.toString() : 'null';
      const refundData = returnMap.get(catIdKey) || { returnUnits: 0, refundAmountPaise: 0 };

      const grossRevenuePaise = item.grossRevenuePaise || 0;
      const refundAmountPaise = refundData.refundAmountPaise || 0;
      const netSalesPaise = Math.max(0, grossRevenuePaise - refundAmountPaise);

      const contributionPercent =
        totalGrossPaise > 0
          ? Number(((grossRevenuePaise / totalGrossPaise) * 100).toFixed(2))
          : 0;

      return {
        categoryId: item._id,
        categoryName: item.categoryName,
        categorySlug: item.categorySlug,
        unitsSold: item.unitsSold || 0,
        orderCount: item.orderIds?.length || 0,
        productCount: item.productIds?.length || 0,
        grossRevenuePaise,
        refundAmountPaise,
        netSalesPaise,
        returnUnits: refundData.returnUnits || 0,
        contributionPercent,
      };
    });

    const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
    categories.sort((a, b) => {
      switch (sortBy) {
        case 'units':
          return (a.unitsSold - b.unitsSold) * sortMultiplier;
        case 'orders':
          return (a.orderCount - b.orderCount) * sortMultiplier;
        case 'net_sales':
          return (a.netSalesPaise - b.netSalesPaise) * sortMultiplier;
        case 'returns':
          return (a.returnUnits - b.returnUnits) * sortMultiplier;
        case 'revenue':
        default:
          return (a.grossRevenuePaise - b.grossRevenuePaise) * sortMultiplier;
      }
    });

    const total = categories.length;
    const skip = (page - 1) * limit;
    const paginatedCategories = categories.slice(skip, skip + limit);

    return {
      range: resolvedRange,
      startDate: start,
      endDate: end,
      totalGrossRevenuePaise: totalGrossPaise,
      categories: paginatedCategories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Aggregate customer-level commerce metrics, repeat purchase rates, and segmentation
   * @param {object} params
   * @returns {Promise<object>}
   */
  async getCustomerPerformance({
    range = ANALYTICS_RANGES.THIRTY_DAYS,
    startDate = null,
    endDate = null,
    page = 1,
    limit = 10,
    sortBy = 'revenue',
    sortOrder = 'desc',
    search = '',
    segment = null,
  } = {}) {
    const { start, end, range: resolvedRange } = this.resolveDateBounds({ range, startDate, endDate });

    const orderMatch = {};
    if (start || end) {
      orderMatch.createdAt = {};
      if (start) orderMatch.createdAt.$gte = start;
      if (end) orderMatch.createdAt.$lte = end;
    }

    const returnMatch = { status: 'REFUNDED' };
    if (start || end) {
      returnMatch.updatedAt = {};
      if (start) returnMatch.updatedAt.$gte = start;
      if (end) returnMatch.updatedAt.$lte = end;
    }

    // 1. Group Orders by Customer (userId) in period
    const [orderCustomerResults, returnCustomerResults] = await Promise.all([
      Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: '$userId',
            totalOrders: { $sum: 1 },
            deliveredOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] },
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] },
            },
            validOrders: {
              $sum: { $cond: [{ $ne: ['$status', 'CANCELLED'] }, 1, 0] },
            },
            grossRevenuePaise: {
              $sum: {
                $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$pricing.grandTotal', 0],
              },
            },
            totalUnits: {
              $sum: {
                $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$pricing.totalUnits', 0],
              },
            },
            firstOrderDateInPeriod: { $min: '$createdAt' },
            latestOrderDate: { $max: '$createdAt' },
          },
        },
      ]),
      Return.aggregate([
        { $match: returnMatch },
        {
          $group: {
            _id: '$userId',
            refundAmountPaise: { $sum: '$totalRefundAmount' },
            returnCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const returnMap = new Map();
    for (const ret of returnCustomerResults) {
      if (ret._id) returnMap.set(ret._id.toString(), ret);
    }

    const userIds = orderCustomerResults.map((r) => r._id).filter(Boolean);

    // Fetch lifetime order history to accurately identify first-ever order date & lifetime order count
    const lifetimeOrderStats = await Order.aggregate([
      { $match: { userId: { $in: userIds }, status: { $ne: 'CANCELLED' } } },
      {
        $group: {
          _id: '$userId',
          firstLifetimeOrderDate: { $min: '$createdAt' },
          lifetimeOrderCount: { $sum: 1 },
        },
      },
    ]);

    const lifetimeMap = new Map();
    for (const stat of lifetimeOrderStats) {
      if (stat._id) lifetimeMap.set(stat._id.toString(), stat);
    }

    // Fetch user profiles (name, email)
    const userProfiles = await User.find({ _id: { $in: userIds } })
      .select('name email createdAt')
      .lean();

    const userMap = new Map();
    for (const u of userProfiles) {
      userMap.set(u._id.toString(), u);
    }

    const nowTime = Date.now();

    // Map each customer
    let allCustomers = orderCustomerResults.map((item) => {
      const uIdStr = item._id ? item._id.toString() : '';
      const user = userMap.get(uIdStr) || { name: 'Customer', email: 'N/A', createdAt: item.firstOrderDateInPeriod };
      const refundData = returnMap.get(uIdStr) || { refundAmountPaise: 0, returnCount: 0 };
      const lifetimeData = lifetimeMap.get(uIdStr) || { firstLifetimeOrderDate: item.firstOrderDateInPeriod, lifetimeOrderCount: item.validOrders };

      const grossRevenuePaise = item.grossRevenuePaise || 0;
      const refundAmountPaise = refundData.refundAmountPaise || 0;
      const netSalesPaise = Math.max(0, grossRevenuePaise - refundAmountPaise);

      const validOrders = item.validOrders || 0;
      const averageOrderValuePaise = validOrders > 0 ? Math.round(grossRevenuePaise / validOrders) : 0;

      const latestOrderDate = item.latestOrderDate;
      const daysSinceLatestOrder = latestOrderDate ? Math.floor((nowTime - new Date(latestOrderDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Customer Segmentation Rule:
      // 1. HIGH_VALUE: netSalesPaise >= HIGH_VALUE_CUSTOMER_THRESHOLD_PAISE (5,000,000 paise / ₹50,000)
      // 2. REPEAT: lifetimeOrderCount >= 2 or validOrders >= 2 (or first lifetime order was before this period start)
      // 3. NEW: first-ever order placed within this period AND lifetimeOrderCount === 1
      let customerSegment = CUSTOMER_SEGMENTS.NEW;
      const isRepeat = lifetimeData.lifetimeOrderCount >= 2 || validOrders >= 2 || (start && lifetimeData.firstLifetimeOrderDate < start);

      if (netSalesPaise >= HIGH_VALUE_CUSTOMER_THRESHOLD_PAISE) {
        customerSegment = CUSTOMER_SEGMENTS.HIGH_VALUE;
      } else if (isRepeat) {
        customerSegment = CUSTOMER_SEGMENTS.REPEAT;
      } else {
        customerSegment = CUSTOMER_SEGMENTS.NEW;
      }

      return {
        customerId: item._id,
        name: user.name || 'Anonymous Customer',
        email: user.email || 'N/A',
        totalOrders: item.totalOrders || 0,
        deliveredOrders: item.deliveredOrders || 0,
        cancelledOrders: item.cancelledOrders || 0,
        validOrders,
        totalUnits: item.totalUnits || 0,
        grossRevenuePaise,
        refundAmountPaise,
        netSalesPaise,
        averageOrderValuePaise,
        firstOrderDate: item.firstOrderDateInPeriod,
        latestOrderDate,
        daysSinceLatestOrder,
        segment: customerSegment,
        isRepeatCustomer: isRepeat,
      };
    });

    // Search filter
    if (search) {
      const cleanSearchLower = search.toLowerCase();
      allCustomers = allCustomers.filter(
        (c) =>
          c.name.toLowerCase().includes(cleanSearchLower) ||
          c.email.toLowerCase().includes(cleanSearchLower)
      );
    }

    // Calculate Summary KPIs across all qualifying customers in period (before segment filter & pagination)
    const totalCustomers = allCustomers.length;
    const newCustomers = allCustomers.filter((c) => c.segment === CUSTOMER_SEGMENTS.NEW).length;
    const repeatCustomers = allCustomers.filter((c) => c.isRepeatCustomer || c.segment === CUSTOMER_SEGMENTS.REPEAT).length;
    const highValueCustomers = allCustomers.filter((c) => c.segment === CUSTOMER_SEGMENTS.HIGH_VALUE).length;

    const repeatCustomerRatePercent =
      totalCustomers > 0 ? Number(((repeatCustomers / totalCustomers) * 100).toFixed(2)) : 0;

    const totalNetSales = allCustomers.reduce((acc, c) => acc + c.netSalesPaise, 0);
    const totalValidOrders = allCustomers.reduce((acc, c) => acc + c.validOrders, 0);

    const averageCustomerValuePaise =
      totalCustomers > 0 ? Math.round(totalNetSales / totalCustomers) : 0;
    const averageOrdersPerCustomer =
      totalCustomers > 0 ? Number((totalValidOrders / totalCustomers).toFixed(2)) : 0;

    // Segment filter
    if (segment) {
      allCustomers = allCustomers.filter((c) => c.segment === segment);
    }

    // Sort
    const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
    allCustomers.sort((a, b) => {
      switch (sortBy) {
        case 'net_sales':
          return (a.netSalesPaise - b.netSalesPaise) * sortMultiplier;
        case 'orders':
          return (a.totalOrders - b.totalOrders) * sortMultiplier;
        case 'units':
          return (a.totalUnits - b.totalUnits) * sortMultiplier;
        case 'aov':
          return (a.averageOrderValuePaise - b.averageOrderValuePaise) * sortMultiplier;
        case 'latest_order':
          return (new Date(a.latestOrderDate).getTime() - new Date(b.latestOrderDate).getTime()) * sortMultiplier;
        case 'revenue':
        default:
          return (a.grossRevenuePaise - b.grossRevenuePaise) * sortMultiplier;
      }
    });

    const total = allCustomers.length;
    const skip = (page - 1) * limit;
    const paginatedCustomers = allCustomers.slice(skip, skip + limit);

    return {
      range: resolvedRange,
      startDate: start,
      endDate: end,
      summary: {
        totalCustomers,
        newCustomers,
        repeatCustomers,
        highValueCustomers,
        repeatCustomerRatePercent,
        averageCustomerValuePaise,
        averageOrdersPerCustomer,
      },
      customers: paginatedCustomers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Aggregate order value distribution across standard monetary brackets
   * @param {object} params
   * @returns {Promise<object>}
   */
  async getOrderDistribution(params = {}) {
    const { start, end, range } = this.resolveDateBounds(params);

    const orderMatch = {
      status: { $ne: 'CANCELLED' },
    };
    if (start || end) {
      orderMatch.createdAt = {};
      if (start) orderMatch.createdAt.$gte = start;
      if (end) orderMatch.createdAt.$lte = end;
    }

    const orders = await Order.find(orderMatch).select('pricing.grandTotal createdAt').lean();
    const totalQualifyingOrders = orders.length;
    const totalRevenuePaise = orders.reduce((acc, o) => acc + (o.pricing?.grandTotal || 0), 0);

    const buckets = ORDER_VALUE_BUCKETS.map((b) => {
      const matchingOrders = orders.filter((o) => {
        const grandTotal = o.pricing?.grandTotal || 0;
        if (b.maxPaise !== null) {
          return grandTotal >= b.minPaise && grandTotal <= b.maxPaise;
        }
        return grandTotal >= b.minPaise;
      });

      const orderCount = matchingOrders.length;
      const grossRevenuePaise = matchingOrders.reduce((acc, o) => acc + (o.pricing?.grandTotal || 0), 0);
      const orderSharePercent =
        totalQualifyingOrders > 0
          ? Number(((orderCount / totalQualifyingOrders) * 100).toFixed(2))
          : 0;

      return {
        label: b.label,
        minPaise: b.minPaise,
        maxPaise: b.maxPaise,
        orderCount,
        grossRevenuePaise,
        orderSharePercent,
      };
    });

    return {
      range,
      startDate: start,
      endDate: end,
      totalQualifyingOrders,
      totalRevenuePaise,
      buckets,
    };
  }

  /**
   * Aggregate new vs returning customer time-series trends
   * @param {object} params
   * @returns {Promise<object>}
   */
  async getCustomerTrends(params = {}) {
    const { start, end, range, granularity, dateFormat } = this.resolveDateBounds(params);

    const orderMatch = {
      status: { $ne: 'CANCELLED' },
    };
    if (start || end) {
      orderMatch.createdAt = {};
      if (start) orderMatch.createdAt.$gte = start;
      if (end) orderMatch.createdAt.$lte = end;
    }

    // 1. Fetch all non-cancelled orders in period with userId, grandTotal, createdAt
    const periodOrders = await Order.find(orderMatch)
      .select('userId pricing.grandTotal createdAt')
      .sort({ createdAt: 1 })
      .lean();

    const distinctUserIds = [...new Set(periodOrders.map((o) => o.userId?.toString()).filter(Boolean))];

    // 2. Fetch first lifetime order date for each user
    const lifetimeFirstOrders = await Order.aggregate([
      { $match: { userId: { $in: distinctUserIds.map((id) => new mongoose.Types.ObjectId(id)) }, status: { $ne: 'CANCELLED' } } },
      {
        $group: {
          _id: '$userId',
          firstOrderDate: { $min: '$createdAt' },
        },
      },
    ]);

    const firstOrderMap = new Map();
    for (const item of lifetimeFirstOrders) {
      if (item._id) firstOrderMap.set(item._id.toString(), new Date(item.firstOrderDate));
    }

    // 3. Group by period bucket
    const bucketMap = new Map();

    for (const order of periodOrders) {
      const orderDate = new Date(order.createdAt);
      let periodKey = '';

      if (granularity === TIME_GRANULARITY.MONTH) {
        const year = orderDate.getUTCFullYear();
        const month = String(orderDate.getUTCMonth() + 1).padStart(2, '0');
        periodKey = `${year}-${month}`;
      } else {
        const year = orderDate.getUTCFullYear();
        const month = String(orderDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(orderDate.getUTCDate()).padStart(2, '0');
        periodKey = `${year}-${month}-${day}`;
      }

      if (!bucketMap.has(periodKey)) {
        bucketMap.set(periodKey, {
          period: periodKey,
          date: periodKey,
          userIds: new Set(),
          newCustomerIds: new Set(),
          returningCustomerIds: new Set(),
          orderCount: 0,
          netSalesPaise: 0,
        });
      }

      const bucket = bucketMap.get(periodKey);
      bucket.orderCount += 1;
      bucket.netSalesPaise += order.pricing?.grandTotal || 0;

      const uIdStr = order.userId?.toString();
      if (uIdStr) {
        bucket.userIds.add(uIdStr);
        const firstDate = firstOrderMap.get(uIdStr);

        // Check if customer's very first order happened in this exact bucket
        let isFirstInThisBucket = false;
        if (firstDate) {
          if (granularity === TIME_GRANULARITY.MONTH) {
            const fYear = firstDate.getUTCFullYear();
            const fMonth = String(firstDate.getUTCMonth() + 1).padStart(2, '0');
            isFirstInThisBucket = `${fYear}-${fMonth}` === periodKey;
          } else {
            const fYear = firstDate.getUTCFullYear();
            const fMonth = String(firstDate.getUTCMonth() + 1).padStart(2, '0');
            const fDay = String(firstDate.getUTCDate()).padStart(2, '0');
            isFirstInThisBucket = `${fYear}-${fMonth}-${fDay}` === periodKey;
          }
        }

        if (isFirstInThisBucket) {
          bucket.newCustomerIds.add(uIdStr);
        } else {
          bucket.returningCustomerIds.add(uIdStr);
        }
      }
    }

    const series = Array.from(bucketMap.values())
      .map((b) => ({
        period: b.period,
        date: b.period,
        newCustomers: b.newCustomerIds.size,
        returningCustomers: b.returningCustomerIds.size,
        activeCustomers: b.userIds.size,
        orderCount: b.orderCount,
        netSalesPaise: b.netSalesPaise,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      range,
      granularity,
      startDate: start,
      endDate: end,
      series,
    };
  }

  /**
   * Aggregate high-level operational inventory summary metrics
   * @returns {Promise<object>}
   */
  async getInventorySummary() {
    const products = await Product.find({}).populate('category', 'name').lean();

    let totalProducts = products.length;
    let activeProducts = 0;
    let draftProducts = 0;
    let archivedProducts = 0;

    let totalVariants = 0;
    let activeVariants = 0;

    let totalStockUnits = 0;
    let reservedUnits = 0;
    let availableUnits = 0;

    let outOfStockVariants = 0;
    let lowStockVariants = 0;
    let healthyVariants = 0;

    let outOfStockProducts = 0;
    let lowStockProducts = 0;

    let inventoryValuePaise = 0;

    for (const prod of products) {
      if (prod.status === 'ACTIVE') activeProducts++;
      else if (prod.status === 'DRAFT') draftProducts++;
      else if (prod.status === 'ARCHIVED') archivedProducts++;

      const variants = prod.variants || [];
      totalVariants += variants.length;

      let prodAllOutOfStock = true;
      let prodHasLowStock = false;
      let prodHasActiveVariants = false;

      for (const v of variants) {
        if (!v.isActive && prod.status !== 'ACTIVE') continue;
        activeVariants++;
        prodHasActiveVariants = true;

        const stock = v.inventory?.stock ?? 0;
        const reserved = v.inventory?.reserved ?? 0;
        const available = Math.max(0, stock - reserved);
        const threshold = v.inventory?.lowStockThreshold ?? 5;
        const price = v.price || 0;

        totalStockUnits += stock;
        reservedUnits += reserved;
        availableUnits += available;
        inventoryValuePaise += available * price;

        if (stock === 0) {
          outOfStockVariants++;
        } else if (stock <= threshold) {
          lowStockVariants++;
          prodHasLowStock = true;
          prodAllOutOfStock = false;
        } else {
          healthyVariants++;
          prodAllOutOfStock = false;
        }
      }

      if (prod.status === 'ACTIVE' && prodHasActiveVariants) {
        if (prodAllOutOfStock) {
          outOfStockProducts++;
        } else if (prodHasLowStock) {
          lowStockProducts++;
        }
      }
    }

    return {
      totalProducts,
      activeProducts,
      draftProducts,
      archivedProducts,
      totalVariants,
      activeVariants,
      totalStockUnits,
      reservedUnits,
      availableUnits,
      outOfStockVariants,
      lowStockVariants,
      healthyVariants,
      outOfStockProducts,
      lowStockProducts,
      inventoryValuePaise,
    };
  }

  /**
   * Aggregate variant-level inventory health records with search, status filtering, and sorting
   * @param {object} params
   * @returns {Promise<object>}
   */
  async getInventoryHealth({
    page = 1,
    limit = 20,
    search = '',
    status = 'ALL',
    categoryId = null,
    sortBy = 'available',
    sortOrder = 'asc',
  } = {}) {
    const filter = { status: 'ACTIVE' };
    if (categoryId) {
      filter.category = new mongoose.Types.ObjectId(categoryId);
    }

    const products = await Product.find(filter).populate('category', 'name slug').lean();

    let variantRecords = [];

    for (const prod of products) {
      const categoryName = prod.category?.name || 'Uncategorized';
      const catId = prod.category?._id || null;

      for (const v of prod.variants || []) {
        if (v.isActive === false) continue;

        const stock = v.inventory?.stock ?? 0;
        const reserved = v.inventory?.reserved ?? 0;
        const available = Math.max(0, stock - reserved);
        const lowStockThreshold = v.inventory?.lowStockThreshold ?? 5;
        const inventoryValuePaise = available * (v.price || 0);

        let health = 'HEALTHY';
        if (stock === 0) health = 'OUT_OF_STOCK';
        else if (stock <= lowStockThreshold) health = 'LOW_STOCK';

        let risk = 'LOW';
        if (stock === 0) risk = 'CRITICAL';
        else if (stock <= lowStockThreshold) risk = 'HIGH';
        else if (stock <= lowStockThreshold * 2) risk = 'MEDIUM';

        variantRecords.push({
          productId: prod._id,
          productName: prod.name,
          brand: prod.brand || '',
          slug: prod.slug,
          sku: v.sku || '',
          category: categoryName,
          categoryId: catId,
          variantId: v._id,
          color: v.attributes?.color?.name || '',
          size: v.attributes?.size || '',
          stock,
          reserved,
          available,
          lowStockThreshold,
          inventoryValuePaise,
          health,
          risk,
          updatedAt: prod.updatedAt,
        });
      }
    }

    // Status filter
    if (status && status !== 'ALL') {
      variantRecords = variantRecords.filter((r) => r.health === status);
    }

    // Search filter
    if (search) {
      const cleanSearch = search.toLowerCase();
      variantRecords = variantRecords.filter(
        (r) =>
          r.productName.toLowerCase().includes(cleanSearch) ||
          r.brand.toLowerCase().includes(cleanSearch) ||
          r.sku.toLowerCase().includes(cleanSearch) ||
          r.color.toLowerCase().includes(cleanSearch) ||
          r.size.toLowerCase().includes(cleanSearch)
      );
    }

    // Sorting
    const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
    variantRecords.sort((a, b) => {
      switch (sortBy) {
        case 'stock':
          return (a.stock - b.stock) * sortMultiplier;
        case 'reserved':
          return (a.reserved - b.reserved) * sortMultiplier;
        case 'inventory_value':
          return (a.inventoryValuePaise - b.inventoryValuePaise) * sortMultiplier;
        case 'threshold':
          return (a.lowStockThreshold - b.lowStockThreshold) * sortMultiplier;
        case 'updated_at':
          return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * sortMultiplier;
        case 'available':
        default:
          return (a.available - b.available) * sortMultiplier;
      }
    });

    const total = variantRecords.length;
    const skip = (page - 1) * limit;
    const paginatedRecords = variantRecords.slice(skip, skip + limit);

    return {
      variants: paginatedRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Aggregate operational low-stock variants
   * @param {object} params
   * @returns {Promise<object>}
   */
  async getLowStockVariants(params = {}) {
    return this.getInventoryHealth({
      ...params,
      status: 'LOW_STOCK',
      sortBy: params.sortBy || 'available',
      sortOrder: params.sortOrder || 'asc',
    });
  }

  /**
   * Aggregate operational out-of-stock variants
   * @param {object} params
   * @returns {Promise<object>}
   */
  async getOutOfStockVariants(params = {}) {
    return this.getInventoryHealth({
      ...params,
      status: 'OUT_OF_STOCK',
      sortBy: params.sortBy || 'updated_at',
      sortOrder: params.sortOrder || 'desc',
    });
  }

  /**
   * Aggregate category-level inventory concentration and stock allocation
   * @param {object} params
   * @returns {Promise<object>}
   */
  async getInventoryConcentration({ search = '', sortBy = 'stock', sortOrder = 'desc' } = {}) {
    const products = await Product.find({ status: 'ACTIVE' }).populate('category', 'name slug').lean();

    const categoryMap = new Map();
    let grandTotalAvailable = 0;
    let grandTotalValuePaise = 0;

    for (const prod of products) {
      const catIdKey = prod.category?._id ? prod.category._id.toString() : 'uncategorized';
      const catName = prod.category?.name || 'Uncategorized';

      if (!categoryMap.has(catIdKey)) {
        categoryMap.set(catIdKey, {
          categoryId: prod.category?._id || null,
          categoryName: catName,
          variantCount: 0,
          stockUnits: 0,
          reservedUnits: 0,
          availableUnits: 0,
          inventoryValuePaise: 0,
          outOfStockVariants: 0,
          lowStockVariants: 0,
        });
      }

      const catEntry = categoryMap.get(catIdKey);

      for (const v of prod.variants || []) {
        if (v.isActive === false) continue;

        const stock = v.inventory?.stock ?? 0;
        const reserved = v.inventory?.reserved ?? 0;
        const available = Math.max(0, stock - reserved);
        const threshold = v.inventory?.lowStockThreshold ?? 5;
        const valPaise = available * (v.price || 0);

        catEntry.variantCount += 1;
        catEntry.stockUnits += stock;
        catEntry.reservedUnits += reserved;
        catEntry.availableUnits += available;
        catEntry.inventoryValuePaise += valPaise;

        grandTotalAvailable += available;
        grandTotalValuePaise += valPaise;

        if (stock === 0) {
          catEntry.outOfStockVariants += 1;
        } else if (stock <= threshold) {
          catEntry.lowStockVariants += 1;
        }
      }
    }

    let categories = Array.from(categoryMap.values()).map((c) => {
      const inventorySharePercent =
        grandTotalAvailable > 0
          ? Number(((c.availableUnits / grandTotalAvailable) * 100).toFixed(2))
          : 0;

      return {
        ...c,
        inventorySharePercent,
      };
    });

    if (search) {
      const cleanSearch = search.toLowerCase();
      categories = categories.filter((c) => c.categoryName.toLowerCase().includes(cleanSearch));
    }

    const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
    categories.sort((a, b) => {
      switch (sortBy) {
        case 'available':
          return (a.availableUnits - b.availableUnits) * sortMultiplier;
        case 'inventory_value':
          return (a.inventoryValuePaise - b.inventoryValuePaise) * sortMultiplier;
        case 'variants':
          return (a.variantCount - b.variantCount) * sortMultiplier;
        case 'name':
          return a.categoryName.localeCompare(b.categoryName) * sortMultiplier;
        case 'stock':
        default:
          return (a.stockUnits - b.stockUnits) * sortMultiplier;
      }
    });

    return {
      totalAvailableUnits: grandTotalAvailable,
      totalInventoryValuePaise: grandTotalValuePaise,
      categories,
    };
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
