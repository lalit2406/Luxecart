import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import Order from '../orders/order.model.js';
import User from '../users/user.model.js';
import Product from '../products/product.model.js';
import Category from '../categories/category.model.js';
import Coupon from '../coupons/coupon.model.js';
import Return from '../returns/return.model.js';

const MAX_EXPORT_RECORDS = 25000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Format Date to Indian Standard Time (IST) YYYY-MM-DD HH:mm:ss string
 * Independent of the server-local operating system timezone.
 *
 * @param {Date | string | number} d
 * @returns {string}
 */
export const formatToIstString = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  const yyyy = istDate.getUTCFullYear();
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getUTCDate()).padStart(2, '0');
  const hh = String(istDate.getUTCHours()).padStart(2, '0');
  const min = String(istDate.getUTCMinutes()).padStart(2, '0');
  const ss = String(istDate.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

/**
 * Sanitize untrusted user-controlled text against spreadsheet formula injection (CSV/XLSX)
 * Prepends a single quote (') if the string begins with =, +, -, @, tab, or CR.
 *
 * @param {any} val
 * @returns {string}
 */
export const sanitizeSpreadsheetText = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

/**
 * Format a list of column values into a sanitized RFC-4180 compliant CSV line
 *
 * @param {Array<any>} values
 * @returns {string}
 */
export const formatCsvLine = (values) => {
  return (
    values
      .map((val) => {
        if (val === null || val === undefined) return '';
        let str = String(val);
        // Formula injection protection
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        // CSV quote wrapping and escaping
        if (/[",\n\r]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',') + '\r\n'
  );
};

/**
 * Helper to write CSV chunk with HTTP backpressure handling and client disconnect safety
 */
const writeCsvChunk = async (res, chunk) => {
  if (res.destroyed || res.writableEnded) {
    throw new Error('Response stream closed by client');
  }
  if (!res.write(chunk)) {
    await new Promise((resolve, reject) => {
      const onDrain = () => {
        cleanup();
        resolve();
      };
      const onClose = () => {
        cleanup();
        reject(new Error('Response stream closed by client'));
      };
      const cleanup = () => {
        res.removeListener('drain', onDrain);
        res.removeListener('close', onClose);
      };
      res.once('drain', onDrain);
      res.once('close', onClose);
    });
  }
};

class AdminExportService {
  /**
   * Safe preflight count checker to enforce the maximum 25,000 records export limit
   * Throws HTTP 400 error if record count exceeds the ceiling.
   */
  assertRecordLimit(count, descriptor = 'records') {
    if (count > MAX_EXPORT_RECORDS) {
      const error = new Error(
        `Export exceeds the maximum limit of ${MAX_EXPORT_RECORDS.toLocaleString('en-IN')} records (${count.toLocaleString('en-IN')} ${descriptor} matched). Please narrow your date range or status filters.`
      );
      error.statusCode = 400;
      error.code = 'EXPORT_LIMIT_EXCEEDED';
      throw error;
    }
  }

  // ==========================================================================
  // 1. ORDERS & SALES EXPORT
  // ==========================================================================
  buildOrdersFilter(options) {
    const { startUtc, endUtcExclusive, status, orderType, paymentStatus } = options;
    const filter = {};
    if (startUtc || endUtcExclusive) {
      filter.createdAt = {};
      if (startUtc) filter.createdAt.$gte = startUtc;
      if (endUtcExclusive) filter.createdAt.$lt = endUtcExclusive;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (paymentStatus && paymentStatus !== 'ALL') {
      filter['payment.status'] = paymentStatus;
    }

    if (orderType === 'LIVE') {
      filter.isDemo = { $ne: true };
    } else if (orderType === 'DEMO') {
      filter.isDemo = true;
    }
    return filter;
  }

  async assertOrdersLimit(options) {
    const filter = this.buildOrdersFilter(options);
    if (options.type === 'itemized') {
      const countAgg = await Order.aggregate([
        { $match: filter },
        { $group: { _id: null, totalItems: { $sum: { $size: { $ifNull: ['$items', []] } } } } },
      ]);
      const totalItems = countAgg[0]?.totalItems || 0;
      this.assertRecordLimit(totalItems, 'order items');
    } else {
      const totalOrders = await Order.countDocuments(filter);
      this.assertRecordLimit(totalOrders, 'orders');
    }
  }

  async exportOrders(options, res) {
    const { format, type } = options;
    const filter = this.buildOrdersFilter(options);

    const cursor = Order.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone')
      .cursor();

    try {
      if (type === 'itemized') {
        const columns = [
          { header: 'Order Number', key: 'orderNumber', width: 22 },
          { header: 'Order Date (IST)', key: 'date', width: 22 },
          { header: 'Order Status', key: 'orderStatus', width: 15 },
          { header: 'Order Type', key: 'orderType', width: 12 },
          { header: 'Customer Name', key: 'customerName', width: 22 },
          { header: 'Customer Email', key: 'customerEmail', width: 28 },
          { header: 'Product Title', key: 'title', width: 30 },
          { header: 'SKU', key: 'sku', width: 18 },
          { header: 'Size', key: 'size', width: 10 },
          { header: 'Color', key: 'color', width: 14 },
          { header: 'Quantity', key: 'quantity', width: 10 },
          { header: 'Unit Price (₹)', key: 'unitPrice', width: 14 },
          { header: 'Line Subtotal (₹)', key: 'lineSubtotal', width: 16 },
          { header: 'Line Savings (₹)', key: 'lineSavings', width: 16 },
          { header: 'Payment Status', key: 'paymentStatus', width: 15 },
        ];

        if (format === 'xlsx') {
          const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
          const worksheet = workbook.addWorksheet('Itemized Orders');
          worksheet.columns = columns;

          for await (const order of cursor) {
            const cust = order.userId || {};
            const items = order.items || [];
            for (const item of items) {
              const row = worksheet.addRow({
                orderNumber: sanitizeSpreadsheetText(order.orderNumber),
                date: formatToIstString(order.createdAt),
                orderStatus: order.status,
                orderType: order.isDemo ? 'DEMO' : 'LIVE',
                customerName: sanitizeSpreadsheetText(cust.name || order.shippingAddress?.fullName || 'Customer'),
                customerEmail: sanitizeSpreadsheetText(cust.email || '—'),
                title: sanitizeSpreadsheetText(item.title || item.name || 'Product'),
                sku: sanitizeSpreadsheetText(item.sku || '—'),
                size: sanitizeSpreadsheetText(item.size || item.attributes?.size || '—'),
                color: sanitizeSpreadsheetText(item.color?.name || item.attributes?.color?.name || '—'),
                quantity: item.quantity || 1,
                unitPrice: Number(((item.price || 0) / 100).toFixed(2)),
                lineSubtotal: Number(((item.lineSubtotal || 0) / 100).toFixed(2)),
                lineSavings: Number(((item.lineSavings || 0) / 100).toFixed(2)),
                paymentStatus: order.payment?.status || 'PENDING',
              });
              row.commit();
            }
          }
          await worksheet.commit();
          await workbook.commit();
        } else {
          // CSV Streaming
          await writeCsvChunk(res, formatCsvLine(columns.map((c) => c.header)));
          for await (const order of cursor) {
            const cust = order.userId || {};
            const items = order.items || [];
            for (const item of items) {
              const line = formatCsvLine([
                order.orderNumber,
                formatToIstString(order.createdAt),
                order.status,
                order.isDemo ? 'DEMO' : 'LIVE',
                cust.name || order.shippingAddress?.fullName || 'Customer',
                cust.email || '—',
                item.title || item.name || 'Product',
                item.sku || '—',
                item.size || item.attributes?.size || '—',
                item.color?.name || item.attributes?.color?.name || '—',
                item.quantity || 1,
                ((item.price || 0) / 100).toFixed(2),
                ((item.lineSubtotal || 0) / 100).toFixed(2),
                ((item.lineSavings || 0) / 100).toFixed(2),
                order.payment?.status || 'PENDING',
              ]);
              await writeCsvChunk(res, line);
            }
          }
        }
      } else {
        // Summary Export
        const columns = [
          { header: 'Order Number', key: 'orderNumber', width: 22 },
          { header: 'Order Date (IST)', key: 'date', width: 22 },
          { header: 'Order Status', key: 'orderStatus', width: 15 },
          { header: 'Order Type', key: 'orderType', width: 12 },
          { header: 'Customer Name', key: 'customerName', width: 22 },
          { header: 'Customer Email', key: 'customerEmail', width: 28 },
          { header: 'Customer Phone', key: 'customerPhone', width: 18 },
          { header: 'Delivery City', key: 'city', width: 16 },
          { header: 'Delivery State', key: 'state', width: 16 },
          { header: 'Delivery PIN', key: 'postalCode', width: 12 },
          { header: 'Payment Method', key: 'paymentMethod', width: 18 },
          { header: 'Payment Status', key: 'paymentStatus', width: 15 },
          { header: 'Item Count', key: 'itemCount', width: 12 },
          { header: 'Subtotal (₹)', key: 'subtotal', width: 14 },
          { header: 'Discount (₹)', key: 'couponDiscount', width: 14 },
          { header: 'Shipping Fee (₹)', key: 'shipping', width: 14 },
          { header: 'Grand Total (₹)', key: 'grandTotal', width: 15 },
          { header: 'Coupon Code', key: 'couponCode', width: 15 },
        ];

        if (format === 'xlsx') {
          const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
          const worksheet = workbook.addWorksheet('Orders Summary');
          worksheet.columns = columns;

          for await (const order of cursor) {
            const cust = order.userId || {};
            const addr = order.shippingAddress || {};
            const pricing = order.pricing || {};
            const row = worksheet.addRow({
              orderNumber: sanitizeSpreadsheetText(order.orderNumber),
              date: formatToIstString(order.createdAt),
              orderStatus: order.status,
              orderType: order.isDemo ? 'DEMO' : 'LIVE',
              customerName: sanitizeSpreadsheetText(cust.name || addr.fullName || 'Customer'),
              customerEmail: sanitizeSpreadsheetText(cust.email || '—'),
              customerPhone: sanitizeSpreadsheetText(cust.phone || addr.phone || '—'),
              city: sanitizeSpreadsheetText(addr.city || '—'),
              state: sanitizeSpreadsheetText(addr.state || '—'),
              postalCode: sanitizeSpreadsheetText(addr.postalCode || '—'),
              paymentMethod: order.payment?.method || 'CASH_ON_DELIVERY',
              paymentStatus: order.payment?.status || 'PENDING',
              itemCount: pricing.itemCount || (order.items ? order.items.length : 0),
              subtotal: Number(((pricing.subtotal || 0) / 100).toFixed(2)),
              couponDiscount: Number(((pricing.couponDiscount || 0) / 100).toFixed(2)),
              shipping: Number(((pricing.shipping || 0) / 100).toFixed(2)),
              grandTotal: Number(((pricing.grandTotal || 0) / 100).toFixed(2)),
              couponCode: sanitizeSpreadsheetText(order.coupon?.code || 'None'),
            });
            row.commit();
          }
          await worksheet.commit();
          await workbook.commit();
        } else {
          // CSV Streaming
          await writeCsvChunk(res, formatCsvLine(columns.map((c) => c.header)));
          for await (const order of cursor) {
            const cust = order.userId || {};
            const addr = order.shippingAddress || {};
            const pricing = order.pricing || {};
            const line = formatCsvLine([
              order.orderNumber,
              formatToIstString(order.createdAt),
              order.status,
              order.isDemo ? 'DEMO' : 'LIVE',
              cust.name || addr.fullName || 'Customer',
              cust.email || '—',
              cust.phone || addr.phone || '—',
              addr.city || '—',
              addr.state || '—',
              addr.postalCode || '—',
              order.payment?.method || 'CASH_ON_DELIVERY',
              order.payment?.status || 'PENDING',
              pricing.itemCount || (order.items ? order.items.length : 0),
              ((pricing.subtotal || 0) / 100).toFixed(2),
              ((pricing.couponDiscount || 0) / 100).toFixed(2),
              ((pricing.shipping || 0) / 100).toFixed(2),
              ((pricing.grandTotal || 0) / 100).toFixed(2),
              order.coupon?.code || 'None',
            ]);
            await writeCsvChunk(res, line);
          }
        }
      }
    } finally {
      if (typeof cursor?.close === 'function') {
        await cursor.close().catch(() => {});
      } else if (typeof cursor?.destroy === 'function') {
        cursor.destroy();
      }
    }
  }

  // ==========================================================================
  // 2. CUSTOMERS EXPORT
  // ==========================================================================
  buildCustomersFilter(options) {
    const { startUtc, endUtcExclusive, status } = options;
    const filter = { role: 'CUSTOMER' };

    if (startUtc || endUtcExclusive) {
      filter.createdAt = {};
      if (startUtc) filter.createdAt.$gte = startUtc;
      if (endUtcExclusive) filter.createdAt.$lt = endUtcExclusive;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }
    return filter;
  }

  async assertCustomersLimit(options) {
    const filter = this.buildCustomersFilter(options);
    const totalCustomers = await User.countDocuments(filter);
    this.assertRecordLimit(totalCustomers, 'customers');
  }

  async exportCustomers(options, res) {
    const { format } = options;
    const filter = this.buildCustomersFilter(options);

    // Aggregate lifetime order metrics per customer (excluding demo orders)
    const orderMetrics = await Order.aggregate([
      { $match: { isDemo: { $ne: true } } },
      {
        $group: {
          _id: '$userId',
          totalOrders: { $sum: 1 },
          totalSpentPaise: {
            $sum: { $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$pricing.grandTotal', 0] },
          },
        },
      },
    ]);

    const metricsMap = new Map();
    orderMetrics.forEach((m) => {
      if (m._id) {
        metricsMap.set(m._id.toString(), {
          totalOrders: m.totalOrders || 0,
          totalSpentPaise: m.totalSpentPaise || 0,
        });
      }
    });

    const columns = [
      { header: 'Customer ID', key: 'id', width: 26 },
      { header: 'Full Name', key: 'name', width: 24 },
      { header: 'Email Address', key: 'email', width: 28 },
      { header: 'Phone Number', key: 'phone', width: 18 },
      { header: 'Account Status', key: 'status', width: 14 },
      { header: 'Joined Date (IST)', key: 'createdAt', width: 22 },
      { header: 'Lifetime Orders', key: 'totalOrders', width: 16 },
      { header: 'Lifetime Spend (₹)', key: 'lifetimeSpend', width: 18 },
    ];

    // Explicit projection of safe operational fields
    const cursor = User.find(filter)
      .sort({ createdAt: -1 })
      .select('_id name email phone status createdAt')
      .cursor();

    try {
      if (format === 'xlsx') {
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
        const worksheet = workbook.addWorksheet('Customers');
        worksheet.columns = columns;

        for await (const user of cursor) {
          const stats = metricsMap.get(user._id.toString()) || { totalOrders: 0, totalSpentPaise: 0 };
          const row = worksheet.addRow({
            id: user._id.toString(),
            name: sanitizeSpreadsheetText(user.name),
            email: sanitizeSpreadsheetText(user.email),
            phone: sanitizeSpreadsheetText(user.phone || '—'),
            status: user.status,
            createdAt: formatToIstString(user.createdAt),
            totalOrders: stats.totalOrders,
            lifetimeSpend: Number(((stats.totalSpentPaise || 0) / 100).toFixed(2)),
          });
          row.commit();
        }
        await worksheet.commit();
        await workbook.commit();
      } else {
        // CSV Streaming
        await writeCsvChunk(res, formatCsvLine(columns.map((c) => c.header)));
        for await (const user of cursor) {
          const stats = metricsMap.get(user._id.toString()) || { totalOrders: 0, totalSpentPaise: 0 };
          const line = formatCsvLine([
            user._id.toString(),
            user.name,
            user.email,
            user.phone || '—',
            user.status,
            formatToIstString(user.createdAt),
            stats.totalOrders,
            ((stats.totalSpentPaise || 0) / 100).toFixed(2),
          ]);
          await writeCsvChunk(res, line);
        }
      }
    } finally {
      if (typeof cursor?.close === 'function') {
        await cursor.close().catch(() => {});
      } else if (typeof cursor?.destroy === 'function') {
        cursor.destroy();
      }
    }
  }

  // ==========================================================================
  // 3. PRODUCTS & INVENTORY EXPORT
  // ==========================================================================
  async buildProductsFilter(options) {
    const { startUtc, endUtcExclusive, status, stockStatus, category } = options;
    const filter = {};
    if (startUtc || endUtcExclusive) {
      filter.createdAt = {};
      if (startUtc) filter.createdAt.$gte = startUtc;
      if (endUtcExclusive) filter.createdAt.$lt = endUtcExclusive;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (category) {
      if (mongoose.isValidObjectId(category)) {
        filter.category = category;
      } else {
        const catDoc = await Category.findOne({ slug: category }).select('_id').lean();
        if (catDoc) filter.category = catDoc._id;
      }
    }

    if (stockStatus === 'LOW_STOCK') {
      filter['priceSummary.hasStock'] = true;
      filter['priceSummary.totalStock'] = { $lte: 10 };
    } else if (stockStatus === 'OUT_OF_STOCK') {
      filter['priceSummary.hasStock'] = false;
    }
    return filter;
  }

  async assertProductsLimit(options) {
    const filter = await this.buildProductsFilter(options);
    const countAgg = await Product.aggregate([
      { $match: filter },
      { $group: { _id: null, totalVariants: { $sum: { $size: { $ifNull: ['$variants', []] } } } } },
    ]);
    const totalVariants = countAgg[0]?.totalVariants || 0;
    this.assertRecordLimit(totalVariants, 'product variants');
  }

  async exportProducts(options, res) {
    const { format } = options;
    const filter = await this.buildProductsFilter(options);

    const columns = [
      { header: 'Product Title', key: 'title', width: 30 },
      { header: 'Slug', key: 'slug', width: 26 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Gender', key: 'gender', width: 14 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Product Status', key: 'status', width: 15 },
      { header: 'Variant SKU', key: 'sku', width: 18 },
      { header: 'Barcode', key: 'barcode', width: 16 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Color', key: 'color', width: 14 },
      { header: 'Selling Price (₹)', key: 'price', width: 16 },
      { header: 'MRP (₹)', key: 'mrp', width: 14 },
      { header: 'Total Stock', key: 'stock', width: 12 },
      { header: 'Reserved Stock', key: 'reserved', width: 14 },
      { header: 'Available Stock', key: 'availableStock', width: 14 },
      { header: 'Low Stock Alert Level', key: 'lowStockThreshold', width: 18 },
      { header: 'Variant Active', key: 'isActive', width: 14 },
    ];

    const cursor = Product.find(filter)
      .sort({ createdAt: -1 })
      .populate('category', 'name')
      .cursor();

    try {
      if (format === 'xlsx') {
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
        const worksheet = workbook.addWorksheet('Products & Inventory');
        worksheet.columns = columns;

        for await (const prod of cursor) {
          const catName = prod.category?.name || 'Uncategorized';
          const variants = prod.variants || [];
          for (const v of variants) {
            const inv = v.inventory || {};
            const stock = inv.stock || 0;
            const reserved = inv.reserved || 0;
            const row = worksheet.addRow({
              title: sanitizeSpreadsheetText(prod.title),
              slug: sanitizeSpreadsheetText(prod.slug),
              brand: sanitizeSpreadsheetText(prod.brand),
              gender: prod.gender || 'UNISEX',
              category: sanitizeSpreadsheetText(catName),
              status: prod.status,
              sku: sanitizeSpreadsheetText(v.sku),
              barcode: sanitizeSpreadsheetText(v.barcode || '—'),
              size: sanitizeSpreadsheetText(v.attributes?.size || '—'),
              color: sanitizeSpreadsheetText(v.attributes?.color?.name || '—'),
              price: Number(v.price || 0), // Product prices are stored in Rupees directly
              mrp: Number(v.mrp || 0),
              stock,
              reserved,
              availableStock: Math.max(0, stock - reserved),
              lowStockThreshold: inv.lowStockThreshold || 5,
              isActive: v.isActive !== false ? 'YES' : 'NO',
            });
            row.commit();
          }
        }
        await worksheet.commit();
        await workbook.commit();
      } else {
        // CSV Streaming
        await writeCsvChunk(res, formatCsvLine(columns.map((c) => c.header)));
        for await (const prod of cursor) {
          const catName = prod.category?.name || 'Uncategorized';
          const variants = prod.variants || [];
          for (const v of variants) {
            const inv = v.inventory || {};
            const stock = inv.stock || 0;
            const reserved = inv.reserved || 0;
            const line = formatCsvLine([
              prod.title,
              prod.slug,
              prod.brand,
              prod.gender || 'UNISEX',
              catName,
              prod.status,
              v.sku,
              v.barcode || '—',
              v.attributes?.size || '—',
              v.attributes?.color?.name || '—',
              v.price || 0,
              v.mrp || 0,
              stock,
              reserved,
              Math.max(0, stock - reserved),
              inv.lowStockThreshold || 5,
              v.isActive !== false ? 'YES' : 'NO',
            ]);
            await writeCsvChunk(res, line);
          }
        }
      }
    } finally {
      if (typeof cursor?.close === 'function') {
        await cursor.close().catch(() => {});
      } else if (typeof cursor?.destroy === 'function') {
        cursor.destroy();
      }
    }
  }

  // ==========================================================================
  // 4. COUPONS EXPORT
  // ==========================================================================
  buildCouponsFilter(options) {
    const { startUtc, endUtcExclusive, status } = options;
    const filter = {};
    if (startUtc || endUtcExclusive) {
      filter.createdAt = {};
      if (startUtc) filter.createdAt.$gte = startUtc;
      if (endUtcExclusive) filter.createdAt.$lt = endUtcExclusive;
    }

    const now = new Date();
    if (status === 'ACTIVE') {
      filter.isActive = true;
      filter.expirationDate = { $gte: now };
    } else if (status === 'EXPIRED') {
      filter.expirationDate = { $lt: now };
    }
    return filter;
  }

  async assertCouponsLimit(options) {
    const filter = this.buildCouponsFilter(options);
    const totalCoupons = await Coupon.countDocuments(filter);
    this.assertRecordLimit(totalCoupons, 'coupons');
  }

  async exportCoupons(options, res) {
    const { format } = options;
    const filter = this.buildCouponsFilter(options);
    const now = new Date();

    const columns = [
      { header: 'Coupon Code', key: 'code', width: 18 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Discount Type', key: 'discountType', width: 16 },
      { header: 'Discount Value', key: 'discountValue', width: 14 },
      { header: 'Min Order Value (₹)', key: 'minOrderValue', width: 18 },
      { header: 'Max Discount (₹)', key: 'maxDiscountAmount', width: 16 },
      { header: 'Total Usage Limit', key: 'totalUsageLimit', width: 18 },
      { header: 'Used Count', key: 'usedCount', width: 12 },
      { header: 'Remaining Uses', key: 'remainingUses', width: 16 },
      { header: 'Per User Limit', key: 'perUserLimit', width: 14 },
      { header: 'Start Date (IST)', key: 'startDate', width: 22 },
      { header: 'Expiration Date (IST)', key: 'expirationDate', width: 22 },
      { header: 'Status', key: 'status', width: 14 },
    ];

    const cursor = Coupon.find(filter).sort({ createdAt: -1 }).cursor();

    try {
      if (format === 'xlsx') {
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
        const worksheet = workbook.addWorksheet('Coupons & Promotions');
        worksheet.columns = columns;

        for await (const coupon of cursor) {
          const isExpired = new Date(coupon.expirationDate) < now;
          const couponStatus = !coupon.isActive ? 'INACTIVE' : isExpired ? 'EXPIRED' : 'ACTIVE';
          const remaining = coupon.totalUsageLimit !== null ? Math.max(0, coupon.totalUsageLimit - coupon.usedCount) : 'Unlimited';

          const row = worksheet.addRow({
            code: sanitizeSpreadsheetText(coupon.code),
            description: sanitizeSpreadsheetText(coupon.description || '—'),
            discountType: coupon.discountType,
            discountValue: coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`,
            minOrderValue: coupon.minOrderValue || 0,
            maxDiscountAmount: coupon.maxDiscountAmount || 'No cap',
            totalUsageLimit: coupon.totalUsageLimit || 'Unlimited',
            usedCount: coupon.usedCount || 0,
            remainingUses: remaining,
            perUserLimit: coupon.perUserLimit || 1,
            startDate: formatToIstString(coupon.startDate),
            expirationDate: formatToIstString(coupon.expirationDate),
            status: couponStatus,
          });
          row.commit();
        }
        await worksheet.commit();
        await workbook.commit();
      } else {
        // CSV Streaming
        await writeCsvChunk(res, formatCsvLine(columns.map((c) => c.header)));
        for await (const coupon of cursor) {
          const isExpired = new Date(coupon.expirationDate) < now;
          const couponStatus = !coupon.isActive ? 'INACTIVE' : isExpired ? 'EXPIRED' : 'ACTIVE';
          const remaining = coupon.totalUsageLimit !== null ? Math.max(0, coupon.totalUsageLimit - coupon.usedCount) : 'Unlimited';

          const line = formatCsvLine([
            coupon.code,
            coupon.description || '—',
            coupon.discountType,
            coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`,
            coupon.minOrderValue || 0,
            coupon.maxDiscountAmount || 'No cap',
            coupon.totalUsageLimit || 'Unlimited',
            coupon.usedCount || 0,
            remaining,
            coupon.perUserLimit || 1,
            formatToIstString(coupon.startDate),
            formatToIstString(coupon.expirationDate),
            couponStatus,
          ]);
          await writeCsvChunk(res, line);
        }
      }
    } finally {
      if (typeof cursor?.close === 'function') {
        await cursor.close().catch(() => {});
      } else if (typeof cursor?.destroy === 'function') {
        cursor.destroy();
      }
    }
  }

  // ==========================================================================
  // 5. RETURNS EXPORT
  // ==========================================================================
  buildReturnsFilter(options) {
    const { startUtc, endUtcExclusive, status } = options;
    const filter = {};
    if (startUtc || endUtcExclusive) {
      filter.createdAt = {};
      if (startUtc) filter.createdAt.$gte = startUtc;
      if (endUtcExclusive) filter.createdAt.$lt = endUtcExclusive;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }
    return filter;
  }

  async assertReturnsLimit(options) {
    const filter = this.buildReturnsFilter(options);
    const totalReturns = await Return.countDocuments(filter);
    this.assertRecordLimit(totalReturns, 'returns');
  }

  async exportReturns(options, res) {
    const { format } = options;
    const filter = this.buildReturnsFilter(options);

    const columns = [
      { header: 'Return Number', key: 'returnNumber', width: 22 },
      { header: 'Order Number', key: 'orderNumber', width: 22 },
      { header: 'Customer ID', key: 'userId', width: 26 },
      { header: 'Return Status', key: 'status', width: 18 },
      { header: 'Requested Units', key: 'units', width: 16 },
      { header: 'Total Refund (₹)', key: 'refundAmount', width: 18 },
      { header: 'Items Returned', key: 'itemSummary', width: 35 },
      { header: 'Return Reasons', key: 'reasons', width: 25 },
      { header: 'Refund Method', key: 'refundMethod', width: 18 },
      { header: 'Refund Reference', key: 'refundReference', width: 20 },
      { header: 'Refunded Date (IST)', key: 'refundedAt', width: 22 },
      { header: 'Request Date (IST)', key: 'createdAt', width: 22 },
    ];

    const cursor = Return.find(filter).sort({ createdAt: -1 }).cursor();

    try {
      if (format === 'xlsx') {
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
        const worksheet = workbook.addWorksheet('Returns & Refunds');
        worksheet.columns = columns;

        for await (const ret of cursor) {
          const items = ret.items || [];
          const itemTitles = items.map((i) => `${i.name} (x${i.requestedQuantity})`).join('; ');
          const reasons = [...new Set(items.map((i) => i.reason))].join(', ');
          const refundDetails = ret.refundDetails || {};

          const row = worksheet.addRow({
            returnNumber: sanitizeSpreadsheetText(ret.returnNumber),
            orderNumber: sanitizeSpreadsheetText(ret.orderNumber),
            userId: ret.userId ? ret.userId.toString() : '—',
            status: ret.status,
            units: ret.totalRequestedUnits || 0,
            refundAmount: Number(((ret.totalRefundAmount || 0) / 100).toFixed(2)),
            itemSummary: sanitizeSpreadsheetText(itemTitles || '—'),
            reasons: sanitizeSpreadsheetText(reasons || '—'),
            refundMethod: refundDetails.method || '—',
            refundReference: sanitizeSpreadsheetText(refundDetails.referenceNumber || '—'),
            refundedAt: formatToIstString(refundDetails.refundedAt),
            createdAt: formatToIstString(ret.createdAt),
          });
          row.commit();
        }
        await worksheet.commit();
        await workbook.commit();
      } else {
        // CSV Streaming
        await writeCsvChunk(res, formatCsvLine(columns.map((c) => c.header)));
        for await (const ret of cursor) {
          const items = ret.items || [];
          const itemTitles = items.map((i) => `${i.name} (x${i.requestedQuantity})`).join('; ');
          const reasons = [...new Set(items.map((i) => i.reason))].join(', ');
          const refundDetails = ret.refundDetails || {};

          const line = formatCsvLine([
            ret.returnNumber,
            ret.orderNumber,
            ret.userId ? ret.userId.toString() : '—',
            ret.status,
            ret.totalRequestedUnits || 0,
            ((ret.totalRefundAmount || 0) / 100).toFixed(2),
            itemTitles || '—',
            reasons || '—',
            refundDetails.method || '—',
            refundDetails.referenceNumber || '—',
            formatToIstString(refundDetails.refundedAt),
            formatToIstString(ret.createdAt),
          ]);
          await writeCsvChunk(res, line);
        }
      }
    } finally {
      if (typeof cursor?.close === 'function') {
        await cursor.close().catch(() => {});
      } else if (typeof cursor?.destroy === 'function') {
        cursor.destroy();
      }
    }
  }

  // ==========================================================================
  // 6. SALES SUMMARY EXPORT
  // ==========================================================================
  async getSalesSummaryRecords(options) {
    const { startUtc, endUtcExclusive, groupBy = 'day', orderType = 'LIVE' } = options;

    const matchFilter = {};
    if (orderType === 'LIVE') {
      matchFilter.isDemo = { $ne: true };
    } else if (orderType === 'DEMO') {
      matchFilter.isDemo = true;
    }

    if (startUtc || endUtcExclusive) {
      matchFilter.createdAt = {};
      if (startUtc) matchFilter.createdAt.$gte = startUtc;
      if (endUtcExclusive) matchFilter.createdAt.$lt = endUtcExclusive;
    }

    const istTimezone = '+05:30';
    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'month') {
      dateFormat = '%Y-%m';
    } else if (groupBy === 'week') {
      dateFormat = '%G-W%V';
    }

    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$createdAt', timezone: istTimezone },
          },
          totalOrders: { $sum: 1 },
          completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
          grossRevenuePaise: { $sum: '$pricing.grandTotal' },
          netRevenuePaise: {
            $sum: { $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$pricing.grandTotal', 0] },
          },
          totalUnitsSold: {
            $sum: { $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$pricing.totalUnits', 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    return Order.aggregate(pipeline);
  }

  async assertSalesSummaryLimit(options) {
    const records = await this.getSalesSummaryRecords(options);
    this.assertRecordLimit(records.length, 'sales summary periods');
    return records;
  }

  async exportSalesSummary(options, res, preloadedRecords) {
    const { format, groupBy = 'day' } = options;
    const summaryRecords = preloadedRecords || (await this.getSalesSummaryRecords(options));

    const columns = [
      {
        header:
          groupBy === 'month'
            ? 'Period (Month)'
            : groupBy === 'week'
              ? 'Period (Week - IST)'
              : 'Period (Day - IST)',
        key: 'period',
        width: 20,
      },
      { header: 'Total Orders Placed', key: 'totalOrders', width: 20 },
      { header: 'Delivered Orders', key: 'completedOrders', width: 18 },
      { header: 'Cancelled Orders', key: 'cancelledOrders', width: 18 },
      { header: 'Gross Revenue (₹)', key: 'grossRevenue', width: 20 },
      { header: 'Net Revenue (₹)', key: 'netRevenue', width: 20 },
      { header: 'Net Units Sold', key: 'totalUnitsSold', width: 16 },
    ];

    if (format === 'xlsx') {
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
      const worksheet = workbook.addWorksheet('Sales Summary');
      worksheet.columns = columns;

      for (const rec of summaryRecords) {
        const row = worksheet.addRow({
          period: rec._id,
          totalOrders: rec.totalOrders || 0,
          completedOrders: rec.completedOrders || 0,
          cancelledOrders: rec.cancelledOrders || 0,
          grossRevenue: Number(((rec.grossRevenuePaise || 0) / 100).toFixed(2)),
          netRevenue: Number(((rec.netRevenuePaise || 0) / 100).toFixed(2)),
          totalUnitsSold: rec.totalUnitsSold || 0,
        });
        row.commit();
      }
      await worksheet.commit();
      await workbook.commit();
    } else {
      // CSV Streaming
      await writeCsvChunk(res, formatCsvLine(columns.map((c) => c.header)));
      for (const rec of summaryRecords) {
        const line = formatCsvLine([
          rec._id,
          rec.totalOrders || 0,
          rec.completedOrders || 0,
          rec.cancelledOrders || 0,
          ((rec.grossRevenuePaise || 0) / 100).toFixed(2),
          ((rec.netRevenuePaise || 0) / 100).toFixed(2),
          rec.totalUnitsSold || 0,
        ]);
        await writeCsvChunk(res, line);
      }
    }
  }
}

const adminExportService = new AdminExportService();
export default adminExportService;
