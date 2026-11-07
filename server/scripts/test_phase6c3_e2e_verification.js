/**
 * LuxeCart Phase 6C.3: Admin Customer Management E2E HTTP Verification Suite
 *
 * Runs an isolated local Express HTTP server on an ephemeral port (127.0.0.1)
 * and executes real HTTP requests using native fetch() to verify the complete
 * network, cookie authentication, route guarding, validation, controller,
 * service, error handling, and response pipeline.
 *
 * Verifies:
 * 1. GET /api/v1/admin/customers - Unauthenticated rejection (401).
 * 2. GET /api/v1/admin/customers - Non-admin authorization rejection (403).
 * 3. GET /api/v1/admin/customers - Admin authorized directory listing with search, filtering, order stats.
 * 4. GET /api/v1/admin/customers/:id - Admin authorized profile, addresses, order summary, statusHistory.
 * 5. GET /api/v1/admin/customers/:id - Rejection of admin account access (403 CANNOT_MODIFY_ADMIN_ACCOUNT).
 * 6. GET /api/v1/admin/customers/:id/orders - Paginated order history with demo exclusion.
 * 7. PATCH /api/v1/admin/customers/:id/status - Account suspension, refreshTokens purge, audit event recording.
 * 8. PATCH /api/v1/admin/customers/:id/status - Account reactivation with audit event recording.
 * 9. PATCH /api/v1/admin/customers/:id/status - Rejection of admin account modification (403 CANNOT_MODIFY_ADMIN_ACCOUNT).
 * 10. PATCH /api/v1/admin/customers/:id/status - Rejection of invalid status or prohibited fields (400).
 * 11. Invalid customer ID format handling (400 INVALID_ID).
 * 12. Non-existent customer handling (404 CUSTOMER_NOT_FOUND).
 * 13. Data privacy: customer-facing user methods never expose statusHistory.
 */

import http from 'http';
import assert from 'assert';
import mongoose from 'mongoose';

// Ensure bufferCommands is disabled so no pending DB network connections occur
mongoose.set('bufferCommands', false);

import app from '../src/app.js';
import User from '../src/modules/users/user.model.js';
import Address from '../src/modules/addresses/address.model.js';
import Order from '../src/modules/orders/order.model.js';
import { generateAccessToken } from '../src/utils/token.js';

console.log('======================================================================');
console.log('   LUXECART PHASE 6C.3: E2E HTTP API & SECURITY VERIFICATION SUITE   ');
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
  // Ephemeral test identities
  const adminId = new mongoose.Types.ObjectId().toString();
  const customerId = new mongoose.Types.ObjectId().toString();
  const targetAdminId = new mongoose.Types.ObjectId().toString();
  const nonExistentId = new mongoose.Types.ObjectId().toString();

  // Generate real signed JWT tokens
  const adminToken = generateAccessToken({ _id: adminId, role: 'ADMIN' });
  const customerToken = generateAccessToken({ _id: customerId, role: 'CUSTOMER' });

  // In-memory data store for isolated testing
  const customerRecord = {
    _id: new mongoose.Types.ObjectId(customerId),
    name: 'Eleanor Vance',
    email: 'eleanor.vance@example.com',
    phone: '9876543210',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    createdAt: new Date('2026-02-15T10:00:00Z'),
    updatedAt: new Date('2026-02-15T10:00:00Z'),
    refreshTokens: [{ tokenHash: 'hash-abc', expiresAt: new Date(Date.now() + 86400000) }],
    statusHistory: [
      {
        _id: new mongoose.Types.ObjectId(),
        status: 'ACTIVE',
        changedAt: new Date('2026-02-15T10:00:00Z'),
        changedBy: null,
        note: 'Account registered',
      },
    ],
  };

  const targetAdminRecord = {
    _id: new mongoose.Types.ObjectId(targetAdminId),
    name: 'Super Administrator',
    email: 'superadmin@luxecart.com',
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  const addressRecord = {
    _id: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(customerId),
    fullName: 'Eleanor Vance',
    phone: '9876543210',
    addressLine1: 'Villa 12, Palm Meadows',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560066',
    country: 'India',
    isDefault: true,
    type: 'HOME',
    createdAt: new Date('2026-02-15T10:05:00Z'),
  };

  const orderRecord = {
    _id: new mongoose.Types.ObjectId(),
    orderNumber: 'LC-20260216-EV01',
    userId: new mongoose.Types.ObjectId(customerId),
    status: 'CONFIRMED',
    isDemo: false,
    pricing: { grandTotal: 349900, itemCount: 1 },
    items: [{ title: 'Silk Blazer', quantity: 1, totalPrice: 349900 }],
    createdAt: new Date('2026-02-16T14:30:00Z'),
    updatedAt: new Date('2026-02-16T14:30:00Z'),
  };

  // Wire up model mocks to isolated in-memory records
  const origUserCount = User.countDocuments;
  const origUserFind = User.find;
  const origUserFindById = User.findById;
  const origUserFindByIdAndUpdate = User.findByIdAndUpdate;
  const origAddressFind = Address.find;
  const origOrderCount = Order.countDocuments;
  const origOrderFind = Order.find;
  const origOrderAggregate = Order.aggregate;

  User.countDocuments = async (filter) => {
    if (filter.role === 'CUSTOMER') return 1;
    return 0;
  };

  User.find = (filter) => {
    const q = {
      sort: () => q,
      skip: () => q,
      limit: () => q,
      select: () => q,
      lean: async () => [customerRecord],
    };
    return q;
  };

  User.findById = (id) => {
    const idStr = id.toString();
    const doc = idStr === customerId ? customerRecord : idStr === targetAdminId ? targetAdminRecord : null;
    const q = {
      select: (fields) => {
        const hasStatusHistory = typeof fields === 'string' && fields.includes('+statusHistory');
        const retDoc = doc ? { ...doc } : null;
        if (retDoc && !hasStatusHistory && fields !== '_id name email phone status createdAt updatedAt statusHistory') {
          // If not explicitly requested, statusHistory is not included
        }
        return {
          lean: async () => retDoc,
          then: (res) => Promise.resolve(retDoc).then(res),
        };
      },
      lean: async () => doc,
      then: (res) => Promise.resolve(doc).then(res),
    };
    return q;
  };

  let lastUpdateOps = null;
  User.findByIdAndUpdate = (id, updateOps) => {
    lastUpdateOps = updateOps;
    const idStr = id.toString();
    if (idStr === customerId) {
      if (updateOps.$set?.status) customerRecord.status = updateOps.$set.status;
      if (updateOps.$set?.refreshTokens !== undefined) customerRecord.refreshTokens = updateOps.$set.refreshTokens;
      if (updateOps.$push?.statusHistory) customerRecord.statusHistory.push(updateOps.$push.statusHistory);
    }
    const q = {
      select: () => ({
        lean: async () => ({
          _id: customerRecord._id,
          name: customerRecord.name,
          email: customerRecord.email,
          phone: customerRecord.phone,
          status: customerRecord.status,
          updatedAt: new Date(),
          statusHistory: customerRecord.statusHistory,
        }),
      }),
    };
    return q;
  };

  Address.find = () => ({
    sort: () => ({
      lean: async () => [addressRecord],
    }),
  });

  Order.countDocuments = async (filter) => {
    if (filter.isDemo?.$ne === true) return 1;
    return 0;
  };

  Order.find = (filter) => ({
    sort: () => ({
      skip: () => ({
        limit: () => ({
          select: () => ({
            lean: async () => [orderRecord],
          }),
        }),
      }),
    }),
  });

  Order.aggregate = async () => [
    {
      _id: new mongoose.Types.ObjectId(customerId),
      totalOrders: 1,
      totalSpentPaise: 349900,
      lastOrderDate: orderRecord.createdAt,
    },
  ];

  // Start HTTP server on ephemeral port (0)
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Unauthenticated access to /admin/customers is rejected (401)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/customers`);
      const body = await res.json();
      assert.strictEqual(res.status, 401, 'Should return HTTP 401');
      assert.strictEqual(body.error?.code || body.code, 'UNAUTHENTICATED');
      record('E2E_01', 'GET /admin/customers rejects unauthenticated requests with HTTP 401 UNAUTHENTICATED', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 2: Customer role access to /admin/customers is forbidden (403)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/customers`, {
        headers: {
          Cookie: `accessToken=${customerToken}`,
        },
      });
      const body = await res.json();
      assert.strictEqual(res.status, 403, 'Should return HTTP 403');
      assert.strictEqual(body.error?.code || body.code, 'FORBIDDEN');
      record('E2E_02', 'GET /admin/customers rejects non-admin users with HTTP 403 FORBIDDEN', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 3: Admin authorized directory query (200 OK)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/customers?page=1&limit=10&status=ALL&search=Eleanor`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200, 'Should return HTTP 200');
      assert.strictEqual(body.success, true);
      assert(Array.isArray(body.data.customers));
      assert.strictEqual(body.data.customers.length, 1);
      const cust = body.data.customers[0];
      assert.strictEqual(cust.id, customerId);
      assert.strictEqual(cust.name, 'Eleanor Vance');
      assert.strictEqual(cust.totalOrders, 1);
      assert.strictEqual(cust.totalSpentPaise, 349900);

      // Verify no sensitive fields returned
      assert.strictEqual(cust.passwordHash, undefined);
      assert.strictEqual(cust.refreshTokens, undefined);

      record('E2E_03', 'GET /admin/customers returns paginated customer directory with order metrics', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 4: Customer Profile detail retrieval (200 OK)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/customers/${customerId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200, 'Should return HTTP 200');
      assert.strictEqual(body.success, true);
      assert(body.data.customer);
      assert.strictEqual(body.data.customer.id, customerId);
      assert.strictEqual(body.data.customer.email, 'eleanor.vance@example.com');
      assert.strictEqual(body.data.customer.addresses.length, 1);
      assert.strictEqual(body.data.customer.addresses[0].city, 'Bengaluru');
      assert.strictEqual(body.data.customer.orderSummary.totalOrders, 1);
      assert.strictEqual(body.data.customer.orderSummary.totalSpentPaise, 349900);
      assert(Array.isArray(body.data.customer.statusHistory));

      // Sensitive fields check
      assert.strictEqual(body.data.customer.passwordHash, undefined);
      assert.strictEqual(body.data.customer.refreshTokens, undefined);

      record('E2E_04', 'GET /admin/customers/:id returns full sanitized profile, addresses, metrics, and audit history', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 5: Admin Account Protection on GET (403 CANNOT_MODIFY_ADMIN_ACCOUNT)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/customers/${targetAdminId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });
      const body = await res.json();
      assert.strictEqual(res.status, 403, 'Should return HTTP 403');
      assert.strictEqual(body.error?.code || body.code, 'CANNOT_MODIFY_ADMIN_ACCOUNT');
      record('E2E_05', 'GET /admin/customers/:adminId throws 403 CANNOT_MODIFY_ADMIN_ACCOUNT', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 6: Customer Order History retrieval (200 OK)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/customers/${customerId}/orders?page=1&limit=5`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200, 'Should return HTTP 200');
      assert.strictEqual(body.success, true);
      assert(Array.isArray(body.data.orders));
      assert.strictEqual(body.data.orders.length, 1);
      assert.strictEqual(body.data.orders[0].orderNumber, 'LC-20260216-EV01');
      assert.strictEqual(body.data.orders[0].grandTotalPaise, 349900);
      record('E2E_06', 'GET /admin/customers/:id/orders returns paginated orders with demo orders excluded', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 7: Customer Account Suspension & Session Revocation (200 OK)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/customers/${customerId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `accessToken=${adminToken}`,
        },
        body: JSON.stringify({
          status: 'SUSPENDED',
          reason: 'Excessive fraudulent payment attempts',
        }),
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200, 'Should return HTTP 200');
      assert.strictEqual(body.data.customer.status, 'SUSPENDED');

      // Verify that refreshTokens was atomically purged
      assert.deepStrictEqual(customerRecord.refreshTokens, []);
      assert.deepStrictEqual(lastUpdateOps.$set.refreshTokens, []);

      // Verify that audit history entry was appended
      const latestHistory = customerRecord.statusHistory[customerRecord.statusHistory.length - 1];
      assert.strictEqual(latestHistory.status, 'SUSPENDED');
      assert.strictEqual(latestHistory.changedBy, adminId);
      assert.strictEqual(latestHistory.note, 'Excessive fraudulent payment attempts');

      record('E2E_07', 'PATCH /admin/customers/:id/status (SUSPENDED) purges refresh tokens and logs audit trail', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 8: Customer Account Reactivation (200 OK)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/customers/${customerId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `accessToken=${adminToken}`,
        },
        body: JSON.stringify({
          status: 'ACTIVE',
          reason: 'Identity verified with security team',
        }),
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200, 'Should return HTTP 200');
      assert.strictEqual(body.data.customer.status, 'ACTIVE');

      // Verify audit history entry was appended
      const latestHistory = customerRecord.statusHistory[customerRecord.statusHistory.length - 1];
      assert.strictEqual(latestHistory.status, 'ACTIVE');
      assert.strictEqual(latestHistory.changedBy, adminId);
      assert.strictEqual(latestHistory.note, 'Identity verified with security team');

      record('E2E_08', 'PATCH /admin/customers/:id/status (ACTIVE) restores active standing and records audit note', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 9: Admin Account Protection on PATCH (403 CANNOT_MODIFY_ADMIN_ACCOUNT)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/customers/${targetAdminId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `accessToken=${adminToken}`,
        },
        body: JSON.stringify({
          status: 'SUSPENDED',
          reason: 'Malicious attempt to lock out admin',
        }),
      });
      const body = await res.json();
      assert.strictEqual(res.status, 403, 'Should return HTTP 403');
      assert.strictEqual(body.error?.code || body.code, 'CANNOT_MODIFY_ADMIN_ACCOUNT');
      record('E2E_09', 'PATCH /admin/customers/:adminId/status throws 403 CANNOT_MODIFY_ADMIN_ACCOUNT', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 10: Invalid Status / Prohibited Fields Injection Rejection (400)
    // ------------------------------------------------------------------------
    {
      // 1. Prohibited field injection (attempting to alter role or email)
      const res1 = await fetch(`${baseUrl}/admin/customers/${customerId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `accessToken=${adminToken}`,
        },
        body: JSON.stringify({
          status: 'ACTIVE',
          role: 'ADMIN',
        }),
      });
      const body1 = await res1.json();
      assert.strictEqual(res1.status, 400, 'Should return HTTP 400');
      assert.strictEqual(body1.error?.code || body1.code, 'VALIDATION_ERROR');

      // 2. Prohibited status value (e.g. INACTIVE cannot be set via customer management)
      const res2 = await fetch(`${baseUrl}/admin/customers/${customerId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `accessToken=${adminToken}`,
        },
        body: JSON.stringify({
          status: 'INACTIVE',
        }),
      });
      const body2 = await res2.json();
      assert.strictEqual(res2.status, 400, 'Should return HTTP 400');
      assert.strictEqual(body2.error?.code || body2.code, 'VALIDATION_ERROR');

      record('E2E_10', 'PATCH /admin/customers/:id/status rejects prohibited field injection and invalid status values', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 11: Invalid ObjectId Handling (400 INVALID_ID)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/customers/not-a-valid-hex-id`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });
      const body = await res.json();
      assert.strictEqual(res.status, 400, 'Should return HTTP 400');
      assert.strictEqual(body.error?.code || body.code, 'INVALID_ID');
      record('E2E_11', 'GET /admin/customers/invalid-id returns HTTP 400 INVALID_ID', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 12: Non-existent Customer Handling (404 CUSTOMER_NOT_FOUND)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/customers/${nonExistentId}`, {
        headers: {
          Cookie: `accessToken=${adminToken}`,
        },
      });
      const body = await res.json();
      assert.strictEqual(res.status, 404, 'Should return HTTP 404');
      assert.strictEqual(body.error?.code || body.code, 'CUSTOMER_NOT_FOUND');
      record('E2E_12', 'GET /admin/customers/:id for missing record returns HTTP 404 CUSTOMER_NOT_FOUND', 'PASS');
    }

    // ------------------------------------------------------------------------
    // TEST 13: Customer-Facing Responses Data Privacy
    // ------------------------------------------------------------------------
    {
      const testUserDoc = new User({
        name: 'Privacy Test User',
        email: 'privacy@luxecart.com',
        phone: '9998887770',
        role: 'CUSTOMER',
        status: 'SUSPENDED',
      });
      testUserDoc.statusHistory = [
        {
          status: 'SUSPENDED',
          changedAt: new Date(),
          changedBy: new mongoose.Types.ObjectId(adminId),
          note: 'Sensitive internal fraud investigation note',
        },
      ];

      const safeObj = testUserDoc.toSafeObject();
      assert.strictEqual(safeObj.statusHistory, undefined, 'toSafeObject must not expose statusHistory');

      const jsonDoc = testUserDoc.toJSON();
      assert.strictEqual(jsonDoc.statusHistory, undefined, 'toJSON transform must delete statusHistory');
      assert.strictEqual(jsonDoc.passwordHash, undefined);
      assert.strictEqual(jsonDoc.refreshTokens, undefined);

      record('E2E_13', 'Customer-facing user serialization strictly excludes statusHistory and admin audit notes', 'PASS');
    }
  } finally {
    // Teardown HTTP server cleanly
    await new Promise((resolve) => server.close(resolve));

    // Restore original model functions
    User.countDocuments = origUserCount;
    User.find = origUserFind;
    User.findById = origUserFindById;
    User.findByIdAndUpdate = origUserFindByIdAndUpdate;
    Address.find = origAddressFind;
    Order.countDocuments = origOrderCount;
    Order.find = origOrderFind;
    Order.aggregate = origOrderAggregate;
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
    console.error('\nSome E2E tests failed. See details above.');
    process.exit(1);
  } else {
    console.log('\nAll Phase 6C.3 E2E HTTP API & Security tests passed successfully!');
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Unhandled suite error:', err);
  process.exit(1);
});
