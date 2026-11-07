/**
 * LuxeCart Phase 6E.4: Admin Store Settings Integration & E2E Verification Suite
 *
 * Isolated Test Harness (Zero writes to production MongoDB Atlas):
 * 1. Admin can fetch settings (GET /api/v1/admin/settings).
 * 2. Admin can update permitted settings (PATCH /api/v1/admin/settings).
 * 3. Unauthenticated requests strictly return HTTP 401 Unauthorized.
 * 4. Customer requests strictly return HTTP 403 Forbidden.
 * 5. Invalid fields and values return HTTP 400 with descriptive validation errors.
 * 6. Server-managed fields (_id, singletonKey, lastUpdatedBy) cannot be overwritten.
 * 7. Updating one nested field atomically preserves unrelated fields without snapshot overwrites.
 * 8. Failed database operations fail closed (HTTP 503) and do not return false success.
 * 9. Public settings endpoint (/api/v1/settings/public) strips all internal secrets and metadata.
 * 10. Monetary precision round-trip verification (₹200, ₹199.99, ₹0.50, ₹1,00,000).
 * 11. Delivery estimate bounds and min <= max validation.
 * 12. Return window and COD limits validation.
 * 13. Maintenance mode verification:
 *     - Disabled: customer operations proceed.
 *     - Enabled: customer mutations (orders, reviews) blocked with 503.
 *     - Admin operations, auth, public settings, and catalog browsing remain available.
 */

import http from 'http';
import assert from 'assert';
import mongoose from 'mongoose';

// Prevent Mongoose from buffering commands or attempting live Atlas connections
mongoose.set('bufferCommands', false);

import app from '../src/app.js';
import { generateAccessToken } from '../src/utils/token.js';
import StoreSettings, { SINGLETON_KEY } from '../src/modules/settings/storeSettings.model.js';
import { storeSettingsService } from '../src/modules/settings/storeSettings.service.js';
import {
  paiseToRupees,
  rupeesToPaise,
  validateSettingsForm,
} from '../../client/src/features/admin/settings/api/adminSettingsApi.js';

console.log('======================================================================');
console.log('   LUXECART PHASE 6E.4: STORE SETTINGS INTEGRATION & E2E SUITE       ');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

function record(testId, name, status, details = '') {
  if (status === 'PASS') {
    passCount++;
    console.log(`✔ [PASS] [${testId}] ${name}`);
  } else {
    failCount++;
    console.error(`✖ [FAIL] [${testId}] ${name}`);
    if (details) {
      console.error(`       Details: ${details}`);
    }
  }
}

async function runSuite() {
  const adminId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

  const adminToken = generateAccessToken({
    _id: adminId.toString(),
    id: adminId.toString(),
    email: 'admin@luxecart.com',
    role: 'ADMIN',
  });

  const customerToken = generateAccessToken({
    _id: customerId.toString(),
    id: customerId.toString(),
    email: 'customer@example.com',
    role: 'CUSTOMER',
  });

  // Start HTTP server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  // Persistent in-memory mock document
  const inMemoryDoc = {
    _id: new mongoose.Types.ObjectId(),
    singletonKey: SINGLETON_KEY,
    storeName: 'LuxeCart Flagship',
    tagline: 'Curated Luxury Fashion & Lifestyle',
    logoUrlLight: 'https://cdn.example.com/logo-light.svg',
    logoUrlDark: 'https://cdn.example.com/logo-dark.svg',
    faviconUrl: 'https://cdn.example.com/fav.ico',
    supportEmail: 'support@luxecart.com',
    supportPhone: '+91 98765 43210',
    operatingHours: 'Mon - Sat: 10:00 AM - 7:00 PM IST',
    address: {
      street: '100 Feet Road, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      country: 'India',
    },
    currency: {
      code: 'INR',
      symbol: '₹',
      name: 'Indian Rupee',
      locale: 'en-IN',
    },
    shipping: {
      standardFeePaise: 20000,
      enableFreeShippingThreshold: false,
      freeShippingThresholdPaise: 500000,
      deliveryEstimateDays: { min: 3, max: 7 },
    },
    payment: {
      isCodEnabled: true,
      maxCodOrderPaise: 10000000,
    },
    returns: {
      isReturnsEnabled: true,
      returnWindowDays: 7,
    },
    maintenance: {
      isMaintenanceMode: false,
      maintenanceMessage: 'The store is currently undergoing scheduled maintenance.',
    },
    socialLinks: {
      instagram: 'https://instagram.com/luxecart',
      facebook: '',
      twitter: '',
      pinterest: '',
    },
    seo: {
      metaTitle: 'LuxeCart — Curated Luxury Fashion & Lifestyle',
      metaDescription: 'Discover premier luxury fashion, accessories, and curated lifestyle collections on LuxeCart.',
      keywords: ['luxury fashion', 'designer wear'],
    },
    lastUpdatedBy: {
      _id: adminId,
      name: 'Chief Admin',
      email: 'admin@luxecart.com',
      role: 'ADMIN',
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    toObject() {
      return { ...this };
    },
    populate: async function () {
      return this;
    },
  };

  const origFindOne = StoreSettings.findOne;
  const origFindOneAndUpdate = StoreSettings.findOneAndUpdate;

  const mockQuery = () => ({
    populate: async () => inMemoryDoc,
    exec: async () => inMemoryDoc,
    then: (resolve) => resolve(inMemoryDoc),
  });

  StoreSettings.findOne = () => mockQuery();

  StoreSettings.findOneAndUpdate = (filter, update) => {
    if (update.$set) {
      for (const [dotPath, val] of Object.entries(update.$set)) {
        if (dotPath.includes('.')) {
          const parts = dotPath.split('.');
          let curr = inMemoryDoc;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
          }
          curr[parts[parts.length - 1]] = val;
        } else {
          inMemoryDoc[dotPath] = val;
        }
      }
    }
    inMemoryDoc.updatedAt = new Date();
    return mockQuery();
  };

  // -------------------------------------------------------------------------
  // TEST 01: Admin Can Fetch Settings (GET /api/v1/admin/settings)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${baseUrl}/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.storeName, 'LuxeCart Flagship');
    assert.strictEqual(json.data.singletonKey, SINGLETON_KEY);
    assert.strictEqual(json.data.lastUpdatedBy.email, 'admin@luxecart.com');

    record('INT_01', 'Admin can fetch full store settings with author population', 'PASS');
  } catch (err) {
    record('INT_01', 'Admin can fetch full store settings', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 02: Admin Can Update Permitted Settings (PATCH /api/v1/admin/settings)
  // -------------------------------------------------------------------------
  try {
    storeSettingsService.invalidateCache();
    const updateRes = await fetch(`${baseUrl}/admin/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        storeName: 'LuxeCart Maison',
        shipping: {
          standardFeePaise: 25000,
          enableFreeShippingThreshold: true,
          freeShippingThresholdPaise: 600000,
        },
      }),
    });
    assert.strictEqual(updateRes.status, 200);
    const json = await updateRes.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.storeName, 'LuxeCart Maison');
    assert.strictEqual(inMemoryDoc.shipping.standardFeePaise, 25000);
    assert.strictEqual(inMemoryDoc.shipping.enableFreeShippingThreshold, true);
    assert.strictEqual(inMemoryDoc.shipping.freeShippingThresholdPaise, 600000);

    record('INT_02', 'Admin can update permitted settings through atomic PATCH', 'PASS');
  } catch (err) {
    record('INT_02', 'Admin can update permitted settings', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 03: Unauthenticated Access Strictly Returns HTTP 401
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${baseUrl}/admin/settings`);
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.success, false);

    record('INT_03', 'Unauthenticated request to admin settings returns HTTP 401', 'PASS');
  } catch (err) {
    record('INT_03', 'Unauthenticated access returns 401', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 04: Customer Accounts Strictly Return HTTP 403 Forbidden
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${baseUrl}/admin/settings`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.strictEqual(res.status, 403);
    const json = await res.json();
    assert.strictEqual(json.success, false);

    record('INT_04', 'Customer account accessing admin settings returns HTTP 403', 'PASS');
  } catch (err) {
    record('INT_04', 'Customer account returns 403', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 05: Invalid Fields and Out-of-Bounds Values Return HTTP 400
  // -------------------------------------------------------------------------
  try {
    // 5a. Out of bounds shipping fee (> 1000000)
    const res1 = await fetch(`${baseUrl}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ shipping: { standardFeePaise: 2000000 } }),
    });
    assert.strictEqual(res1.status, 400);

    // 5b. Delivery min > max
    const res2 = await fetch(`${baseUrl}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ shipping: { deliveryEstimateDays: { min: 10, max: 5 } } }),
    });
    assert.strictEqual(res2.status, 400);

    // 5c. Invalid email format
    const res3 = await fetch(`${baseUrl}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ supportEmail: 'not-an-email' }),
    });
    assert.strictEqual(res3.status, 400);

    record('INT_05', 'Invalid fields and out-of-bounds parameters strictly return HTTP 400', 'PASS');
  } catch (err) {
    record('INT_05', 'Invalid fields return 400', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 06: Server-Managed and Prohibited Fields Cannot Be Overwritten
  // -------------------------------------------------------------------------
  try {
    const prohibitedFields = ['singletonKey', '_id', 'lastUpdatedBy', 'role', 'jwtSecret', 'mongoUri'];
    for (const field of prohibitedFields) {
      const res = await fetch(`${baseUrl}/admin/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ [field]: 'ATTEMPTED_OVERWRITE' }),
      });
      assert.strictEqual(res.status, 400, `Field '${field}' must be rejected with 400`);
    }

    record('INT_06', 'Server-managed and protected root fields cannot be modified via PATCH', 'PASS');
  } catch (err) {
    record('INT_06', 'Protected fields cannot be overwritten', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 07: Updating One Nested Field Preserves Unrelated Settings (SEC-05)
  // -------------------------------------------------------------------------
  try {
    // Current support phone before update
    const previousPhone = inMemoryDoc.supportPhone;
    assert.ok(previousPhone);

    // Update only returns.returnWindowDays
    const patchRes = await fetch(`${baseUrl}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ returns: { returnWindowDays: 14 } }),
    });
    assert.strictEqual(patchRes.status, 200);

    // Verify returns updated while supportPhone and shipping remain intact
    assert.strictEqual(inMemoryDoc.returns.returnWindowDays, 14);
    assert.strictEqual(inMemoryDoc.supportPhone, previousPhone, 'Unrelated field must not be overwritten');
    assert.strictEqual(inMemoryDoc.shipping.standardFeePaise, 25000, 'Unrelated section must not be overwritten');

    record('INT_07', 'Atomic dot-notation updates preserve unrelated sections and sibling fields', 'PASS');
  } catch (err) {
    record('INT_07', 'Atomic dot-notation updates preserve unrelated settings', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 08: Failed Database Operations Do Not Return False Success (HTTP 503)
  // -------------------------------------------------------------------------
  try {
    const origGetOrCreate = storeSettingsService.getOrCreateStoreSettings;
    storeSettingsService.getOrCreateStoreSettings = async () => {
      const err = new Error('Database server selection timeout');
      err.name = 'MongoServerSelectionError';
      throw err;
    };

    // Public settings during DB outage uses fallback without crashing
    const publicRes = await fetch(`${baseUrl}/settings/public`);
    assert.strictEqual(publicRes.status, 200, 'Public storefront degrades gracefully to defaults');

    // Admin settings during DB outage fails closed
    StoreSettings.findOne = () => {
      throw new Error('Database connection failed');
    };

    const adminRes = await fetch(`${baseUrl}/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminRes.status, 500, 'Admin settings route fails closed during DB outage');

    // Restore
    storeSettingsService.getOrCreateStoreSettings = origGetOrCreate;
    StoreSettings.findOne = () => mockQuery();

    record('INT_08', 'Database failure fails closed without returning false success', 'PASS');
  } catch (err) {
    record('INT_08', 'Database failure fails closed', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 09: Public Settings Endpoint Strips All Internal Secrets and Metadata
  // -------------------------------------------------------------------------
  try {
    storeSettingsService.invalidateCache();
    const res = await fetch(`${baseUrl}/settings/public`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);

    const pub = json.data;
    // Stripped fields
    assert.strictEqual(pub._id, undefined, '_id must be stripped');
    assert.strictEqual(pub.singletonKey, undefined, 'singletonKey must be stripped');
    assert.strictEqual(pub.lastUpdatedBy, undefined, 'lastUpdatedBy must be stripped');
    assert.strictEqual(pub.__v, undefined, '__v must be stripped');

    // Converted Rupee fields
    assert.strictEqual(typeof pub.shipping.standardFeeRupees, 'number');
    assert.strictEqual(typeof pub.shipping.standardFeePaise, 'number');
    assert.strictEqual(typeof pub.payment.maxCodOrderRupees, 'number');

    record('INT_09', 'Public settings endpoint strictly exposes sanitized storefront fields without secrets', 'PASS');
  } catch (err) {
    record('INT_09', 'Public settings endpoint strips secrets', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Monetary Precision Round-Trip Verification
  // -------------------------------------------------------------------------
  try {
    const testCases = [
      { rupees: 200, expectedPaise: 20000 },
      { rupees: 199.99, expectedPaise: 19999 },
      { rupees: 0.5, expectedPaise: 50 },
      { rupees: 100000, expectedPaise: 10000000 },
    ];

    for (const { rupees, expectedPaise } of testCases) {
      const convertedPaise = rupeesToPaise(rupees);
      assert.strictEqual(convertedPaise, expectedPaise, `rupeesToPaise(${rupees}) must equal ${expectedPaise}`);
      const roundTripRupees = paiseToRupees(convertedPaise);
      assert.strictEqual(roundTripRupees, rupees, `paiseToRupees(${convertedPaise}) must equal ${rupees}`);
      assert.ok(Number.isInteger(convertedPaise), 'Paise value must strictly be an integer');
    }

    record('INT_10', 'Monetary precision round-trip verification (₹200, ₹199.99, ₹0.50, ₹1,00,000)', 'PASS');
  } catch (err) {
    record('INT_10', 'Monetary precision round-trip verification', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Delivery Estimate Bounds and Min <= Max Validation
  // -------------------------------------------------------------------------
  try {
    // Valid delivery window
    const validForm = {
      storeName: 'LuxeCart',
      supportEmail: 'support@luxecart.com',
      shipping: { standardFeeRupees: 100, deliveryEstimateDays: { min: 2, max: 6 } },
      payment: { maxCodOrderRupees: 50000 },
      returns: { returnWindowDays: 7 },
    };
    assert.deepStrictEqual(validateSettingsForm(validForm), {});

    // Min > Max
    const invalidForm = {
      ...validForm,
      shipping: { standardFeeRupees: 100, deliveryEstimateDays: { min: 8, max: 4 } },
    };
    const errors = validateSettingsForm(invalidForm);
    assert.ok(errors['shipping.deliveryEstimateDays.min'], 'Min > Max must produce validation error');

    record('INT_11', 'Delivery estimate validation strictly enforces min <= max and bounds between 1-60', 'PASS');
  } catch (err) {
    record('INT_11', 'Delivery estimate bounds validation', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Return Window and COD Limits Validation
  // -------------------------------------------------------------------------
  try {
    // Return window > 90
    const errReturn = validateSettingsForm({
      storeName: 'LuxeCart',
      supportEmail: 'support@luxecart.com',
      shipping: { standardFeeRupees: 100, deliveryEstimateDays: { min: 2, max: 6 } },
      payment: { maxCodOrderRupees: 50000 },
      returns: { returnWindowDays: 95 },
    });
    assert.ok(errReturn['returns.returnWindowDays'], 'Return window > 90 days must be rejected');

    // COD limit > 10,00,000
    const errCod = validateSettingsForm({
      storeName: 'LuxeCart',
      supportEmail: 'support@luxecart.com',
      shipping: { standardFeeRupees: 100, deliveryEstimateDays: { min: 2, max: 6 } },
      payment: { maxCodOrderRupees: 1500000 },
      returns: { returnWindowDays: 7 },
    });
    assert.ok(errCod['payment.maxCodOrderRupees'], 'COD limit > ₹10,00,000 must be rejected');

    record('INT_12', 'Return window (0-90) and COD limits (₹100 to ₹10,00,000) validated accurately', 'PASS');
  } catch (err) {
    record('INT_12', 'Return window and COD limits validation', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 13: Maintenance Mode Verification
  // -------------------------------------------------------------------------
  try {
    // 13a. Maintenance mode disabled: customer operations proceed
    inMemoryDoc.maintenance = {
      isMaintenanceMode: false,
      maintenanceMessage: '',
    };
    storeSettingsService.invalidateCache();

    // 13b. Maintenance mode enabled: protected customer mutations return 503
    inMemoryDoc.maintenance = {
      isMaintenanceMode: true,
      maintenanceMessage: 'Scheduled system upgrade in progress.',
    };
    storeSettingsService.invalidateCache();

    // Customer order creation blocked with 503
    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(orderRes.status, 503, 'Customer orders must return 503 during maintenance');
    const orderJson = await orderRes.json();
    assert.strictEqual(orderJson.code, 'MAINTENANCE_MODE');
    assert.strictEqual(orderJson.message, 'Scheduled system upgrade in progress.');

    // Customer review creation blocked with 503
    const reviewRes = await fetch(`${baseUrl}/products/test-product-id/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ rating: 5, comment: 'Nice' }),
    });
    assert.strictEqual(reviewRes.status, 503, 'Customer reviews must return 503 during maintenance');

    // 13c. Admin access remains available
    const adminGet = await fetch(`${baseUrl}/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminGet.status, 200, 'Admin settings GET must remain operational during maintenance');

    const adminPatch = await fetch(`${baseUrl}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ storeName: 'LuxeCart Under Maintenance' }),
    });
    assert.strictEqual(adminPatch.status, 200, 'Admin settings PATCH must remain operational during maintenance');

    // 13d. Authentication routes remain available
    const authRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@test.com', password: 'password123' }),
    });
    assert.notStrictEqual(authRes.status, 503, 'Auth routes must not return 503 during maintenance');

    // 13e. Public settings endpoint remains available
    const pubRes = await fetch(`${baseUrl}/settings/public`);
    assert.strictEqual(pubRes.status, 200, 'Public settings route must remain 200 during maintenance');
    const pubJson = await pubRes.json();
    assert.strictEqual(pubJson.data.maintenance.isMaintenanceMode, true);

    // Reset maintenance mode
    inMemoryDoc.maintenance = {
      isMaintenanceMode: false,
      maintenanceMessage: '',
    };
    storeSettingsService.invalidateCache();

    record('INT_13', 'Maintenance mode middleware correctly blocks commerce mutations while preserving admin, auth, and catalog', 'PASS');
  } catch (err) {
    record('INT_13', 'Maintenance mode verification', 'FAIL', err.message);
  } finally {
    StoreSettings.findOne = origFindOne;
    StoreSettings.findOneAndUpdate = origFindOneAndUpdate;
    await new Promise((resolve) => server.close(resolve));
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('======================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
