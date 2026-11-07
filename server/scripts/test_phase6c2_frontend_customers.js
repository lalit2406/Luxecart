/**
 * LuxeCart Phase 6C.2: Admin Customer Management Frontend Verification Suite
 *
 * Verifies:
 * 1. AdminCustomerApi contract and endpoint paths.
 * 2. AdminCustomerTable component contract, status badges, and loading skeletons.
 * 3. CustomerStatusModal security messaging (15-min token window, duplicate submission prevention).
 * 4. AdminCustomersPage debounce, pagination reset, and search filters.
 * 5. AdminCustomerDetailPage metrics, addresses, order history, and 403 admin protection card.
 * 6. AdminLayout sidebar navigation and dynamic breadcrumb routing.
 * 7. App.jsx lazy routes and role protection.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('======================================================================');
console.log('   LUXECART PHASE 6C.2: ADMIN CUSTOMER MANAGEMENT FRONTEND SUITE     ');
console.log('======================================================================\n');

const results = [];

function record(testId, name, status, details = '') {
  results.push({ testId, name, status, details });
  const symbol = status === 'PASS' ? '✔ [PASS]' : status === 'SKIP' ? '⚠ [SKIP]' : '✖ [FAIL]';
  console.log(`${symbol} [${testId}] ${name}`);
  if (details && status === 'FAIL') {
    console.error(`       Details: ${details}`);
  }
}

async function runSuite() {
  // --------------------------------------------------------------------------
  // TEST 1: adminCustomerApi Contract & Route Path Inspection
  // --------------------------------------------------------------------------
  try {
    const apiFile = path.join(rootDir, 'client/src/features/admin/customers/api/adminCustomerApi.js');
    assert(fs.existsSync(apiFile), 'adminCustomerApi.js must exist');
    const content = fs.readFileSync(apiFile, 'utf8');

    assert(content.includes("api.get('/admin/customers'"), 'Must call /admin/customers for list');
    assert(content.includes("api.get(`/admin/customers/${customerId}`"), 'Must call /admin/customers/:id for profile');
    assert(content.includes("api.get(`/admin/customers/${customerId}/orders`"), 'Must call /admin/customers/:id/orders for orders');
    assert(content.includes("api.patch(`/admin/customers/${customerId}/status`"), 'Must call /admin/customers/:id/status for status');

    record('TEST_01', 'adminCustomerApi correctly binds all canonical backend endpoints', 'PASS');
  } catch (err) {
    record('TEST_01', 'adminCustomerApi correctly binds all canonical backend endpoints', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: AdminCustomerTable Contract & Badge Config
  // --------------------------------------------------------------------------
  try {
    const tableFile = path.join(rootDir, 'client/src/features/admin/customers/components/AdminCustomerTable.jsx');
    assert(fs.existsSync(tableFile), 'AdminCustomerTable.jsx must exist');
    const content = fs.readFileSync(tableFile, 'utf8');

    assert(content.includes('getCustomerStatusBadge'), 'Must export getCustomerStatusBadge');
    assert(content.includes('ACTIVE'), 'Must handle ACTIVE status');
    assert(content.includes('SUSPENDED'), 'Must handle SUSPENDED status');
    assert(content.includes('INACTIVE'), 'Must handle INACTIVE status');
    assert(content.includes('animate-pulse'), 'Must provide skeleton pulse during loading');
    assert(content.includes('totalOrders'), 'Must display customer order count');
    assert(content.includes('totalSpentPaise'), 'Must display lifetime customer spend in Rupees');

    // Verify badge labels and color tokens are mapped
    assert(content.includes("case 'ACTIVE':"), 'Handles ACTIVE status in switch');
    assert(content.includes("case 'SUSPENDED':"), 'Handles SUSPENDED status in switch');
    assert(content.includes("case 'INACTIVE':"), 'Handles INACTIVE status in switch');
    assert(content.includes("bg: 'bg-emerald-50'"), 'ACTIVE badge uses emerald bg');
    assert(content.includes("bg: 'bg-rose-50'"), 'SUSPENDED badge uses rose bg');
    assert(content.includes("bg: 'bg-amber-50'"), 'INACTIVE badge uses amber bg');

    record('TEST_02', 'AdminCustomerTable exports status badges and displays order metrics', 'PASS');
  } catch (err) {
    record('TEST_02', 'AdminCustomerTable exports status badges and displays order metrics', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: CustomerStatusModal Security & Double-Submission Prevention
  // --------------------------------------------------------------------------
  try {
    const modalFile = path.join(rootDir, 'client/src/features/admin/customers/components/CustomerStatusModal.jsx');
    assert(fs.existsSync(modalFile), 'CustomerStatusModal.jsx must exist');
    const content = fs.readFileSync(modalFile, 'utf8');

    // 15-minute access token notification
    assert(content.includes('15-minute'), 'Must inform admin of the 15-minute stateless access token window');
    assert(content.includes('refresh tokens'), 'Must explain that refresh tokens are atomically purged');

    // Restriction to ACTIVE and SUSPENDED
    assert(content.includes("setSelectedStatus('ACTIVE')"), 'Must support ACTIVE');
    assert(content.includes("setSelectedStatus('SUSPENDED')"), 'Must support SUSPENDED');

    // Double submission prevention
    assert(content.includes('if (updating || isCurrentlySame) return;'), 'Must guard against concurrent or identical submission');
    assert(content.includes('disabled={updating'), 'Must disable submit and cancel buttons during flight');

    // Reason length limitation (500 chars)
    assert(content.includes('slice(0, 500)'), 'Must enforce 500 character reason length cap');

    // Accessibility
    assert(content.includes('role="dialog"'), 'Must have role="dialog"');
    assert(content.includes('aria-modal="true"'), 'Must have aria-modal="true"');
    assert(content.includes('Escape'), 'Must support Escape key dismissal');

    record('TEST_03', 'CustomerStatusModal implements 15-min token notice, 500 char cap, and submission guard', 'PASS');
  } catch (err) {
    record('TEST_03', 'CustomerStatusModal implements 15-min token notice, 500 char cap, and submission guard', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: AdminCustomersPage Debounce, Filter & Race-Condition Guard
  // --------------------------------------------------------------------------
  try {
    const pageFile = path.join(rootDir, 'client/src/pages/admin/AdminCustomersPage.jsx');
    assert(fs.existsSync(pageFile), 'AdminCustomersPage.jsx must exist');
    const content = fs.readFileSync(pageFile, 'utf8');

    assert(content.includes('latestRequestIdRef'), 'Must use request ID ref to prevent out-of-order race conditions');
    assert(content.includes('setTimeout'), 'Must debounce search query');
    assert(content.includes('setCurrentPage(1)'), 'Must reset pagination when filters or search change');
    assert(content.includes('AdminLayout'), 'Must wrap view in AdminLayout');
    assert(content.includes('CustomerStatusModal'), 'Must integrate CustomerStatusModal');
    assert(content.includes('Reset Filters'), 'Must provide filter reset option in empty state');

    record('TEST_04', 'AdminCustomersPage implements debounce, pagination reset, and race-condition guards', 'PASS');
  } catch (err) {
    record('TEST_04', 'AdminCustomersPage implements debounce, pagination reset, and race-condition guards', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: AdminCustomerDetailPage Metrics & Admin Protection Card
  // --------------------------------------------------------------------------
  try {
    const detailFile = path.join(rootDir, 'client/src/pages/admin/AdminCustomerDetailPage.jsx');
    assert(fs.existsSync(detailFile), 'AdminCustomerDetailPage.jsx must exist');
    const content = fs.readFileSync(detailFile, 'utf8');

    assert(content.includes('CANNOT_MODIFY_ADMIN_ACCOUNT'), 'Must explicitly handle 403 CANNOT_MODIFY_ADMIN_ACCOUNT');
    assert(content.includes('Administrator Account Protection'), 'Must render dedicated security card for admin protection');
    assert(content.includes('Saved Delivery Addresses'), 'Must render customer delivery addresses');
    assert(content.includes('Customer Order History'), 'Must render paginated customer order history');
    assert(content.includes('Status Transition Audit Trail'), 'Must render status transition history');
    assert(content.includes('orderSummary'), 'Must calculate and distinguish lifetime spend metrics');
    assert(content.includes('CustomerStatusModal'), 'Must support status change action from detail view');

    record('TEST_05', 'AdminCustomerDetailPage renders profile, addresses, order history, and 403 admin card', 'PASS');
  } catch (err) {
    record('TEST_05', 'AdminCustomerDetailPage renders profile, addresses, order history, and 403 admin card', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: AdminLayout Navigation & Breadcrumb Integration
  // --------------------------------------------------------------------------
  try {
    const layoutFile = path.join(rootDir, 'client/src/layouts/AdminLayout.jsx');
    const content = fs.readFileSync(layoutFile, 'utf8');

    assert(content.includes("label: 'Customers'"), 'Must include Customers in navItems');
    assert(content.includes("path: '/admin/customers'"), 'Must link Customers to /admin/customers');
    assert(content.includes('Users'), 'Must use Users icon for Customers');
    assert(content.includes("p.startsWith('/admin/customers/')"), 'Must handle /admin/customers/ breadcrumbs');
    assert(content.includes("Back to Customers"), 'Must set Back to Customers breadcrumb link');

    record('TEST_06', 'AdminLayout includes Customers navigation entry and dynamic breadcrumbs', 'PASS');
  } catch (err) {
    record('TEST_06', 'AdminLayout includes Customers navigation entry and dynamic breadcrumbs', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: App.jsx Lazy Loading & ProtectedRoute Guarding
  // --------------------------------------------------------------------------
  try {
    const appFile = path.join(rootDir, 'client/src/App.jsx');
    const content = fs.readFileSync(appFile, 'utf8');

    assert(content.includes("lazy(() => import('./pages/admin/AdminCustomersPage'))"), 'Must lazy load AdminCustomersPage');
    assert(content.includes("lazy(() => import('./pages/admin/AdminCustomerDetailPage'))"), 'Must lazy load AdminCustomerDetailPage');
    assert(content.includes('path="/admin/customers"'), 'Must define /admin/customers route');
    assert(content.includes('path="/admin/customers/:id"'), 'Must define /admin/customers/:id route');
    assert(content.includes('requiredRole="ADMIN"'), 'Must require ADMIN role on customer routes');

    record('TEST_07', 'App.jsx correctly mounts lazy customer routes with requireRole="ADMIN"', 'PASS');
  } catch (err) {
    record('TEST_07', 'App.jsx correctly mounts lazy customer routes with requireRole="ADMIN"', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('   TEST RUN SUMMARY');
  console.log('======================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log(`Total Tests : ${total}`);
  console.log(`Passed      : ${passed}`);
  console.log(`Failed      : ${failed}`);

  if (failed > 0) {
    console.error('\nSome frontend tests failed. See details above.');
    process.exit(1);
  } else {
    console.log('\nAll Phase 6C.2 Admin Customer Management frontend tests passed successfully!');
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Unhandled suite error:', err);
  process.exit(1);
});
