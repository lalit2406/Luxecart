/**
 * LuxeCart — Phase 6D.2: Admin Business Data Exports Frontend Verification Suite
 *
 * Verifies frontend integration contracts, export API client methods,
 * blob handling, filename extraction, error parsing, routing, sidebar,
 * and category UI controls.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('======================================================================');
console.log('   LUXECART PHASE 6D.2: ADMIN EXPORTS FRONTEND VERIFICATION SUITE   ');
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
  const exportApiPath = path.join(rootDir, 'client/src/features/admin/exports/api/adminExportApi.js');
  const exportsPagePath = path.join(rootDir, 'client/src/pages/admin/AdminExportsPage.jsx');
  const adminLayoutPath = path.join(rootDir, 'client/src/layouts/AdminLayout.jsx');
  const appJsxPath = path.join(rootDir, 'client/src/App.jsx');
  const apiServicePath = path.join(rootDir, 'client/src/services/api.js');

  const exportApiSource = fs.readFileSync(exportApiPath, 'utf-8');
  const exportsPageSource = fs.readFileSync(exportsPagePath, 'utf-8');
  const adminLayoutSource = fs.readFileSync(adminLayoutPath, 'utf-8');
  const appJsxSource = fs.readFileSync(appJsxPath, 'utf-8');
  const apiServiceSource = fs.readFileSync(apiServicePath, 'utf-8');

  // Dynamic import of pure helper functions from adminExportApi.js
  const { extractFilenameFromHeader, parseBlobError } = await import(
    `file://${exportApiPath.replace(/\\/g, '/')}`
  );

  // --------------------------------------------------------------------------
  // TEST 1: All Six API Methods Registered with Exact Backend Endpoints
  // --------------------------------------------------------------------------
  try {
    const requiredEndpoints = [
      { method: 'exportOrders', endpoint: '/admin/exports/orders' },
      { method: 'exportCustomers', endpoint: '/admin/exports/customers' },
      { method: 'exportProducts', endpoint: '/admin/exports/products' },
      { method: 'exportCoupons', endpoint: '/admin/exports/coupons' },
      { method: 'exportReturns', endpoint: '/admin/exports/returns' },
      { method: 'exportSalesSummary', endpoint: '/admin/exports/sales-summary' },
    ];

    for (const item of requiredEndpoints) {
      assert(
        exportApiSource.includes(item.endpoint),
        `Missing endpoint ${item.endpoint} in adminExportApi.js`
      );
      assert(
        exportApiSource.includes(`${item.method}:`),
        `Missing method ${item.method} in adminExportApi.js`
      );
    }
    record('TEST_01', 'All six export API methods target exact configured backend endpoints', 'PASS');
  } catch (err) {
    record('TEST_01', 'All six export API methods target exact configured backend endpoints', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: CSV and XLSX Format Parameters Supported & Defaulted
  // --------------------------------------------------------------------------
  try {
    assert(exportApiSource.includes("params.format === 'xlsx' ? 'xlsx' : 'csv'"));
    assert(exportsPageSource.includes("const [format, setFormat] = useState('csv')"));
    assert(exportsPageSource.includes("onClick={() => setFormat('csv')}"));
    assert(exportsPageSource.includes("onClick={() => setFormat('xlsx')}"));
    record('TEST_02', 'CSV and XLSX format parameters are correctly handled and selectable', 'PASS');
  } catch (err) {
    record('TEST_02', 'CSV and XLSX format parameters are correctly handled and selectable', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Date and Category-Specific Query Parameters Mapped Correctly
  // --------------------------------------------------------------------------
  try {
    // Orders
    assert(exportApiSource.includes("exportOrders: async (params = {})"));
    assert(exportsPageSource.includes("ordersFilters.type"));
    assert(exportsPageSource.includes("ordersFilters.orderType"));
    assert(exportsPageSource.includes("ordersFilters.paymentStatus"));

    // Customers
    assert(exportsPageSource.includes("customersFilters.status"));

    // Products
    assert(exportsPageSource.includes("productsFilters.category"));
    assert(exportsPageSource.includes("productsFilters.stockStatus"));

    // Coupons
    assert(exportsPageSource.includes("couponsFilters.status"));

    // Returns
    assert(exportsPageSource.includes("returnsFilters.status"));

    // Sales Summary
    assert(exportsPageSource.includes("salesSummaryFilters.groupBy"));
    assert(exportsPageSource.includes("salesSummaryFilters.orderType"));

    record('TEST_03', 'Category-specific filters and date window queries are mapped accurately', 'PASS');
  } catch (err) {
    record('TEST_03', 'Category-specific filters and date window queries are mapped accurately', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Blob Response Handling and Axios Interceptor Support
  // --------------------------------------------------------------------------
  try {
    // Check that adminExportApi specifies responseType: 'blob'
    const occurrences = (exportApiSource.match(/responseType:\s*'blob'/g) || []).length;
    assert.strictEqual(occurrences, 6, `Expected 6 occurrences of responseType: 'blob', found ${occurrences}`);

    // Check api.js handles blob response preservation
    assert(
      apiServiceSource.includes("response.config?.responseType === 'blob'"),
      'api.js interceptor missing blob response check'
    );
    record('TEST_04', 'Axios client interceptor properly passes through raw Blob and response headers', 'PASS');
  } catch (err) {
    record('TEST_04', 'Axios client interceptor properly passes through raw Blob and response headers', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Filename Extraction from Content-Disposition with Fallbacks
  // --------------------------------------------------------------------------
  try {
    // 1. Standard Content-Disposition header
    const standardHeader = 'attachment; filename="luxecart_orders_summary_20261101_110000.csv"';
    const standardName = extractFilenameFromHeader(standardHeader);
    assert.strictEqual(standardName, 'luxecart_orders_summary_20261101_110000.csv');

    // 2. RFC 5987 / 6266 UTF-8 encoded filename
    const rfcHeader = "attachment; filename*=UTF-8''luxecart_products_20261101_120000.xlsx";
    const rfcName = extractFilenameFromHeader(rfcHeader);
    assert.strictEqual(rfcName, 'luxecart_products_20261101_120000.xlsx');

    // 3. Fallback when header is missing or empty
    const fallbackName = extractFilenameFromHeader(null, 'custom_fallback.csv');
    assert.strictEqual(fallbackName, 'custom_fallback.csv');

    record('TEST_05', 'Content-Disposition filename parser handles standard, UTF-8, and fallbacks safely', 'PASS');
  } catch (err) {
    record('TEST_05', 'Content-Disposition filename parser handles standard, UTF-8, and fallbacks safely', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Object URL Creation and Revocation in Download Trigger
  // --------------------------------------------------------------------------
  try {
    assert(exportApiSource.includes('window.URL.createObjectURL(blob)'));
    assert(exportApiSource.includes('window.URL.revokeObjectURL(objectUrl)'));
    assert(exportApiSource.includes("link.setAttribute('download', filename)"));
    assert(exportApiSource.includes('link.click()'));
    record('TEST_06', 'Blob download trigger creates object URL, clicks anchor, and revokes URL safely', 'PASS');
  } catch (err) {
    record('TEST_06', 'Blob download trigger creates object URL, clicks anchor, and revokes URL safely', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: API Error Blob Parsing Extracts Structured Messages
  // --------------------------------------------------------------------------
  try {
    const errorJson = JSON.stringify({
      status: 'fail',
      message: 'Export exceeds the maximum limit of 25,000 records (31,450 records matched).',
      code: 'EXPORT_LIMIT_EXCEEDED',
    });

    const mockBlob = new Blob([errorJson], { type: 'application/json' });
    const mockAxiosError = {
      response: {
        status: 400,
        data: mockBlob,
      },
      message: 'Request failed with status code 400',
    };

    const parsed = await parseBlobError(mockAxiosError);
    assert.strictEqual(parsed.code, 'EXPORT_LIMIT_EXCEEDED');
    assert(parsed.message.includes('Export exceeds the maximum limit of 25,000 records'));
    assert.strictEqual(parsed.statusCode, 400);

    record('TEST_07', 'parseBlobError converts binary Blob error payloads into structured JavaScript errors', 'PASS');
  } catch (err) {
    record('TEST_07', 'parseBlobError converts binary Blob error payloads into structured JavaScript errors', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Duplicate Download Prevention and Loading State
  // --------------------------------------------------------------------------
  try {
    assert(exportsPageSource.includes('const [isDownloading, setIsDownloading] = useState(false)'));
    assert(exportsPageSource.includes('if (isDownloading) return;'));
    assert(exportsPageSource.includes('disabled={isDownloading'));
    assert(exportsPageSource.includes('Preparing Export...'));
    record('TEST_08', 'Duplicate download prevention locks download triggers during active exports', 'PASS');
  } catch (err) {
    record('TEST_08', 'Duplicate download prevention locks download triggers during active exports', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Admin Route and Sidebar Registration
  // --------------------------------------------------------------------------
  try {
    // App.jsx route check
    assert(
      appJsxSource.includes("const AdminExportsPage = lazy(() => import('./pages/admin/AdminExportsPage'))"),
      'AdminExportsPage lazy import missing in App.jsx'
    );
    assert(
      appJsxSource.includes('path="/admin/exports"'),
      'Route /admin/exports missing in App.jsx'
    );
    assert(
      appJsxSource.includes('<ProtectedRoute requiredRole="ADMIN">'),
      'Route protection missing in App.jsx'
    );

    // AdminLayout sidebar check
    assert(
      adminLayoutSource.includes("{ label: 'Data Exports', path: '/admin/exports', icon: Download }"),
      'Data Exports nav item missing in AdminLayout.jsx'
    );
    assert(
      adminLayoutSource.includes("crumbs.push({ label: 'Data Exports', path: null })"),
      'Data Exports breadcrumb missing in AdminLayout.jsx'
    );

    record('TEST_09', 'Admin route /admin/exports and sidebar navigation registered with Download icon', 'PASS');
  } catch (err) {
    record('TEST_09', 'Admin route /admin/exports and sidebar navigation registered with Download icon', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: UI Contains All Six Export Categories and Relevant Controls
  // --------------------------------------------------------------------------
  try {
    const requiredCategoryIds = ['orders', 'customers', 'products', 'coupons', 'returns', 'sales-summary'];
    for (const catId of requiredCategoryIds) {
      assert(exportsPageSource.includes(`id: '${catId}'`), `Category definition missing for ${catId}`);
    }

    // Quick date presets
    assert(exportsPageSource.includes("id: 'today'"));
    assert(exportsPageSource.includes("id: '7d'"));
    assert(exportsPageSource.includes("id: '30d'"));
    assert(exportsPageSource.includes("id: 'this_month'"));
    assert(exportsPageSource.includes("id: 'all_time'"));

    // Validation for date order
    assert(exportsPageSource.includes("dateRange.from > dateRange.to"));
    assert(exportsPageSource.includes("Start date cannot be after end date"));

    // Record limit warning
    assert(exportsPageSource.includes('25,000 Records'));

    record('TEST_10', 'UI renders all 6 export categories, date presets, limit warnings, and validation', 'PASS');
  } catch (err) {
    record('TEST_10', 'UI renders all 6 export categories, date presets, limit warnings, and validation', 'FAIL', err.message);
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n======================================================================');
  console.log('   TEST RUN SUMMARY');
  console.log('======================================================================');
  console.log(`Total Tests : ${passCount + failCount}`);
  console.log(`Passed      : ${passCount}`);
  console.log(`Failed      : ${failCount}`);

  if (failCount > 0) {
    console.error(`\n${failCount} Phase 6D.2 tests failed.`);
    process.exit(1);
  } else {
    console.log('\nAll Phase 6D.2 Frontend Business Data Exports tests passed successfully!');
    process.exit(0);
  }
};

runSuite().catch((err) => {
  console.error('Unhandled suite error:', err);
  process.exit(1);
});
