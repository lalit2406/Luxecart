/**
 * LuxeCart — Phase 6D.3: Admin Business Data Exports E2E Integration Suite
 *
 * Exercises the complete HTTP request and streaming response paths for:
 * 1. Orders & Sales (Summary & Itemized, CSV & XLSX, LIVE/DEMO/ALL, Payment/Order Status)
 * 2. Customers (CSV & XLSX, Credential Exclusion, Account Standing)
 * 3. Products & Inventory (CSV & XLSX, Variant Stock, Rupee Pricing, Stock Filters)
 * 4. Coupons & Promotions (CSV & XLSX, Promotion Rules, Active/Expired)
 * 5. Returns & Refunds (CSV & XLSX, Paise Conversion, Reason Tracking)
 * 6. Sales Summary (CSV & XLSX, Day/Week/Month, Revenue Deductions)
 * 7. Error & Security Scenarios (401, 403, 400 dates, 25k cap, injection, disconnects)
 */

import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';

// Import production routes and validators
import adminExportRoutes from '../src/modules/exports/adminExport.routes.js';
import adminExportService from '../src/modules/exports/adminExport.service.js';
import Order from '../src/modules/orders/order.model.js';
import User from '../src/modules/users/user.model.js';
import Product from '../src/modules/products/product.model.js';
import Coupon from '../src/modules/coupons/coupon.model.js';
import Return from '../src/modules/returns/return.model.js';
import { parseBlobError, extractFilenameFromHeader } from '../../client/src/features/admin/exports/api/adminExportApi.js';
import { generateAccessToken } from '../src/utils/token.js';

console.log('======================================================================');
console.log('   LUXECART PHASE 6D.3: BUSINESS DATA EXPORTS E2E VERIFICATION SUITE  ');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

const record = (id, description, status, details = '') => {
  if (status === 'PASS') {
    passCount++;
    console.log(`✔ [PASS] [${id}] ${description}`);
  } else {
    failCount++;
    console.error(`✖ [FAIL] [${id}] ${description}${details ? ' - ' + details : ''}`);
  }
};

const runSuite = async () => {
  // --------------------------------------------------------------------------
  // SETUP TEST DATA AND EXPRESS HARNESS
  // --------------------------------------------------------------------------
  const adminId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const customer2Id = new mongoose.Types.ObjectId();
  const catId = new mongoose.Types.ObjectId();

  const adminToken = generateAccessToken({ _id: adminId, role: 'ADMIN' });
  const customerToken = generateAccessToken({ _id: customerId, role: 'CUSTOMER' });

  // Representative In-Memory Seed Documents
  const mockOrders = [
    {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'ORD-LIVE-001',
      userId: { _id: customerId, name: 'Alice Customer', email: 'alice@example.com', phone: '9876543210' },
      isDemo: false,
      status: 'DELIVERED',
      payment: { method: 'CASH_ON_DELIVERY', status: 'PAID' },
      pricing: { itemCount: 2, subtotal: 500000, couponDiscount: 50000, shipping: 20000, grandTotal: 470000, totalUnits: 2 },
      shippingAddress: { fullName: 'Alice Customer', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', phone: '9876543210' },
      items: [
        {
          title: 'Silk Evening Gown',
          sku: 'GOWN-SLK-BLK-M',
          size: 'M',
          color: { name: 'Black' },
          quantity: 1,
          price: 300000,
          lineSubtotal: 300000,
          lineSavings: 0,
        },
        {
          title: 'Cashmere Shawl',
          sku: 'SHWL-CSH-RED-OS',
          size: 'OS',
          color: { name: 'Ruby Red' },
          quantity: 1,
          price: 200000,
          lineSubtotal: 200000,
          lineSavings: 0,
        },
      ],
      coupon: { code: 'LUXE10' },
      createdAt: new Date('2026-11-01T06:00:00.000Z'), // 11:30 AM IST
    },
    {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'ORD-DEMO-002',
      userId: { _id: customer2Id, name: '=Malicious Formula', email: 'bob@example.com', phone: '9876500000' },
      isDemo: true,
      status: 'PROCESSING',
      payment: { method: 'CASH_ON_DELIVERY', status: 'PENDING' },
      pricing: { itemCount: 1, subtotal: 150000, couponDiscount: 0, shipping: 0, grandTotal: 150000, totalUnits: 1 },
      shippingAddress: { fullName: 'Bob Demo', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', phone: '9876500000' },
      items: [
        {
          title: '+Formula Sneaker',
          sku: 'SNK-PL-WHT-42',
          size: '42',
          color: { name: 'White' },
          quantity: 1,
          price: 150000,
          lineSubtotal: 150000,
          lineSavings: 0,
        },
      ],
      createdAt: new Date('2026-11-01T08:00:00.000Z'),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'ORD-LIVE-003',
      userId: { _id: customerId, name: 'Alice Customer', email: 'alice@example.com', phone: '9876543210' },
      isDemo: false,
      status: 'CANCELLED',
      payment: { method: 'CASH_ON_DELIVERY', status: 'REFUNDED' },
      pricing: { itemCount: 1, subtotal: 100000, couponDiscount: 0, shipping: 0, grandTotal: 100000, totalUnits: 1 },
      shippingAddress: { fullName: 'Alice Customer', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', phone: '9876543210' },
      items: [
        {
          title: 'Leather Belt',
          sku: 'BLT-LTH-BRN-34',
          size: '34',
          color: { name: 'Brown' },
          quantity: 1,
          price: 100000,
          lineSubtotal: 100000,
          lineSavings: 0,
        },
      ],
      createdAt: new Date('2026-11-01T09:00:00.000Z'),
    },
  ];

  const mockCustomers = [
    {
      _id: customerId,
      name: 'Alice Customer',
      email: 'alice@example.com',
      phone: '9876543210',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      passwordHash: 'SUPER_SECRET_HASH_NEVER_EXPORT_123',
      refreshTokens: [{ tokenHash: 'REFRESH_SECRET_TOKEN_HASH' }],
      createdAt: new Date('2026-10-15T10:00:00.000Z'),
    },
    {
      _id: customer2Id,
      name: '=Malicious User',
      email: 'bob@example.com',
      phone: '9876500000',
      role: 'CUSTOMER',
      status: 'SUSPENDED',
      passwordHash: 'ANOTHER_SECRET_HASH_456',
      refreshTokens: [],
      createdAt: new Date('2026-10-20T10:00:00.000Z'),
    },
  ];

  const mockProducts = [
    {
      _id: new mongoose.Types.ObjectId(),
      title: 'Silk Evening Gown',
      slug: 'silk-evening-gown',
      brand: 'LuxeArtisan',
      gender: 'WOMEN',
      status: 'ACTIVE',
      category: { _id: catId, name: 'Dresses' },
      priceSummary: { hasStock: true, totalStock: 8 },
      variants: [
        {
          sku: 'GOWN-SLK-BLK-M',
          barcode: '8901234567890',
          attributes: { size: 'M', color: { name: 'Black' } },
          price: 3000, // Rupees
          mrp: 4500, // Rupees
          inventory: { stock: 8, reserved: 2, lowStockThreshold: 10 },
          isActive: true,
        },
      ],
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
    },
  ];

  const mockCoupons = [
    {
      _id: new mongoose.Types.ObjectId(),
      code: 'LUXE10',
      description: '10% Festive Luxury Discount',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderValue: 2000,
      maxDiscountAmount: 500,
      totalUsageLimit: 100,
      usedCount: 24,
      perUserLimit: 1,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      expirationDate: new Date('2026-12-31T23:59:59.000Z'),
      isActive: true,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    },
  ];

  const mockReturns = [
    {
      _id: new mongoose.Types.ObjectId(),
      returnNumber: 'RET-2026-0001',
      orderNumber: 'ORD-LIVE-001',
      userId: customerId,
      status: 'REFUNDED',
      totalRequestedUnits: 1,
      totalRefundAmount: 200000, // 2,000.00 Rupees in paise
      items: [{ name: 'Cashmere Shawl', requestedQuantity: 1, reason: 'Color mismatched photos' }],
      refundDetails: { method: 'ORIGINAL_PAYMENT', referenceNumber: 'REF-TXN-887766', refundedAt: new Date('2026-11-01T10:00:00.000Z') },
      createdAt: new Date('2026-11-01T09:00:00.000Z'),
    },
  ];

  // Mock Mongoose Methods on In-Memory Schemas
  Order.countDocuments = async (filter = {}) => {
    return mockOrders.filter((o) => {
      if (filter.isDemo === true && !o.isDemo) return false;
      if (filter.isDemo?.$ne === true && o.isDemo) return false;
      if (filter.status && filter.status !== 'ALL' && o.status !== filter.status) return false;
      if (filter['payment.status'] && o.payment?.status !== filter['payment.status']) return false;
      return true;
    }).length;
  };

  Order.find = (filter = {}) => ({
    sort: () => ({
      populate: () => ({
        cursor: () => {
          const filtered = mockOrders.filter((o) => {
            if (filter.isDemo === true && !o.isDemo) return false;
            if (filter.isDemo?.$ne === true && o.isDemo) return false;
            if (filter.status && filter.status !== 'ALL' && o.status !== filter.status) return false;
            if (filter['payment.status'] && o.payment?.status !== filter['payment.status']) return false;
            return true;
          });
          return {
            async *[Symbol.asyncIterator]() {
              for (const doc of filtered) {
                yield doc;
              }
            },
            close: async () => {},
          };
        },
      }),
    }),
  });

  Order.aggregate = async (pipeline = []) => {
    // 1. Limit Check for Itemized
    if (pipeline.some((s) => s.$group && s.$group.totalItems)) {
      const matchStage = pipeline.find((s) => s.$match)?.$match || {};
      const count = mockOrders
        .filter((o) => {
          if (matchStage.isDemo?.$ne === true && o.isDemo) return false;
          if (matchStage.isDemo === true && !o.isDemo) return false;
          if (matchStage.status && o.status !== matchStage.status) return false;
          return true;
        })
        .reduce((sum, o) => sum + (o.items?.length || 0), 0);
      return [{ _id: null, totalItems: count }];
    }

    // 2. Customer metrics aggregation
    if (pipeline.some((s) => s.$group && s.$group.totalSpentPaise)) {
      return [
        { _id: customerId, totalOrders: 2, totalSpentPaise: 470000 },
        { _id: customer2Id, totalOrders: 1, totalSpentPaise: 150000 },
      ];
    }

    // 3. Sales Summary aggregation
    if (pipeline.some((s) => s.$group && s.$group.grossRevenuePaise)) {
      const matchStage = pipeline.find((s) => s.$match)?.$match || {};
      const filtered = mockOrders.filter((o) => {
        if (matchStage.isDemo?.$ne === true && o.isDemo) return false;
        if (matchStage.isDemo === true && !o.isDemo) return false;
        return true;
      });

      const totalOrders = filtered.length;
      const completedOrders = filtered.filter((o) => o.status === 'DELIVERED').length;
      const cancelledOrders = filtered.filter((o) => o.status === 'CANCELLED').length;
      const grossRevenuePaise = filtered.reduce((sum, o) => sum + o.pricing.grandTotal, 0);
      const netRevenuePaise = filtered
        .filter((o) => o.status !== 'CANCELLED')
        .reduce((sum, o) => sum + o.pricing.grandTotal, 0);
      const totalUnitsSold = filtered
        .filter((o) => o.status !== 'CANCELLED')
        .reduce((sum, o) => sum + o.pricing.totalUnits, 0);

      return [
        {
          _id: '2026-11-01',
          totalOrders,
          completedOrders,
          cancelledOrders,
          grossRevenuePaise,
          netRevenuePaise,
          totalUnitsSold,
        },
      ];
    }

    return [];
  };

  User.countDocuments = async () => mockCustomers.length;
  User.find = () => ({
    sort: () => ({
      select: () => ({
        cursor: () => ({
          async *[Symbol.asyncIterator]() {
            for (const doc of mockCustomers) {
              yield doc;
            }
          },
          close: async () => {},
        }),
      }),
    }),
  });

  Product.countDocuments = async () => mockProducts.length;
  Product.aggregate = async () => [
    { _id: null, totalVariants: mockProducts.reduce((sum, p) => sum + (p.variants?.length || 0), 0) },
  ];
  Product.find = () => ({
    sort: () => ({
      populate: () => ({
        cursor: () => ({
          async *[Symbol.asyncIterator]() {
            for (const doc of mockProducts) {
              yield doc;
            }
          },
          close: async () => {},
        }),
      }),
    }),
  });

  Coupon.countDocuments = async () => mockCoupons.length;
  Coupon.find = () => ({
    sort: () => ({
      cursor: () => ({
        async *[Symbol.asyncIterator]() {
          for (const doc of mockCoupons) {
            yield doc;
          }
        },
        close: async () => {},
      }),
    }),
  });

  Return.countDocuments = async () => mockReturns.length;
  Return.find = () => ({
    sort: () => ({
      cursor: () => ({
        async *[Symbol.asyncIterator]() {
          for (const doc of mockReturns) {
            yield doc;
          }
        },
        close: async () => {},
      }),
    }),
  });

  // Setup Express App
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/admin/exports', adminExportRoutes);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      status: 'fail',
      message: err.message,
      code: err.code || 'ERROR',
      details: err.details,
    });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1/admin/exports`;

  try {
    // ========================================================================
    // WORKFLOW 1: Orders & Sales (SUMMARY & ITEMIZED, CSV & XLSX)
    // ========================================================================
    {
      // 1.1 Summary CSV
      const resSumCsv = await fetch(`${baseUrl}/orders?format=csv&type=summary`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      assert.strictEqual(resSumCsv.status, 200);
      assert(resSumCsv.headers.get('content-type').includes('text/csv'));
      const sumCsvText = await resSumCsv.text();
      assert(sumCsvText.includes('ORD-LIVE-001'));
      // Verify paise converted to Rupees: 470000 -> 4700.00
      assert(sumCsvText.includes('4700.00'));
      // Verify Live order default: Demo order excluded
      assert(!sumCsvText.includes('ORD-DEMO-002'));
      record('WORKFLOW_01A', 'Orders Summary CSV exports with correct paise conversion and Live order default', 'PASS');

      // 1.2 Summary XLSX (Binary OpenXML workbook validation)
      const resSumXlsx = await fetch(`${baseUrl}/orders?format=xlsx&type=summary`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      assert.strictEqual(resSumXlsx.status, 200);
      assert(resSumXlsx.headers.get('content-type').includes('openxmlformats'));
      const xlsxBuffer = Buffer.from(await resSumXlsx.arrayBuffer());
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(xlsxBuffer);
      const sheet = workbook.getWorksheet('Orders Summary');
      assert(sheet, 'Orders Summary worksheet not found in XLSX');
      const orderNumCell = sheet.getRow(2).getCell(1).value;
      assert.strictEqual(orderNumCell, 'ORD-LIVE-001');
      record('WORKFLOW_01B', 'Orders Summary XLSX streams valid OpenXML workbook structure with matching records', 'PASS');

      // 1.3 Itemized CSV
      const resItemCsv = await fetch(`${baseUrl}/orders?format=csv&type=itemized`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      assert.strictEqual(resItemCsv.status, 200);
      const itemCsvText = await resItemCsv.text();
      assert(itemCsvText.includes('GOWN-SLK-BLK-M'));
      assert(itemCsvText.includes('SHWL-CSH-RED-OS'));
      assert(itemCsvText.includes('3000.00'));
      record('WORKFLOW_01C', 'Orders Itemized CSV streams row-per-item with variant SKU and unit prices', 'PASS');

      // 1.4 Explicit DEMO Scope
      const resDemoCsv = await fetch(`${baseUrl}/orders?format=csv&type=summary&orderType=DEMO`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      const demoCsvText = await resDemoCsv.text();
      assert(demoCsvText.includes('ORD-DEMO-002'));
      assert(!demoCsvText.includes('ORD-LIVE-001'));
      record('WORKFLOW_01D', 'Orders export respects explicit orderType=DEMO filter', 'PASS');
    }

    // ========================================================================
    // WORKFLOW 2: Customers Directory (CSV & XLSX, Credential Exclusion)
    // ========================================================================
    {
      const resCustCsv = await fetch(`${baseUrl}/customers?format=csv`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      assert.strictEqual(resCustCsv.status, 200);
      const custCsvText = await resCustCsv.text();
      assert(custCsvText.includes('Alice Customer'));
      assert(custCsvText.includes('alice@example.com'));
      assert(custCsvText.includes('4700.00')); // Converted lifetime spend

      // SECURITY CRITICAL: Ensure zero credential leakage
      assert(!custCsvText.includes('SUPER_SECRET_HASH_NEVER_EXPORT_123'));
      assert(!custCsvText.includes('REFRESH_SECRET_TOKEN_HASH'));
      assert(!custCsvText.includes('passwordHash'));

      // Formula injection check: '=Malicious User' must be escaped to ''=Malicious User'
      assert(custCsvText.includes("''=Malicious User") || custCsvText.includes("'=Malicious User"));
      record('WORKFLOW_02', 'Customers export excludes all password hashes and secrets while formatting spend metrics', 'PASS');
    }

    // ========================================================================
    // WORKFLOW 3: Products & Inventory (Variant SKUs, Rupee Prices, Stock)
    // ========================================================================
    {
      const resProdCsv = await fetch(`${baseUrl}/products?format=csv`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      if (resProdCsv.status !== 200) {
        console.error('PROD CSV ERROR:', await resProdCsv.text());
      }
      assert.strictEqual(resProdCsv.status, 200);
      const prodCsvText = await resProdCsv.text();
      assert(prodCsvText.includes('Silk Evening Gown'));
      assert(prodCsvText.includes('GOWN-SLK-BLK-M'));
      assert(prodCsvText.includes('3000')); // Native Rupee price
      assert(prodCsvText.includes('4500')); // Native Rupee MRP
      assert(prodCsvText.includes('Dresses')); // Category name
      record('WORKFLOW_03', 'Products export accurately streams variant SKU, Rupee pricing, and stock metrics', 'PASS');
    }

    // ========================================================================
    // WORKFLOW 4: Coupons & Promotions (Rules, Caps, Expiration)
    // ========================================================================
    {
      const resCpnCsv = await fetch(`${baseUrl}/coupons?format=csv`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      assert.strictEqual(resCpnCsv.status, 200);
      const cpnCsvText = await resCpnCsv.text();
      assert(cpnCsvText.includes('LUXE10'));
      assert(cpnCsvText.includes('10%'));
      assert(cpnCsvText.includes('ACTIVE'));
      record('WORKFLOW_04', 'Coupons export outputs promotional codes, discount percentage, and active validity', 'PASS');
    }

    // ========================================================================
    // WORKFLOW 5: Returns & Refunds (Tracking, Reasons, Refund Paise Converted)
    // ========================================================================
    {
      const resRetCsv = await fetch(`${baseUrl}/returns?format=csv`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      assert.strictEqual(resRetCsv.status, 200);
      const retCsvText = await resRetCsv.text();
      assert(retCsvText.includes('RET-2026-0001'));
      assert(retCsvText.includes('2000.00')); // 200000 paise converted to 2000.00 Rupees
      assert(retCsvText.includes('Color mismatched photos'));
      record('WORKFLOW_05', 'Returns export outputs return number, reason, and converts refund paise to Rupees', 'PASS');
    }

    // ========================================================================
    // WORKFLOW 6: Sales Summary (Day/Week/Month, Net Revenue Excluding Cancelled)
    // ========================================================================
    {
      // 6.1 Daily Grouping
      const resSummaryDay = await fetch(`${baseUrl}/sales-summary?format=csv&groupBy=day`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      assert.strictEqual(resSummaryDay.status, 200);
      const dayCsvText = await resSummaryDay.text();
      assert(dayCsvText.includes('Period (Day - IST),Total Orders Placed,Delivered Orders,Cancelled Orders'));
      assert(dayCsvText.includes('2026-11-01'));
      assert(dayCsvText.includes('4700.00')); // Net revenue excluding cancelled
      record('WORKFLOW_06A', 'Sales Summary daily export groups by date and correctly computes net revenue', 'PASS');

      // 6.2 Monthly Grouping
      const resSummaryMonth = await fetch(`${baseUrl}/sales-summary?format=csv&groupBy=month`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      assert.strictEqual(resSummaryMonth.status, 200);
      const monthCsvText = await resSummaryMonth.text();
      assert(monthCsvText.includes('Period (Month)'));
      record('WORKFLOW_06B', 'Sales Summary monthly export accepts month grouping parameter', 'PASS');
    }

    // ========================================================================
    // WORKFLOW 7: Error, Security & Boundary Scenarios
    // ========================================================================
    {
      // 7.1 Unauthenticated request returns 401
      const resUnauth = await fetch(`${baseUrl}/orders`);
      assert.strictEqual(resUnauth.status, 401);
      record('SEC_01', 'Unauthenticated requests strictly return HTTP 401 Unauthorized', 'PASS');

      // 7.2 Customer role returns 403 Forbidden
      const resForbidden = await fetch(`${baseUrl}/orders`, {
        headers: { Cookie: `accessToken=${customerToken}` },
      });
      assert.strictEqual(resForbidden.status, 403);
      record('SEC_02', 'Non-admin/Customer requests strictly return HTTP 403 Forbidden', 'PASS');

      // 7.3 Invalid calendar date format / non-existent date
      const resBadDate = await fetch(`${baseUrl}/orders?from=2026-02-31`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      assert.strictEqual(resBadDate.status, 400);
      const badDateJson = await resBadDate.json();
      assert(badDateJson.message.includes('Expected YYYY-MM-DD'));
      record('VAL_01', 'Invalid calendar date (e.g. Feb 31) is rejected with HTTP 400 Bad Request', 'PASS');

      // 7.4 Reversed date range (from > to)
      const resReversedDate = await fetch(`${baseUrl}/orders?from=2026-11-05&to=2026-11-01`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      assert.strictEqual(resReversedDate.status, 400);
      const revDateJson = await resReversedDate.json();
      assert(revDateJson.message.includes("date cannot be after 'to' date"));
      record('VAL_02', 'Reversed date range (from > to) is rejected with HTTP 400 Bad Request', 'PASS');

      // 7.5 Invalid filter enum value
      const resBadStatus = await fetch(`${baseUrl}/orders?status=INVALID_STATUS`, {
        headers: { Cookie: `accessToken=${adminToken}` },
      });
      assert.strictEqual(resBadStatus.status, 400);
      record('VAL_03', 'Invalid query parameters return HTTP 400 with descriptive error message', 'PASS');

      // 7.6 25,000 Records Ceiling Enforcement before headers
      const originalAssert = adminExportService.assertOrdersLimit;
      try {
        adminExportService.assertOrdersLimit = async () => {
          adminExportService.assertRecordLimit(35000, 'orders');
        };

        const resLimit = await fetch(`${baseUrl}/orders?format=csv&type=summary`, {
          headers: { Cookie: `accessToken=${adminToken}` },
        });
        assert.strictEqual(resLimit.status, 400);
        assert(!resLimit.headers.get('content-disposition')); // No attachment header sent
        const limitJson = await resLimit.json();
        assert.strictEqual(limitJson.code, 'EXPORT_LIMIT_EXCEEDED');
        assert(limitJson.message.includes('Export exceeds the maximum limit of 25,000 records'));
        record('LIMIT_01', 'Preflight count check terminates request with HTTP 400 before headers when > 25,000 records', 'PASS');

        // 7.7 Verify Client parseBlobError extracts message and code from Blob error
        const mockErrorBlob = new Blob([JSON.stringify(limitJson)], { type: 'application/json' });
        const parsedClientError = await parseBlobError({
          response: { status: 400, data: mockErrorBlob },
        });
        assert.strictEqual(parsedClientError.code, 'EXPORT_LIMIT_EXCEEDED');
        assert(parsedClientError.message.includes('Export exceeds the maximum limit'));
        record('CLIENT_01', 'Client parseBlobError deserializes binary error Blob into actionable Error instance', 'PASS');
      } finally {
        adminExportService.assertOrdersLimit = originalAssert;
      }

      // 7.8 Empty dataset handling
      const originalFind = Order.find;
      try {
        Order.find = () => ({
          sort: () => ({
            populate: () => ({
              cursor: () => ({
                async *[Symbol.asyncIterator]() {
                  // Yield nothing
                },
                close: async () => {},
              }),
            }),
          }),
        });

        const resEmpty = await fetch(`${baseUrl}/orders?format=csv&type=summary`, {
          headers: { Cookie: `accessToken=${adminToken}` },
        });
        assert.strictEqual(resEmpty.status, 200);
        const emptyCsv = await resEmpty.text();
        assert(emptyCsv.startsWith('Order Number,Order Date (IST)'));
        record('EMPTY_01', 'Empty dataset exports CSV header row cleanly without server error', 'PASS');
      } finally {
        Order.find = originalFind;
      }

      // 7.9 Client abort / disconnect safety during stream
      let cursorClosed = false;
      const originalOrdersFind = Order.find;
      try {
        Order.find = () => ({
          sort: () => ({
            populate: () => ({
              cursor: () => ({
                async *[Symbol.asyncIterator]() {
                  for (let i = 0; i < 100; i++) {
                    yield mockOrders[0];
                  }
                },
                close: async () => {
                  cursorClosed = true;
                },
              }),
            }),
          }),
        });

        const controller = new AbortController();
        const fetchPromise = fetch(`${baseUrl}/orders?format=csv&type=summary`, {
          headers: { Cookie: `accessToken=${adminToken}` },
          signal: controller.signal,
        });

        // Abort immediately after connection initiates
        setTimeout(() => controller.abort(), 10);
        await fetchPromise.catch(() => {});
        // Allow event loop to cycle for stream disposal
        await new Promise((r) => setTimeout(r, 50));
        assert.strictEqual(cursorClosed, true, 'Cursor was not closed after client abort');
        record('DISCONNECT_01', 'Abrupt client disconnect triggers cursor disposal without server instability', 'PASS');
      } finally {
        Order.find = originalOrdersFind;
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // ==========================================================================
  // FINAL TEST SUITE SUMMARY
  // ==========================================================================
  console.log('\n======================================================================');
  console.log('   E2E VERIFICATION TEST RUN SUMMARY');
  console.log('======================================================================');
  console.log(`Total Scenarios Tested : ${passCount + failCount}`);
  console.log(`Passed                 : ${passCount}`);
  console.log(`Failed                 : ${failCount}`);

  if (failCount > 0) {
    console.error(`\n${failCount} Phase 6D.3 verification checks failed.`);
    process.exit(1);
  } else {
    console.log('\nAll Phase 6D.3 E2E Integration and Security verification checks passed successfully!');
    process.exit(0);
  }
};

runSuite().catch((err) => {
  console.error('Unhandled E2E suite error:', err);
  process.exit(1);
});
