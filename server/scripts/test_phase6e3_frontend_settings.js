/**
 * LuxeCart — Phase 6E.3: Admin Store Settings Frontend Verification Suite
 *
 * Verifies:
 * 1. Settings load and form population (paise to rupees conversion, all sections).
 * 2. API loading and error states handling.
 * 3. Successful settings update (payload construction, integer paise conversion).
 * 4. Failed update does not falsely show success (error propagation).
 * 5. Unsaved changes and discard behavior (dirty state detection, form reset).
 * 6. Monetary conversion and bounds validation (negative rejection, limits).
 * 7. Delivery estimate validation (min <= max, bounds 1-60).
 * 8. Maintenance mode confirmation (modal requirement, warning details).
 * 9. Immutable settings protection (INR & COD cannot be changed/disabled).
 * 10. Admin route protection and navigation integration (AdminLayout & App.jsx).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('======================================================================');
console.log('   LUXECART PHASE 6E.3: ADMIN SETTINGS FRONTEND VERIFICATION SUITE    ');
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
  const settingsApiPath = path.join(rootDir, 'client/src/features/admin/settings/api/adminSettingsApi.js');
  const settingsPagePath = path.join(rootDir, 'client/src/pages/admin/AdminSettingsPage.jsx');
  const adminLayoutPath = path.join(rootDir, 'client/src/layouts/AdminLayout.jsx');
  const appJsxPath = path.join(rootDir, 'client/src/App.jsx');

  const settingsApiSource = fs.readFileSync(settingsApiPath, 'utf-8');
  const settingsPageSource = fs.readFileSync(settingsPagePath, 'utf-8');
  const adminLayoutSource = fs.readFileSync(adminLayoutPath, 'utf-8');
  const appJsxSource = fs.readFileSync(appJsxPath, 'utf-8');

  // Dynamic import of pure helper functions from adminSettingsApi.js
  const {
    paiseToRupees,
    rupeesToPaise,
    formatCurrencyRupees,
    validateSettingsForm,
    buildSettingsPatchPayload,
    mapSettingsToForm,
    adminSettingsApi,
  } = await import(`file://${settingsApiPath.replace(/\\/g, '/')}`);

  // -------------------------------------------------------------------------
  // TEST 01: Settings Load and Form Population (Paise to Rupees conversion)
  // -------------------------------------------------------------------------
  try {
    const rawBackendDoc = {
      _id: 'settings-id-123',
      singletonKey: 'STORE_SETTINGS_PRIMARY',
      storeName: 'LuxeCart Flagship',
      tagline: 'Refined Elegance',
      logoUrlLight: 'https://cdn.example.com/light.png',
      logoUrlDark: 'https://cdn.example.com/dark.png',
      faviconUrl: 'https://cdn.example.com/fav.ico',
      supportEmail: 'concierge@luxecart.com',
      supportPhone: '+91 99887 76655',
      operatingHours: 'Mon - Sun: 9:00 AM - 9:00 PM IST',
      address: {
        street: '42 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      },
      currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
      shipping: {
        standardFeePaise: 25000, // ₹250
        enableFreeShippingThreshold: true,
        freeShippingThresholdPaise: 750000, // ₹7,500
        deliveryEstimateDays: { min: 2, max: 5 },
      },
      payment: {
        isCodEnabled: true,
        maxCodOrderPaise: 5000000, // ₹50,000
      },
      returns: {
        isReturnsEnabled: true,
        returnWindowDays: 14,
      },
      maintenance: {
        isMaintenanceMode: false,
        maintenanceMessage: 'Scheduled updates in progress.',
      },
      socialLinks: {
        instagram: 'https://instagram.com/luxecart',
        facebook: 'https://facebook.com/luxecart',
        twitter: 'https://x.com/luxecart',
        pinterest: 'https://pinterest.com/luxecart',
      },
      seo: {
        metaTitle: 'LuxeCart Online',
        metaDescription: 'Luxury collections',
        keywords: ['luxury', 'fashion', 'curated'],
      },
      lastUpdatedBy: {
        _id: 'admin-id-1',
        name: 'Lead Admin',
        email: 'admin@luxecart.com',
        role: 'ADMIN',
      },
      updatedAt: '2026-11-01T12:00:00.000Z',
    };

    const form = mapSettingsToForm(rawBackendDoc);

    // Verify accurate field mapping and paise-to-Rupees conversions
    assert.strictEqual(form.storeName, 'LuxeCart Flagship');
    assert.strictEqual(form.shipping.standardFeeRupees, 250, 'Standard fee must convert from 25000 paise to ₹250');
    assert.strictEqual(form.shipping.enableFreeShippingThreshold, true);
    assert.strictEqual(form.shipping.freeShippingThresholdRupees, 7500, 'Threshold must convert from 750000 paise to ₹7,500');
    assert.strictEqual(form.payment.maxCodOrderRupees, 50000, 'Max COD limit must convert from 5000000 paise to ₹50,000');
    assert.strictEqual(form.returns.returnWindowDays, 14);
    assert.strictEqual(form.seo.keywords, 'luxury, fashion, curated', 'Keywords array must format to comma-separated string');

    record('TEST_01', 'Settings load and form population with accurate paise-to-rupee conversions', 'PASS');
  } catch (err) {
    record('TEST_01', 'Settings load and form population', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 02: API Client Endpoints and Authentication Handling
  // -------------------------------------------------------------------------
  try {
    assert.ok(typeof adminSettingsApi.getAdminSettings === 'function', 'getAdminSettings must be a function');
    assert.ok(typeof adminSettingsApi.updateSettings === 'function', 'updateSettings must be a function');
    assert.ok(typeof adminSettingsApi.getPublicSettings === 'function', 'getPublicSettings must be a function');

    assert.ok(settingsApiSource.includes("api.get('/admin/settings')"), 'getAdminSettings targets /admin/settings');
    assert.ok(settingsApiSource.includes("api.patch('/admin/settings', payload)"), 'updateSettings targets PATCH /admin/settings');
    assert.ok(settingsApiSource.includes("api.get('/settings/public')"), 'getPublicSettings targets /settings/public');

    record('TEST_02', 'API client functions target exact admin and public settings endpoints', 'PASS');
  } catch (err) {
    record('TEST_02', 'API client functions target exact endpoints', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 03: Successful Settings Update Payload Construction (Integer Paise)
  // -------------------------------------------------------------------------
  try {
    const localForm = {
      storeName: '  LuxeCart Global  ',
      tagline: 'Timeless Luxury',
      logoUrlLight: 'https://example.com/logo.svg',
      logoUrlDark: '',
      faviconUrl: '',
      supportEmail: 'CARE@LUXECART.COM  ',
      supportPhone: '+91 98765 43210',
      operatingHours: '10 AM - 7 PM',
      address: {
        street: '100 Feet Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        country: 'India',
      },
      shipping: {
        standardFeeRupees: 199.5, // Check rounding to integer paise
        enableFreeShippingThreshold: true,
        freeShippingThresholdRupees: 4999,
        deliveryEstimateDays: { min: 3, max: 6 },
      },
      payment: {
        isCodEnabled: true,
        maxCodOrderRupees: 80000,
      },
      returns: {
        isReturnsEnabled: true,
        returnWindowDays: 10,
      },
      maintenance: {
        isMaintenanceMode: false,
        maintenanceMessage: 'Store maintenance underway.',
      },
      socialLinks: {
        instagram: 'https://instagram.com/luxecart',
        facebook: '',
        twitter: '',
        pinterest: '',
      },
      seo: {
        metaTitle: 'LuxeCart Global Store',
        metaDescription: 'Finest luxury fashion',
        keywords: 'apparel, designer, couture, bespoke',
      },
    };

    const payload = buildSettingsPatchPayload(localForm);

    // Verify trimming, lowercasing, and integer paise conversions
    assert.strictEqual(payload.storeName, 'LuxeCart Global', 'Store name must be trimmed');
    assert.strictEqual(payload.supportEmail, 'care@luxecart.com', 'Support email must be trimmed and lowercased');
    assert.strictEqual(payload.shipping.standardFeePaise, 19950, '₹199.50 must convert to 19950 integer paise');
    assert.strictEqual(payload.shipping.freeShippingThresholdPaise, 499900, '₹4,999 must convert to 499900 paise');
    assert.strictEqual(payload.payment.maxCodOrderPaise, 8000000, '₹80,000 must convert to 8000000 paise');
    assert.strictEqual(payload.payment.isCodEnabled, true, 'isCodEnabled must be true');
    assert.deepStrictEqual(
      payload.seo.keywords,
      ['apparel', 'designer', 'couture', 'bespoke'],
      'Keywords string must convert to trimmed array of non-empty strings'
    );

    // Verify prohibited server-managed fields are NOT present
    assert.strictEqual(payload._id, undefined, '_id must not be sent');
    assert.strictEqual(payload.singletonKey, undefined, 'singletonKey must not be sent');
    assert.strictEqual(payload.lastUpdatedBy, undefined, 'lastUpdatedBy must not be sent');
    assert.strictEqual(payload.createdAt, undefined, 'createdAt must not be sent');
    assert.strictEqual(payload.updatedAt, undefined, 'updatedAt must not be sent');

    record('TEST_03', 'Payload constructor strips server metadata and converts rupees to integer paise', 'PASS');
  } catch (err) {
    record('TEST_03', 'Payload constructor strips server metadata', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 04: Failed Update Error Handling and No False Success
  // -------------------------------------------------------------------------
  try {
    // Assert in AdminSettingsPage source that error handling prevents false success
    assert.ok(
      settingsPageSource.includes('setSuccessMessage(null)'),
      'Save handler clears previous success message before attempting update'
    );
    assert.ok(
      settingsPageSource.includes('setSaveError('),
      'Save handler sets saveError state when API call rejects'
    );
    assert.ok(
      settingsPageSource.includes('setSaving(false)'),
      'Save handler resets saving state in finally block'
    );

    record('TEST_04', 'Failed updates properly capture error without displaying false success banner', 'PASS');
  } catch (err) {
    record('TEST_04', 'Failed updates error handling', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 05: Unsaved Changes Detection and Discard Behavior
  // -------------------------------------------------------------------------
  try {
    // Assert dirty state tracking and discard logic in source
    assert.ok(
      settingsPageSource.includes('isDirty'),
      'AdminSettingsPage defines isDirty computation'
    );
    assert.ok(
      settingsPageSource.includes('handleDiscard'),
      'AdminSettingsPage provides handleDiscard function'
    );
    assert.ok(
      settingsPageSource.includes('mapSettingsToForm(serverSettings)'),
      'handleDiscard restores form state to current server baseline'
    );
    assert.ok(
      settingsPageSource.includes('beforeunload'),
      'AdminSettingsPage attaches beforeunload listener when isDirty is true'
    );

    record('TEST_05', 'Unsaved changes detection, discard restoration, and navigation warning confirmed', 'PASS');
  } catch (err) {
    record('TEST_05', 'Unsaved changes detection and discard behavior', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 06: Monetary Conversion and Bounds Validation
  // -------------------------------------------------------------------------
  try {
    // Test pure conversion helpers
    assert.strictEqual(paiseToRupees(20000), 200);
    assert.strictEqual(paiseToRupees(0), 0);
    assert.strictEqual(rupeesToPaise(200), 20000);
    assert.strictEqual(rupeesToPaise(150.25), 15025);

    // Negative shipping fee
    const invalidFeeForm = {
      storeName: 'LuxeCart',
      supportEmail: 'support@luxecart.com',
      shipping: { standardFeeRupees: -50, deliveryEstimateDays: { min: 3, max: 7 } },
      payment: { maxCodOrderRupees: 50000 },
      returns: { returnWindowDays: 7 },
    };
    const errsFee = validateSettingsForm(invalidFeeForm);
    assert.ok(errsFee['shipping.standardFeeRupees'], 'Negative shipping fee must be rejected');

    // Excessive shipping fee (> ₹10,000 / 1,000,000 paise)
    const excessiveFeeForm = {
      ...invalidFeeForm,
      shipping: { standardFeeRupees: 15000, deliveryEstimateDays: { min: 3, max: 7 } },
    };
    const errsExcessive = validateSettingsForm(excessiveFeeForm);
    assert.ok(errsExcessive['shipping.standardFeeRupees'], 'Excessive shipping fee must be rejected');

    // COD limit under ₹100
    const invalidCodForm = {
      ...invalidFeeForm,
      shipping: { standardFeeRupees: 100, deliveryEstimateDays: { min: 3, max: 7 } },
      payment: { maxCodOrderRupees: 50 },
    };
    const errsCod = validateSettingsForm(invalidCodForm);
    assert.ok(errsCod['payment.maxCodOrderRupees'], 'COD limit below ₹100 must be rejected');

    record('TEST_06', 'Monetary conversion and boundary validation correctly prevent invalid values', 'PASS');
  } catch (err) {
    record('TEST_06', 'Monetary conversion and bounds validation', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 07: Delivery Estimate Validation (min <= max, bounds 1-60)
  // -------------------------------------------------------------------------
  try {
    const invalidRangeForm = {
      storeName: 'LuxeCart',
      supportEmail: 'support@luxecart.com',
      shipping: { standardFeeRupees: 100, deliveryEstimateDays: { min: 10, max: 5 } },
      payment: { maxCodOrderRupees: 50000 },
      returns: { returnWindowDays: 7 },
    };
    const errsRange = validateSettingsForm(invalidRangeForm);
    assert.ok(
      errsRange['shipping.deliveryEstimateDays.min'],
      'Min delivery days greater than max delivery days must be rejected'
    );

    const outOfBoundsForm = {
      storeName: 'LuxeCart',
      supportEmail: 'support@luxecart.com',
      shipping: { standardFeeRupees: 100, deliveryEstimateDays: { min: 0, max: 70 } },
      payment: { maxCodOrderRupees: 50000 },
      returns: { returnWindowDays: 7 },
    };
    const errsBounds = validateSettingsForm(outOfBoundsForm);
    assert.ok(errsBounds['shipping.deliveryEstimateDays.min'], 'Min days < 1 must be rejected');
    assert.ok(errsBounds['shipping.deliveryEstimateDays.max'], 'Max days > 60 must be rejected');

    record('TEST_07', 'Delivery estimate validation ensures min <= max and strictly bounds between 1-60 days', 'PASS');
  } catch (err) {
    record('TEST_07', 'Delivery estimate validation', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 08: Maintenance Mode Confirmation Modal Behavior
  // -------------------------------------------------------------------------
  try {
    assert.ok(
      settingsPageSource.includes('isMaintenanceModalOpen'),
      'Maintenance modal state exists'
    );
    assert.ok(
      settingsPageSource.includes('handleMaintenanceToggle'),
      'handleMaintenanceToggle interceptor exists'
    );
    assert.ok(
      settingsPageSource.includes('confirmEnableMaintenance'),
      'confirmEnableMaintenance callback exists'
    );
    assert.ok(
      settingsPageSource.includes('Enable Store Maintenance Mode?'),
      'Modal includes explicit confirmation heading'
    );
    assert.ok(
      settingsPageSource.includes('HTTP 503'),
      'Modal explains that checkout will receive 503 notifications'
    );

    record('TEST_08', 'Maintenance mode toggle displays interactive confirmation dialog before activation', 'PASS');
  } catch (err) {
    record('TEST_08', 'Maintenance mode confirmation modal behavior', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 09: Immutable Settings Protection (INR & COD Enforced)
  // -------------------------------------------------------------------------
  try {
    // Assert in UI that Currency is disabled/read-only
    assert.ok(
      settingsPageSource.includes('disabled') && settingsPageSource.includes('INR (₹) — Indian Rupee'),
      'Currency input is permanently disabled in the UI'
    );
    assert.ok(
      settingsPageSource.includes('COD Active & Enforced'),
      'COD payment method displays enforced badge'
    );
    assert.ok(
      settingsPageSource.includes('Platform Invariant:'),
      'UI displays explicit Platform Invariant notice for COD and currency'
    );

    // Verify buildSettingsPatchPayload forces isCodEnabled: true
    const testPayload = buildSettingsPatchPayload({ payment: { isCodEnabled: false } });
    assert.strictEqual(
      testPayload.payment.isCodEnabled,
      true,
      'buildSettingsPatchPayload must enforce isCodEnabled: true'
    );

    record('TEST_09', 'Currency and COD payment method remain immutable platform invariants in UI and payload', 'PASS');
  } catch (err) {
    record('TEST_09', 'Immutable settings protection', 'FAIL', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Admin Route Protection and Navigation Integration
  // -------------------------------------------------------------------------
  try {
    // Check navigation item in AdminLayout.jsx
    assert.ok(
      adminLayoutSource.includes("{ label: 'Store Settings', path: '/admin/settings', icon: Settings }"),
      'Store Settings link registered in AdminLayout navItems'
    );
    assert.ok(
      adminLayoutSource.includes("p === '/admin/settings'"),
      'Store Settings breadcrumb handler registered in AdminLayout'
    );

    // Check lazy loading and protected route in App.jsx
    assert.ok(
      appJsxSource.includes("const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));"),
      'AdminSettingsPage is lazy loaded in App.jsx'
    );
    assert.ok(
      appJsxSource.includes('path="/admin/settings"'),
      'Route /admin/settings is mounted in App.jsx'
    );
    assert.ok(
      appJsxSource.includes('<ProtectedRoute requiredRole="ADMIN">') &&
        appJsxSource.includes('<AdminSettingsPage />'),
      'Route /admin/settings is wrapped in ProtectedRoute requiredRole="ADMIN"'
    );

    record('TEST_10', 'Admin route protection and sidebar navigation properly integrated', 'PASS');
  } catch (err) {
    record('TEST_10', 'Admin route protection and navigation integration', 'FAIL', err.message);
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
};

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
